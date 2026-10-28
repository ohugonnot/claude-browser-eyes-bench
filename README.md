# claude-browser-eyes-bench

A reproducible bench that shows what the browsers driven by Playwright (Chromium, Firefox, WebKit) "see" on one page with eight known defects, at three viewports: mobile 390x844, tablet 820x1180, desktop 1440x900.

It is the companion of a blog post about the tools that give a browser to a coding agent. It is also meant for you: serve the same page, give the same [prompt](PROMPT.md) to your own tool (an MCP server, an extension, a script), and compare its report with [DEFECTS.md](DEFECTS.md).

Article: coming soon. Version française : [README.fr.md](README.fr.md).

## Run it

You need Docker with Compose, nothing else (no Node, no Playwright on the host).

```sh
docker compose run --rm bench
```

It builds the image (the official Playwright image, pinned to v1.64.1 and to its digest), starts a small static server inside the container, audits `site/` and `site-fixed/` in the three engines at the three viewports, writes `out/report.json` and `out/*.png`, then runs `bench/check.mjs`. The exit code is non-zero if anything differs from what is expected.

The container runs as uid/gid 1000 so that `out/` belongs to you. On another uid: `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm bench`.

To test another tool on the same page:

```sh
docker compose up site          # http://localhost:8099/  (127.0.0.1 only)
docker compose up site-fixed    # http://localhost:8100/  the same page, defects fixed
```

## What is in it

| path | role |
|---|---|
| `site/` | the page under test (French, neutral wording; it never describes its own defects) |
| `site-fixed/` | the same page without the eight defects, produced by `bench/make-fixed.mjs` (one patch per defect, drift checked) |
| `audit/audit.js` | the audit: one async function injected into the page |
| `bench/run.mjs` | Playwright runner (3 engines x 3 viewports x 2 pages), report and captures |
| `bench/check.mjs` | pass/fail gate (see below) |
| `bench/expected.json` | the defects each engine must report, per viewport |
| `DEFECTS.md` | the ground truth |
| `PROMPT.md` | the prompt to give to a tool or an agent, with no list of defects |

`check.mjs` fails unless (1) `site/` yields exactly the expected defects per engine and viewport, (2) `site-fixed/` yields no finding of any kind, (3) `site-fixed/` is exactly `site/` plus the documented patches, (4) the report covers every engine and viewport with the pinned Playwright version. The runner does not read `DEFECTS.md`; the audit detects by kind of finding, and the comparison with `expected.json` happens afterwards.

Mobile uses `devices['iPhone 15']` (touch, mobile user agent) with the viewport and screen forced to 390x844; tablet uses `devices['iPad (gen 7)']`; desktop uses the engine's desktop descriptor. Firefox has no mobile mode, so `isMobile` is dropped there.

## What the audit detects, and how

| method | checks |
|---|---|
| Rendering (measured on the live page, per engine and viewport) | horizontal overflow, content cut by `overflow:hidden`, touch targets under 44 px and close to each other, `<img>` without `alt`, text contrast under 4.5:1 |
| Events (collected by the runner, not by the injected function) | uncaught page errors after pressing every button, HTTP responses of 400 and above, failed requests, console errors and warnings |
| Static heuristic (read from the CSS, not from the layout) | `100vh`-style heights (D4); `calc-size()` declarations that `CSS.supports` rejects in the running engine (D5, where the stylesheet text is read because a rejected declaration is dropped from the CSSOM) |

D4 is the honest exception. It is a real iOS Safari problem that no headless engine reproduces: in Chromium, Firefox and WebKit, even with the iPhone descriptor, `100vh` equals `innerHeight`. The bench therefore finds D4 only by the static rule, and the heuristic would also flag harmless uses of `vh`. A rendering check needs a real iPhone or a Mac simulator, which this repository does not have.

## Measurements from the study

These are the figures of the study this bench accompanies, not output of this repository. Setup: WSL2 with Docker, image `mcr.microsoft.com/playwright:v1.64.1-noble`, Playwright 1.64.1 as a script, 3 passes, median (spread max-min in brackets), in milliseconds. "Start" runs from the launch to the first screenshot; "Task" is the full job: 3 viewports, full-page screenshot, audit, a click on every button, console and network.

| engine (version read in the browser) | start | task | defects found |
|---|---|---|---|
| Chromium 156.0.8078.4 | 5 778 (122) | 7 158 (58) | 7 of 7 applicable |
| Firefox 157.0 | 2 269 (77) | 4 406 (114) | 8 of 8 |
| WebKit 27.2 | 1 916 (131) | 3 748 (177) | 8 of 8 |

Notes from the study: Chromium's figures include about 3 s lost on a click that times out under touch emulation on a page that overflows (WebKit and Firefox click normally). 0 failures in 3 passes. The study's audit was the same kind of injected function, so these numbers say how fast each engine runs the task and what it can detect, not which tool is better; the defects found are identical for every candidate.

Caveats on reusing them here: the page in this repository is a reworded and cleaned version of the study's page (neutral texts, no unrelated accessibility warnings), so the durations above were not measured on this exact page. `out/report.json` records the durations of your own run.

## Verified / not verified

| | status |
|---|---|
| `docker compose run --rm bench` exits 0 from a fresh clone, on Docker with WSL2 (Linux x86-64) | verified |
| `site/` yields the expected defects (7 in Chromium, 8 in Firefox and WebKit) and `site-fixed/` yields no finding, at the 3 viewports | verified |
| `check.mjs` exits non-zero when the audit is weakened, when `site-fixed/` regains a defect, or when `expected.json` asks for a ninth defect | verified by hand-made mutations |
| D4 as it appears on a real iPhone (dynamic Safari toolbar) | not verified: no real device; only the static rule runs |
| Cost in image tokens of a screenshot for a model | not measured; only file sizes are in the study |
| MCP servers and CLI of the study (Playwright MCP, Chrome DevTools MCP, ...) | measured in the study, **not** run by this repository |
| Browser extensions driven from a real browser profile | not tested, neither in the study nor here |
| A model judging the page | not done: the audit is a program |
| Windows, macOS, ARM hosts | not verified |

## Limits

- The audit is an injected program, not a model that judges. It does not rank tools: every tool that can run the same function finds the same defects. What the bench tests is what a tool is able to detect, and what you get when you ask it in your own words (use [PROMPT.md](PROMPT.md) and score by hand).
- Three engines on Linux are not three real devices: WebKit for Linux has no dynamic toolbar, no safe area and no iOS font rendering.
- Under Chromium touch emulation on the overflowing mobile page, a real click on a button can time out; the runner then dispatches the click event and records it (`clicks.fallback` in `report.json`).
- The slight overlap of the card title in D2 is visible in the screenshot but is not detected by the audit.
- The bench makes no request to the Internet when it runs, apart from building the image.

## License

MIT, see [LICENSE](LICENSE).
