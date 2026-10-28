// Driver of one "Claude in the loop" run (Windows bench).
// Usage: node run-one.js <condition: W1|W2> <id: W1-1|W2-OK|...> <mode: task|ok|smoke>
// - starts `claude -p` from an EMPTY directory per run (<run dir>/cwd/<id>/), prompt on stdin;
// - W1 = Claude in Chrome extension (--chrome); W2 = Playwright MCP (headless, isolated; mcp-pw.json, same folder);
// - strict tool allow-list, no Bash / Web / Edit / Write, claude.ai MCP connectors (Gmail...) excluded;
// - stops the run beyond 40 tool calls, 600 s or 400,000 tokens (cache reads excluded); the trace is kept.
// Prerequisites: Windows, Node >= 22, Claude Code installed and authenticated, Chrome with the Claude in Chrome
// extension (W1 only), the page served on http://localhost:8099/ (see ../../README.md).
// Environment: EXP_RUN_DIR = output directory (default experiment/run-windows); CLAUDE_BIN = path of claude.exe
// (default %USERPROFILE%/.local/bin/claude.exe).
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const [cond, id, mode] = process.argv.slice(2);
const HERE = __dirname;
const TASK_FILE = path.join(HERE, '..', '..', 'task', 'TASK.md');
const EXP = (process.env.EXP_RUN_DIR ? path.resolve(process.env.EXP_RUN_DIR) : path.join(HERE, '..', '..', 'run-windows')).replace(/\\/g, '/');
const CLAUDE = process.env.CLAUDE_BIN || (process.env.USERPROFILE + '/.local/bin/claude.exe');
const cwd = `${EXP}/cwd/${id}`;
// Permission rules write absolute Windows paths as //<drive>/<path>, e.g. C:/x/y -> //c/x/y
const permPath = p => p.replace(/^([A-Za-z]):/, (m, d) => '//' + d.toLowerCase());
fs.rmSync(cwd, { recursive: true, force: true }); fs.mkdirSync(cwd, { recursive: true });
for (const d of ['runs', 'reports']) fs.mkdirSync(`${EXP}/${d}`, { recursive: true });
const task = fs.readFileSync(TASK_FILE, 'utf8').trim();
const prompt = mode === 'ok' ? 'Reply with exactly: OK'
  : mode === 'smoke' ? 'Open http://localhost:8099/ in a browser and tell me the page title. Use at most 3 tool calls.' : task;

const args = ['-p', '--model', 'sonnet', '--output-format', 'stream-json', '--verbose',
  '--no-session-persistence', '--setting-sources', 'project', '--permission-mode', 'dontAsk',
  '--disable-slash-commands'];
if (cond === 'W1') {
  args.push('--chrome', '--tools', '', '--allowedTools', 'mcp__claude-in-chrome__*');
} else if (cond === 'W2') {
  args.push('--strict-mcp-config', '--mcp-config', path.join(HERE, 'mcp-pw.json'),
    '--tools', 'Read', '--allowedTools', 'mcp__playwright__*', `Read(${permPath(cwd)}/**)`);
} else { console.error('unknown condition'); process.exit(2); }

const MAX_CALLS = 40, MAX_MS = 600000, MAX_TOK = 400000;
const t0 = Date.now();
const p = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
p.stdin.end(prompt);
let buf = '', stderr = '', calls = {}, nCalls = 0, result = null, killed = null, tok = 0;
const seen = new Set(), trace = [];
const trunc = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'string' && v.length > 3000 ? v.slice(0, 3000) + `…[${v.length} chars]` : v));
const stop = why => { if (killed) return; killed = why; try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch (e) {} };
const timer = setInterval(() => { if (Date.now() - t0 > MAX_MS) stop('timeout 600 s'); }, 2000);
p.stderr.on('data', d => stderr += d);
p.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    let e; try { e = JSON.parse(line); } catch { continue; }
    trace.push(JSON.stringify(trunc(e)));
    if (e.type === 'assistant') {
      const m = e.message || {};
      if (m.id && !seen.has(m.id) && m.usage) { seen.add(m.id); tok += (m.usage.input_tokens || 0) + (m.usage.output_tokens || 0) + (m.usage.cache_creation_input_tokens || 0); }
      for (const c of m.content || []) if (c.type === 'tool_use') { calls[c.name] = (calls[c.name] || 0) + 1; nCalls++; }
      if (nCalls > MAX_CALLS) stop(`> ${MAX_CALLS} tool calls`);
      if (tok > MAX_TOK) stop(`> ${MAX_TOK} tokens`);
    }
    if (e.type === 'result') result = e;
  }
});
p.on('close', code => {
  clearInterval(timer);
  const out = { id, cond, mode, exitCode: code, killed, wallMs: Date.now() - t0, toolCalls: nCalls, callsByTool: calls, tokensNoCacheRead: tok, args, stderr: stderr.slice(0, 2000), result };
  fs.writeFileSync(`${EXP}/runs/${id}.json`, JSON.stringify(out, null, 1));
  fs.writeFileSync(`${EXP}/runs/${id}.stream.jsonl`, trace.join('\n'));
  fs.writeFileSync(`${EXP}/reports/${id}.md`, result && result.result ? String(result.result) : `(no final message; stopped: ${killed || 'no'})`);
  const u = result && result.usage || {};
  console.log(JSON.stringify({ id, exit: code, killed, wallMs: out.wallMs, calls: nCalls, byTool: calls, cost: result && result.total_cost_usd, turns: result && result.num_turns, in: u.input_tokens, out: u.output_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, isError: result && result.is_error }));
});
