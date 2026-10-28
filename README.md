# claude-browser-eyes-bench

A reproducible bench that shows what the browsers driven by Playwright (Chromium, Firefox, WebKit) "see" on one page with eight known defects, at three viewports: mobile 390x844, tablet 820x1180, desktop 1440x900.

It is the companion of a blog post about the tools that give a browser to a coding agent. It is also meant for you: serve the same page, give the same [prompt](PROMPT.md) to your own tool (an MCP server, an extension, a script), and compare its report with [DEFECTS.md](DEFECTS.md).

Article (English): [Giving Claude Code a browser](https://www.web-developpeur.com/en/blog/yeux-claude-code-navigateur-playwright-mcp-devtools). Version française : [README.fr.md](README.fr.md). The follow-up study, where Claude itself runs the audit with each tool, is in [`experiment/`](experiment/).

## Run it

You need Docker with Compose, nothing else (no Node, no Playwright on the host).

```sh
docker compose run --rm --build bench
```

`--build` makes sure the image matches the files you have (without it Compose reuses an older image). It builds the image (the official Playwright image, pinned to v1.64.1 and to its digest), starts a small static server inside the container, audits `site/` and `site-fixed/` in the three engines at the three viewports, writes `out/report.json` and `out/*.png`, runs a few unit tests first, then `bench/check.mjs`. The exit code is non-zero if anything differs from what is expected.

The container runs as uid/gid 1000 so that `out/` belongs to you. On another uid: `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm --build bench`. See [Troubleshooting](#troubleshooting).

To test another tool on the same page:

```sh
docker compose up --build site          # http://localhost:8099/  (127.0.0.1 only; BENCH_PORT=18099 to change it)
docker compose up --build site-fixed    # http://localhost:8100/  the same page, defects fixed (BENCH_FIXED_PORT)
docker compose down                     # when you are done
```

## What is in it

| path | role |
|---|---|
| `site/` | the page under test (French, neutral wording; it never describes its own defects) |
| `site-fixed/` | the same page without the eight defects, produced by `bench/make-fixed.mjs` (one patch per defect, drift checked) |
| `audit/audit.js` | the audit: one async function injected into the page |
| `bench/run.mjs` | Playwright runner (3 engines x 3 viewports x 2 pages), report and captures |
| `bench/check.mjs` | pass/fail gate (see below) |
| `bench/canary/` | a third page that shows every kind of finding, so that each detector is proven alive on every run |
| `bench/expected.json` | per engine: the defects and the raw findings `site/` must show, per viewport |
| `bench/test/` | unit tests (static server, verdict logic) |
| `DEFECTS.md` | the ground truth |
| `PROMPT.md` | the prompt to give to a tool or an agent, with no list of defects |

`check.mjs` fails unless all of these hold:
1. the report was produced from the files now on disk (a stale `out/report.json` is refused);
2. `site/` yields exactly the expected defect ids **and** exactly the expected raw findings (overflow, cut content, small targets, close targets, `<img>` without `alt`, low contrast, `vh` rule, unsupported CSS, page errors, HTTP errors, failed requests, console messages), per engine and viewport;
3. `site-fixed/` yields no finding of any kind, and every button is really clickable;
4. the canary page, which shows each kind of finding once, is detected kind by kind. So disabling any single detector of the audit or of the runner turns the check red, even when another detector still reports the same defect;
5. the audit read every stylesheet (it lists what it could not read in `notes`) and nothing tried to leave localhost (see below);
6. `site-fixed/` is exactly `site/` plus the documented patches.

The runner does not read `DEFECTS.md`: the audit works by kind of finding, and the comparison with `expected.json` comes afterwards.

**Offline.** The `bench` service runs with no network at all (`network_mode: none`), and the runner also aborts and records any request to a host other than localhost. The canary contains one such request on purpose, to prove the guard works. The image build does need the network (npm, base image).

Mobile uses `devices['iPhone 15']` (touch, mobile user agent) with the viewport and screen forced to 390x844; tablet uses `devices['iPad (gen 7)']`; desktop uses the engine's desktop descriptor. Firefox has no mobile mode, so `isMobile` is dropped there.

## The eight defects

The page never describes them; the full table (selectors, fixes) is in [DEFECTS.md](DEFECTS.md).

| id | defect | viewport | engines |
|----|--------|----------|---------|
| D1 | horizontal overflow: a block fixed at 600 px wide | mobile | all |
| D2 | card text cut (fixed height + `overflow:hidden` between 700 and 900 px); the title also touches the text | tablet | all |
| D3 | two buttons 26 px high with 0 px between them | all | all |
| D4 | hero in `100vh` with its button glued to the bottom edge: on a real iPhone the Safari toolbar hides it (expected behaviour, not verified on a real iPhone here) | real iOS Safari only | none of the three headless engines; found here only by a static CSS rule |
| D5 | `calc-size()` after a 40 px fallback: engines that do not know it drop the declaration and the text spills over the next section | all | Firefox 157 and WebKit 27.2; not Chromium, which supports it |
| D6 | uncaught error on click: `calculerTotal` is not defined | all, on click | all |
| D7 | request answered 404: `GET api/promotions.json` | all | all |
| D8 | `<img>` without `alt`, and a caption in `#aaa` on `#fff` (2.32:1, under 4.5:1) | all | all |

Expected result: Chromium 7 of 7 applicable defects (D5 does not exist there), Firefox 8 of 8, WebKit 8 of 8, **where D4 counts as found by the static rule only**.

## What the audit detects, and how

| method | checks |
|---|---|
| Rendering (measured on the live page, per engine and viewport) | horizontal overflow, content cut by `overflow:hidden`, touch targets under 44 px and close to each other, `<img>` without `alt`, text contrast under 4.5:1 |
| Events (collected by the runner, not by the injected function) | uncaught page errors after pressing every button, HTTP responses of 400 and above, failed requests to localhost, console errors and warnings |
| Static heuristic (read from the CSS, not from the layout) | `100vh`-style heights (D4); `calc-size()` declarations that `CSS.supports` rejects in the running engine (D5: the stylesheet text is read because a rejected declaration is dropped from the CSSOM; `calc-size()` is the only feature checked). Stylesheets it cannot read are listed in `notes`, never skipped silently |

D4 is the honest exception, and the "7 of 7" and "8 of 8" above include it. It is a real iOS Safari problem that no headless engine reproduces: in Chromium, Firefox and WebKit, even with the iPhone descriptor, `100vh` equals `innerHeight`. The bench therefore finds D4 only by the static rule, and the heuristic would also flag harmless uses of `vh`. A rendering check needs a real iPhone or a Mac simulator, which this repository does not have.

## Measurements from the study

These are the figures of the study this bench accompanies, not output of this repository. The three rows are copied from the study's notes in [docs/etude.md](docs/etude.md), together with why this repository's own numbers differ. Setup: WSL2 with Docker, image `mcr.microsoft.com/playwright:v1.64.1-noble`, Playwright 1.64.1 as a script, 3 passes, median (spread max-min in brackets), in milliseconds. "Start" runs from the launch to the first screenshot; "Task" is the full job: 3 viewports, full-page screenshot, audit, a click on every button, console and network.

| engine (version read in the browser) | start | task | defects found (D4 by static rule only) |
|---|---|---|---|
| Chromium 156.0.8078.4 | 5 778 (122) | 7 158 (58) | 7 of 7 applicable |
| Firefox 157.0 | 2 269 (77) | 4 406 (114) | 8 of 8 |
| WebKit 27.2 | 1 916 (131) | 3 748 (177) | 8 of 8 |

Notes from the study: Chromium's figures include about 3 s lost on a click that times out under touch emulation on a page that overflows (WebKit and Firefox click normally). 0 failures in 3 passes. The study's audit was the same kind of injected function, so these numbers say how fast each engine runs the task and what it can detect, not which tool is better; the defects found are identical for every candidate.

Caveats on reusing them here: the page in this repository is a reworded and cleaned version of the study's page (neutral texts, no unrelated accessibility warnings), so the durations above were not measured on this exact page. `out/report.json` records the durations of your own run.

## Verified / not verified

| | status |
|---|---|
| `docker compose run --rm --build bench` exits 0 from a fresh clone, on Docker with WSL2 (Linux x86-64) | verified |
| `site/` yields the expected defects (7 in Chromium, 8 in Firefox and WebKit) and `site-fixed/` yields no finding, at the 3 viewports | verified |
| `check.mjs` exits non-zero when any one signal is disabled (`imgNoAlt`, `lowContrast`, `smallTargets`, `httpErrors`, `requestsFailed`, `console`, and the others), when `site-fixed/` regains a defect, when a click fallback appears on `site-fixed/`, when `expected.json` asks for a ninth defect, or when the report is stale | verified by hand-made mutations (one per signal) |
| D4 as it appears on a real iPhone (dynamic Safari toolbar) | not verified: no real device; only the static rule runs |
| Cost in image tokens of a screenshot for a model | not measured; only file sizes are in the study |
| MCP servers and CLI of the study (Playwright MCP, Chrome DevTools MCP, ...) | measured in the study, **not** run by this repository |
| Browser extensions driven from a real browser profile | not tested, neither in the study nor here |
| A model judging the page | not done: the audit is a program |
| Windows, macOS, ARM hosts | not verified |

## Limits

- The audit is an injected program, not a model that judges. It does not rank tools: every tool that can run the same function finds the same defects. What the bench tests is what a tool is able to detect, and what you get when you ask it in your own words (use [PROMPT.md](PROMPT.md) and score by hand).
- Three engines on Linux are not three real devices: WebKit for Linux has no dynamic toolbar, no safe area and no iOS font rendering.
- D5 is found from the stylesheet text and the engine's `CSS.supports`, not from the visible overflow of the panel.
- Under Chromium touch emulation on the overflowing mobile page, a real click on one button times out; the runner then dispatches the click event and counts it (`clicks.fallback` in `report.json`). That is expected on `site/` in Chromium at mobile (D1 is what causes it) and `check.mjs` fails on any other fallback, and on any fallback on `site-fixed/`.
- The slight overlap of the card title in D2 is visible in the screenshot but not detected.

## Known limits

Left as they are, on purpose or for lack of time:
- The audit is meant for this page. On other pages it can raise false alarms: visually hidden text counts as cut content, inline links count as close small targets, contrast ignores opacity, gradients and large-text thresholds, and `vh` is read only in `height`, `min-height` and `max-height`.
- The audit loads only `index.html` (the root URL of each page set). `a-propos.html` is served but not audited, so its touch targets (the "Retour" link, fixed to 44 px high) are not measured by the bench.
- Only localhost errors are recorded with their path; the host is not kept.
- No test of the audit itself beyond the canary page.
- `npm run make-fixed` (to regenerate `site-fixed/` after editing `site/`) needs Node 20 or later on the host; the bench itself does not.
- `docker compose up site` is reachable from the machine only: a tool running in another container cannot reach it unless you change the port binding.
- Windows line endings: `.gitattributes` forces LF, because the D2 patch matches a multi-line text.
- Dependabot is told to leave Playwright alone: the version is bumped by hand in `package.json`, the Dockerfile and `expected.json` together.

## Troubleshooting

| symptom | cause and fix |
|---|---|
| `permission denied ... /var/run/docker.sock` | your user is not in the `docker` group: add it (then log in again) or run Docker as root yourself |
| `address already in use` on `up site` | something already listens on 8099 (or 8100): `BENCH_PORT=18099 docker compose up --build site` (`BENCH_FIXED_PORT` for the fixed page) |
| `out/ is not writable by uid ...` or `EACCES` on `out/` | `out/` is missing or owned by root, or your uid is not 1000. Create it with your own user (`mkdir -p out`) and run `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm --build bench`. If Docker created `out/` as root, remove it with the rights you have and start again |
| `FAIL ... stale report` or `drift:` | the report or the image does not match your files: always use `--build` |
| containers left after Ctrl-C on `up` | `docker compose down` |

## License

MIT, see [LICENSE](LICENSE).
