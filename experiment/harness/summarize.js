#!/usr/bin/env node
// summarize.js: aggregates runs/*.json (+ .jsonl streams) and overhead/*.json of $EXP_RUN_DIR (default experiment/run)
// into summary.json. No report content is read. Usage: node harness/summarize.js
const fs = require('fs'), path = require('path');
const EXP = process.env.EXP_RUN_DIR ? path.resolve(process.env.EXP_RUN_DIR) : path.resolve(__dirname, '..', 'run');
const conds = { c0: 'Sources only (Read/Grep/Glob)', c1: 'Playwright MCP 0.0.83', c2: 'Chrome DevTools MCP 1.12.0', c3: 'Playwright script (Write + pw-run)' };
const stat = a => a.length ? { mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4), min: Math.min(...a), max: Math.max(...a), n: a.length } : null;
const fields = ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens', 'cost_usd', 'num_turns', 'tool_calls_total', 'duration_ms', 'duration_api_ms', 'wall_s'];
const out = { generated: new Date().toISOString(), conditions: {} };
for (const c of Object.keys(conds)) {
  const runs = [1, 2, 3].map(n => ({ n, f: path.join(EXP, 'runs', `${c}-${n}.json`) })).filter(r => fs.existsSync(r.f));
  const rows = runs.map(r => ({ n: r.n, s: JSON.parse(fs.readFileSync(r.f)) }));
  const o = { label: conds[c], runs: rows.length, stats: {}, per_run: [], tool_calls_by_tool_mean: {} };
  for (const k of fields) o.stats[k] = stat(rows.map(r => r.s[k]).filter(v => v != null));
  o.stats.total_context_tokens = stat(rows.map(r => (r.s.input_tokens || 0) + (r.s.cache_read_tokens || 0) + (r.s.cache_creation_tokens || 0)));
  const tools = new Set(); rows.forEach(r => Object.keys(r.s.tool_calls).forEach(t => tools.add(t)));
  for (const t of tools) o.tool_calls_by_tool_mean[t] = +(rows.reduce((x, r) => x + (r.s.tool_calls[t] || 0), 0) / rows.length).toFixed(2);
  for (const r of rows) {
    let toolErrors = 0, shots = 0, imageReads = 0, imageReadsOk = 0;
    const sf = path.join(EXP, 'runs', `${c}-${r.n}.jsonl`);
    if (fs.existsSync(sf)) {
      const idName = {};
      for (const l of fs.readFileSync(sf, 'utf8').split('\n')) {
        if (!l) continue; let e; try { e = JSON.parse(l); } catch (x) { continue; }
        if (e.type === 'assistant') for (const b of e.message.content || []) if (b.type === 'tool_use') {
          idName[b.id] = b;
          if (/screenshot/.test(b.name)) shots++;
          if (b.name === 'Read' && /\.(png|jpe?g|webp)$/i.test((b.input || {}).file_path || '')) imageReads++;
        }
        if (e.type === 'user' && Array.isArray(e.message.content)) for (const b of e.message.content) if (b.type === 'tool_result' && b.is_error) toolErrors++;
      }
    }
    o.per_run.push({ run: `${c}-${r.n}`, killed: r.s.killed, is_error: r.s.is_error, terminal_reason: r.s.terminal_reason, tool_calls: r.s.tool_calls_total, turns: r.s.num_turns, cost_usd: r.s.cost_usd, wall_s: r.s.wall_s, tool_result_errors: toolErrors, permission_denials: r.s.permission_denials, screenshot_calls: shots, image_Read_calls: imageReads });
  }
  const of = path.join(EXP, 'overhead', `${c}.json`);
  if (fs.existsSync(of)) { const s = JSON.parse(fs.readFileSync(of)); o.overhead = { input_tokens: s.input_tokens, cache_read_tokens: s.cache_read_tokens, cache_creation_tokens: s.cache_creation_tokens, output_tokens: s.output_tokens, total_context_tokens: s.input_tokens + s.cache_read_tokens + s.cache_creation_tokens, cost_usd: s.cost_usd }; }
  out.conditions[c] = o;
}
fs.writeFileSync(path.join(EXP, 'summary.json'), JSON.stringify(out, null, 1));
for (const [c, o] of Object.entries(out.conditions)) {
  const s = o.stats; const f = k => s[k] ? `${s[k].mean} [${s[k].min}-${s[k].max}]` : '-';
  console.log(c, `n=${o.runs}`, 'in', f('input_tokens'), 'out', f('output_tokens'), 'cr', f('cache_read_tokens'), 'cw', f('cache_creation_tokens'), 'cost', f('cost_usd'), 'turns', f('num_turns'), 'calls', f('tool_calls_total'), 'dur', f('duration_ms'), 'api', f('duration_api_ms'));
}
