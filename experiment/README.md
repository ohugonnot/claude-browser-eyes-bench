# Experiment: Claude in the loop

The bench at the root of this repository measures what browser tools see on one page with eight known defects. This folder asks the next question: **what is each tool worth when it is Claude that uses it, and not the tool alone?**

A tool can detect everything in a scripted run and still be a poor fit for a model: too many tokens per answer, an awkward way to resize the viewport, images that are never looked at, a long tool list that is re-read at every turn. The experiment gives the same task to Claude with each tool, measures the cost and the behaviour, and has the reports judged blind.

This folder documents the protocol and contains everything needed to replay it. It does **not** contain raw outputs (run JSON files, reports, traces) or screenshots. The results table is left to the maintainer: see [Results](#results).

Version française (résumé) : [README.fr.md](README.fr.md).

## What is in this folder

| path | role |
|---|---|
| `task/TASK.md` | the task given in every browser condition |
| `task/TASK-source-only.md` | the same task for the condition without a browser |
| `rubric.md` | the rubric of the blind judge |
| `harness/` | launch scripts for the WSL/Docker bench (`run-one.sh`, `run-all.sh`, `pw-run`, MCP wrappers, network, seed, monitor, summary, anonymiser) |
| `harness/windows/` | the Windows driver (`run-one.js`, `run-all.ps1`, `mcp-pw.json`) |

Every script starts with a header that documents its arguments and the environment variables it reads. Nothing is hard-coded to a machine: paths derive from the location of the scripts, and everything generated goes to `experiment/run/` (WSL) or `experiment/run-windows/` (Windows), both git-ignored.

## The question

The first part of the study measured the tools: given the same page, what do Chromium, Firefox and WebKit report, and how many tokens does each tool's output cost. That says nothing about a model using the tool. Here the unit of measurement is a Claude run: it receives a task, chooses its tool calls, and writes a report. We measure the run (tokens, cost, turns, tool calls, time) and the report (defects found, false claims, quality of evidence).

## Protocol

**Same task for everyone.** The page is the one of this repository, served at `http://localhost:8099/`. The task ([`task/TASK.md`](task/TASK.md)) asks for an audit at three viewports (390x844, 820x1180, 1440x900) and a final list of defects with id, viewport and evidence, within at most 40 tool calls. The task does not mention any defect, and the page never describes its own defects.

**Conditions.**

| id | condition | what Claude can use |
|---|---|---|
| C0 | sources only | `Read`, `Grep`, `Glob` on the page's source directory; task `TASK-source-only.md`; no browser |
| C1 | Playwright MCP | `@playwright/mcp` 0.0.83 (25 tools), Chromium headless, isolated; `Read` limited to the MCP output folder |
| C2 | Chrome DevTools MCP | `chrome-devtools-mcp` 1.12.0 (32 tools), headless, isolated, the image's Chromium; `Read` limited to the MCP output folder |
| C3 | Playwright script written by Claude | no MCP; `Write` limited to its own working folder, `Bash` limited to the `pw-run <file.js>` wrapper, which runs the script in a container; `Read` limited to the working folder |
| W1 | Claude in Chrome (Windows only) | the browser extension driven by `claude -p --chrome`, 22 tools, no built-in tool |
| W2 | Playwright MCP, Windows control | `@playwright/mcp` 0.0.83, headless, isolated; `Read` limited to the run folder |

C0 to C3 run on WSL with Docker. W1 and W2 run on a Windows host with Chrome; W2 is a witness: the same Playwright MCP as C1, so that the Windows bench can be compared with the WSL one.

**Runs.** 3 runs per condition: 12 on WSL, 6 on Windows. On WSL the order is interleaved and random, with a fixed seed (`harness/SEED`, `harness/order.py`). On Windows the order is fixed (W1, W2, W1, W2, W1, W2).

**Model and context.** `claude -p --model sonnet`, started from an empty directory so that no project `CLAUDE.md` applies. On WSL: `--setting-sources ""` (no settings, no hooks, no global instructions), `--disable-slash-commands` (no skill), `--no-session-persistence`, automatic memory disabled by the `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` environment variable, `--strict-mcp-config` with one MCP file per run. What stays loaded is Claude Code's default system prompt and the description of the allowed tools. On Windows the same flags apply except `--setting-sources project` (the empty run folder has no settings) and `--chrome` for W1. `--bare` cannot be used with OAuth authentication, and `--safe-mode` ignores `--mcp-config`, so neither is used.

**Strict tool list.** `--tools` restricts the built-in tools and `--allowedTools` is an allow-list; with `--permission-mode dontAsk` everything else is refused in non-interactive mode. No `Bash` outside `pw-run`, no `WebFetch`, no `WebSearch`, no `Edit`/`Write` outside the run's folder, no sub-agent. A monitor (`harness/monitor.js`, and the driver on Windows) counts tool calls from the stream and kills a run beyond 40 calls or 600 s (on Windows also beyond 400,000 tokens, cache reads excluded).

**Network cut except localhost.** Containers run on a Docker `--internal` network with no route to the Internet. A relay container forwards only port 8099 of the host, and a small relay inside each container exposes it as `localhost:8099`. The harness was checked this way: `localhost:8099` answers and an external host fails with `ERR_NAME_NOT_RESOLVED` in all three routes (script, Playwright MCP, DevTools MCP). On Windows there is no such isolation (see Limits).

**Fixed overhead.** For each condition, one extra run with a trivial prompt ("reply OK", same configuration, no task) isolates the cost of the system prompt and of the tool list from the cost of the task. It is run with `run-one.sh <condition> 1 overhead` on WSL and `node run-one.js <condition> <id> ok` on Windows.

**Costs and measures.** Everything comes from the JSON that `claude -p --output-format stream-json` prints: input, output, cache-read and cache-write tokens, cost, number of turns, number of tool calls per tool, wall-clock and API duration. `harness/summarize.js` aggregates them into a `summary.json` (mean and min-max per condition).

## Blind judging

The reports are anonymised and shuffled with `harness/blind.js`: tool names, MCP function names, paths and sentences that give the method away ("from reading the source", a refused `curl`, "I took no screenshot") are removed or replaced, the findings are kept, the order is shuffled with a fixed seed, and the key is written to a separate mapping file that the judge never sees. Anonymisation is lexical only: the style of evidence can still hint at the condition.

A judge from a different model than the one measured grades each report against the list of known defects and the code of the page, following [`rubric.md`](rubric.md):

- **D1 to D8 graded T / P / M** (found / partial / missed);
- **false claims**: statements the page contradicts (a wrong cause, an invented detail), checked against the code and a render;
- **real defects outside the list**, verified against the code;
- **dominant evidence** (measured, read in the code, assumed);
- a score out of 10 with a written justification.

## Replaying it

### Prerequisites

- Docker (with Compose for the bench at the root; plain Docker is enough for the harness). Your user must be able to run it, or run the scripts through `sg docker -c '...'` or `sudo`.
- Claude Code, installed and **authenticated** on the host (`claude` on the `PATH`). The harness uses OAuth/subscription authentication and never reads or stores a key.
- Node.js 18 or later on the host (the MCP servers and browsers run in Docker, with the Node of the image) and Python 3 (for `order.py`).
- Internet access for the one-time `harness/setup.sh` (npm install) and the first pull of the Playwright image `mcr.microsoft.com/playwright:v1.64.1-noble`. Runs themselves need no Internet except what Claude Code itself needs to reach its API.
- For Windows only: Windows 11, Node.js 22 or later, Claude Code, Google Chrome with the Claude in Chrome extension (W1), and the page served on the same machine on port 8099.

### Number of runs and approximate cost

The WSL batch is 12 task runs plus 4 overhead runs; the Windows batch is 6 task runs plus 2 overhead runs. Each run takes from under a minute to a few minutes. At the "list" price shown by Claude Code, a condition of 3 runs costs on the order of a few tenths of a dollar, and the whole experiment a few dollars at most. These are list prices from the JSON, not what a subscription quota burns.

### Steps (WSL / Linux)

1. **Serve the page on port 8099, on an address the Docker bridge can reach.** The compose service of the root bench binds loopback only, so use the static server on all interfaces:

   ```sh
   # from the repository root; stop it when you are done
   node bench/serve.mjs site 8099 0.0.0.0
   ```

   The experiment ran on the page as of commit `0aa489b`. The later commit fixed the unstyled "Retour" link of `a-propos.html`, which the judge counted as a real defect outside the list. To replay exactly what was measured, serve `site/` from that commit (`git worktree add ../bench-as-measured 0aa489b`, then `node bench/serve.mjs site 8099 0.0.0.0` from there) and point `SITE_DIR` at its `site/` for condition C0.

2. **Install the npm packages and create the isolated network:**

   ```sh
   cd experiment
   harness/setup.sh          # @playwright/mcp 0.0.83, chrome-devtools-mcp 1.12.0, playwright 1.64.1
   harness/net-up.sh         # internal network + relay for port 8099
   ```

3. **Run one condition, or everything:**

   ```sh
   harness/run-one.sh c1 1             # condition c1, run 1
   harness/run-one.sh c1 1 overhead    # fixed overhead of c1
   harness/run-all.sh                  # the 12 runs, in the seeded order, resumable
   ```

   Outputs go to `experiment/run/`: `runs/<cond>-<n>.json` (statistics and result) and `.jsonl` (raw stream), `reports/<cond>-<n>.md` (the final message of Claude), `overhead/<cond>.json`, `work/` and `mcp-out/` (scripts and captures).

4. **Aggregate and anonymise:**

   ```sh
   node harness/summarize.js      # -> run/summary.json
   node harness/blind.js          # -> run/blind/R01..R12.md and run/blind/_mapping.json
   ```

   Give `blind/R*.md`, `rubric.md`, the defect list and the site code to a judge model, and keep `_mapping.json` for yourself.

5. **Clean up:** `harness/net-down.sh`, then stop the page server.

Useful variables: `EXP_RUN_DIR` (where outputs go), `SITE_DIR` (sources read by C0), `DOCKER_USER` (`uid:gid` of the containers, default the current user), `EXP_IMAGE` (the Docker image).

### Steps (Windows)

Serve the page on the Windows machine at `http://localhost:8099/` (for example `node bench\serve.mjs site 8099` from the repository root), then in PowerShell:

```powershell
cd experiment\harness\windows
.\run-all.ps1                                    # the 6 task runs, W1 and W2 alternating
node run-one.js W1 W1-OK ok                      # fixed overhead of W1 (use W2 W2-OK ok for W2)
```

Outputs go to `experiment\run-windows\` (`runs\`, `reports\`, `run-all.log`). Variables: `EXP_RUN_DIR`, `CLAUDE_BIN` (path of `claude.exe`).

## Results

<!-- RESULTS:BEGIN -->
<!-- RESULTS:END -->

## Limits

- **Three runs per condition.** Min-max shows the spread, not a confidence interval. A different draw could reorder close conditions.
- **One page.** It is small, in French, with eight planted defects; the results are specific to this page and this task and do not transfer to a large application.
- **One browser engine** in the browser conditions (Chromium, or Chrome on Windows). The MCP servers were started in a way that offers no WebKit or Firefox; the Playwright script of C3 could have used them, but this is not analysed here.
- **Subjective judging.** The judge is a model applying a written rubric, on twelve reports; its grades are a reasoned opinion, not a measurement. Anonymisation is lexical and the style of evidence can reveal the condition.
- **"List" costs, not quota.** Costs are the dollar figures computed by Claude Code from list prices, and they depend on the state of the prompt cache (the same overhead run costs far more cold than warm). Token counts are more stable. The real consumption of a subscription quota was not measured.
- **The orchestration author knew an old defect list.** The person who built the harness on Windows had read the defect list of an earlier page, earlier in the same day. The runs themselves are fresh invocations with an empty context and receive no hint, the harness author did not read the defects of the page used and did not grade the reports, but this is not the same as nobody ever having known the answer. On WSL, the instructions given to the orchestrator forbade reading any defect list.
- **No real iPhone.** "Likely to break on iPhone Safari" is asked in the task, but no run could check it on a real device; D4 can only be assumed from knowledge of Safari.
- **Windows is not isolated like WSL.** The Windows bench has no network isolation, uses a fixed order instead of a seed, and the W1 extension works in a window that cannot be made narrower than about 500 px, which pushes Claude towards workarounds.
- **Results are specific to this page.** Do not read a ranking of the tools in the table: it is a ranking of these runs on this task.
