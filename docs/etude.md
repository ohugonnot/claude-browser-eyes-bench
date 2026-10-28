# Figures of the study

These are the study's own figures, copied as they are in its notes (in French, not reworded). They were **not** produced by this repository, which does not reproduce them identically. The source is the author's study notes (`essais.md`, section 2, rows 2a, 2b and 2c), which are not part of this repository; the blog post that will present them is "to come". French readers: the [French README](../README.fr.md) has the same table.

## Setup (study)

WSL2 host, everything run in Docker, image `mcr.microsoft.com/playwright:v1.64.1-noble`, Playwright 1.64.1 as a script (candidate 2), 3 passes per candidate, median.

## Table (verbatim)

The last column of the study's table (size of the output read by the agent) is left out here: it is about the agent's context, not about the engines.

> Durées en ms, médiane des 3 passes (écart max-min entre parenthèses). « Démarrage » = du lancement du processus/client à la première capture reçue. « Total » = tâche complète (3 viewports, capture pleine page, audit, clic sur chaque bouton, console, réseau).

| # | Candidat (version) | Moteur lancé (lu dans le navigateur) | Démarrage | Total | Défauts |
|---|---|---|---|---|---|
| 2a | playwright 1.64.1 script, chromium | 156.0.8078.4 (rev 1248) | 5 778 (122)* | 7 158 (58) | 7/7 |
| 2b | idem firefox | 157.0 (rev 1555) | 2 269 (77) | 4 406 (114) | 8/8 |
| 2c | idem webkit | WebKit 27.2 (rev 2370) | 1 916 (131) | 3 748 (177) | 8/8 |

> `*` Explications dans les détails : 2a et 3 (Chromium émulation iPhone) perdent 3 s sur un clic qui expire.
>
> Stabilité : 0 échec sur 3 passes pour tous.

Reading note: in the study, "7/7" and "8/8" count D4 (`100vh`) as found, but only through a static CSS rule, never through rendering (in all three engines `100vh` equals `innerHeight`). Chromium has 7 applicable defects because D5 (`calc-size()`) does not exist there.

## Why this repository gives other numbers

- The page here is a reworded and cleaned version of the study's page (neutral texts, base page free of unrelated accessibility warnings, a 44 px minimum on the form controls), so the durations were not measured on this exact page.
- `out/report.json` has `launchMs` (browser launch) and `totalMs` (launch to close, for the three viewports, or the one viewport of the canary). Neither is the study's "Démarrage" or "Total", whose clocks and tasks differ.
- This repository's runner also dispatches the click itself when a real one times out under Chromium touch emulation, and records it.
- Nothing in this repository checks these figures: `bench/check.mjs` verifies defects, not durations.
