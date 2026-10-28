#!/bin/bash
# run-one.sh <condition: c0|c1|c2|c3> <n> [overhead]
# Runs ONE `claude -p` (sonnet) from an empty directory ($RUN_DIR/cwd), with the condition's strict allow-list.
# Prerequisites: harness/setup.sh done, harness/net-up.sh done, the page served on http://localhost:8099/.
# Outputs (under $RUN_DIR, see env.sh):
#   runs/<c>-<n>.jsonl (raw stream), runs/<c>-<n>.json (stats + result), reports/<c>-<n>.md (final message)
#   or, in overhead mode: overhead/<c>.json
# Conditions: c0 sources only | c1 Playwright MCP | c2 Chrome DevTools MCP | c3 Playwright script (Write + pw-run)
set -u
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
C="$1"; N="${2:-1}"; MODE="${3:-task}"
RUN="$C-$N"; [ "$MODE" = overhead ] && RUN="$C-overhead"
CWD="$RUN_DIR/cwd"; mkdir -p "$CWD"; cd "$CWD" || exit 1
CFG="$RUN_DIR/generated"; mkdir -p "$CFG"
OUTD="$RUN_DIR/mcp-out/$RUN"; WORK="$RUN_DIR/work/$RUN"; mkdir -p "$OUTD" "$WORK"
WORK="$(realpath "$WORK")"; OUTD="$(realpath "$OUTD")"

# Common flags: sonnet; no settings source at all (--setting-sources "": no settings, no hooks, no global
# CLAUDE.md of the user); skills/commands disabled; automatic memory disabled by an environment variable (no
# config file is modified); MCP servers only from the condition's file; no session persistence; everything that
# is not allow-listed is refused (dontAsk). --bare is not usable with OAuth authentication, and --safe-mode also
# ignores --mcp-config, so neither is used.
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
COMMON=(-p --model sonnet --setting-sources "" --disable-slash-commands --no-session-persistence
        --permission-mode dontAsk --output-format stream-json --verbose --strict-mcp-config)
TASKFILE="$EXP/task/TASK.md"; EXTRA=""
# Note: absolute-path permission rules start with "//" (the path below begins with "/"); a Write(...) rule does
# not cover the Write tool, Edit(...) does.
case "$C" in
  c0) TOOLS="Read,Grep,Glob"
      ALLOW=("Read(/$SITE_DIR/**)" "Grep(/$SITE_DIR/**)" "Glob(/$SITE_DIR/**)")
      MCPCFG=""; TASKFILE="$EXP/task/TASK-source-only.md"
      EXTRA=$'\n\nThe source directory is: '"$SITE_DIR/" ;;
  c1) TOOLS="Read"; ALLOW=("mcp__playwright" "Read(/$OUTD/**)")
      MCPCFG="$CFG/mcp-$RUN.json"
      printf '{"mcpServers":{"playwright":{"command":"%s/mcp-pw.sh","args":["%s"]}}}' "$HARNESS" "$OUTD" > "$MCPCFG" ;;
  c2) TOOLS="Read"; ALLOW=("mcp__chrome-devtools" "Read(/$OUTD/**)")
      MCPCFG="$CFG/mcp-$RUN.json"
      printf '{"mcpServers":{"chrome-devtools":{"command":"%s/mcp-cdt.sh","args":["%s"]}}}' "$HARNESS" "$OUTD" > "$MCPCFG" ;;
  c3) TOOLS="Read,Write,Bash"
      ALLOW=("Read(/$WORK/**)" "Edit(/$WORK/**)" "Bash(pw-run *)")
      MCPCFG=""
      export PWRUN_DIR="$WORK"; export PATH="$HARNESS/bin:$PATH"
      EXTRA=$'\n\nYou can write and run Playwright scripts (Node, `require('"'playwright'"')`, engines chromium/firefox/webkit, devices['"'iPhone 15'"']) with the `pw-run` tool: write a .js file with Write inside your working directory '"$WORK"$'/ then run it with Bash as `pw-run <file.js>`. Inside the script, files written with relative paths (or under /work/) end up in your working directory '"$WORK"$'/ ; screenshots are saved as files that you can read with Read.' ;;
esac
ARGS=("${COMMON[@]}" --tools "$TOOLS" --allowedTools "${ALLOW[@]}")
[ -n "$MCPCFG" ] && ARGS+=(--mcp-config "$MCPCFG")

# The fixed-overhead prompt is kept in French, as in the measured runs.
if [ "$MODE" = overhead ]; then PROMPT="Réponds OK"; MAXT=3; DEST="$RUN_DIR/overhead/$C"; else
  PROMPT="$(cat "$TASKFILE")$EXTRA"; MAXT=40; DEST="$RUN_DIR/runs/$RUN"; fi
[ -n "${PROBE:-}" ] && { PROMPT="$PROBE"; MAXT=20; DEST="$RUN_DIR/overhead/probe-$RUN"; }  # permission tests only
mkdir -p "$RUN_DIR/runs" "$RUN_DIR/overhead" "$RUN_DIR/reports"
printf '%s' "$PROMPT" | node "$HARNESS/monitor.js" "$DEST.json" "$DEST.jsonl" "$MAXT" 600 -- claude "${ARGS[@]}"
# Remove MCP containers that may have been left behind
docker ps -q --filter name=exp-mcp | xargs -r docker rm -f >/dev/null 2>&1
if [ "$MODE" != overhead ]; then
  node -e 'const s=require(process.argv[1]);require("fs").writeFileSync(process.argv[2], s.result_text||"(no final message)\n")' "$DEST.json" "$RUN_DIR/reports/$RUN.md"
else mv "$DEST.jsonl" "$DEST.stream.jsonl" 2>/dev/null; fi
node -e 'const s=require(process.argv[1]);console.log(JSON.stringify({k:process.argv[2],killed:s.killed,calls:s.tool_calls_total,turns:s.num_turns,cost:s.cost_usd,wall:s.wall_s,err:s.is_error}))' "$DEST.json" "$RUN"
