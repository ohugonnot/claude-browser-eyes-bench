#!/usr/bin/env node
// monitor.js <stats.json> <stream.jsonl> <max_tools> <timeout_s> -- <command...>   (prompt on stdin)
// Runs claude (stream-json), copies the raw stream, counts tool calls by name, kills the run beyond max_tools
// calls or timeout_s seconds, and writes a stats file (final result event included).
const { spawn } = require('child_process');
const fs = require('fs');
const [statsF, streamF, maxTools, timeoutS] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
const cmd = process.argv.slice(process.argv.indexOf('--') + 1);
const out = fs.createWriteStream(streamF);
const t0 = Date.now();
const child = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], detached: true });
process.stdin.pipe(child.stdin);
const seen = new Set(); const calls = {}; let total = 0, result = null, killed = null, buf = '';
let stderr = '';
child.stderr.on('data', d => { stderr += d; });
function kill(why) { if (killed) return; killed = why; try { process.kill(-child.pid, 'SIGTERM'); } catch (e) {} setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) {} }, 5000); }
const timer = setTimeout(() => kill('timeout_' + timeoutS + 's'), timeoutS * 1000);
function onLine(l) {
  if (!l.trim()) return;
  out.write(l + '\n');
  let ev; try { ev = JSON.parse(l); } catch (e) { return; }
  if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
    for (const b of ev.message.content) if (b.type === 'tool_use' && !seen.has(b.id)) {
      seen.add(b.id); total++; calls[b.name] = (calls[b.name] || 0) + 1;
      if (total > maxTools) kill('max_tool_calls_' + maxTools);
    }
  }
  if (ev.type === 'result') result = ev;
}
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
child.on('close', (code, sig) => {
  clearTimeout(timer); if (buf) onLine(buf); out.end();
  const r = result || {};
  const u = r.usage || {};
  fs.writeFileSync(statsF, JSON.stringify({
    exit_code: code, signal: sig, killed, wall_s: (Date.now() - t0) / 1000,
    tool_calls_total: total, tool_calls: calls,
    is_error: r.is_error ?? null, subtype: r.subtype ?? null, terminal_reason: r.terminal_reason ?? null,
    num_turns: r.num_turns ?? null, duration_ms: r.duration_ms ?? null, duration_api_ms: r.duration_api_ms ?? null,
    cost_usd: r.total_cost_usd ?? null,
    input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null,
    cache_read_tokens: u.cache_read_input_tokens ?? null, cache_creation_tokens: u.cache_creation_input_tokens ?? null,
    permission_denials: (r.permission_denials || []).length,
    result_text: r.result ?? null, stderr_tail: stderr.slice(-1500), result_event: result
  }, null, 1));
});
