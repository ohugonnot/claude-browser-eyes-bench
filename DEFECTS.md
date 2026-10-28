# Known defects

Ground truth for `site/`. The page itself never describes them; this file is the only place that does.
`site-fixed/` is the same page with exactly these defects removed (see [How site-fixed is made](#how-site-fixed-is-made)).

Viewports: mobile 390x844 (`devices['iPhone 15']`), tablet 820x1180 (`devices['iPad (gen 7)']`), desktop 1440x900.

| id | defect | where | viewport | engines | detected by |
|----|--------|-------|----------|---------|-------------|
| D1 | Horizontal overflow: a block fixed at 600 px wide. | `.grille-tarifs` in `css/style.css` | mobile (absent at 820 and 1440) | all | rendering (`scrollWidth` vs width) |
| D2 | Card text cut: fixed height of 90 px with `overflow:hidden` between 700 and 900 px wide; the absolutely positioned title also touches the text. | `.carte`, `.carte-titre`, `@media (min-width:700px) and (max-width:900px)` | tablet (absent at 390 and 1440) | all | rendering (`scrollHeight` > `clientHeight`); the slight title overlap is visible in the screenshot but not detected |
| D3 | Two buttons 26 px high with 0 px between them. | `#btn-like`, `#btn-partage` (`.action-compacte`) | all | all | rendering (size and distance) |
| D4 | Hero in `height:100vh` with its button glued to the bottom edge. On a real iPhone in Safari, `100vh` is the height with the address bar collapsed, so the bar hides the button (expected behaviour, not verified on a real iPhone here). | `.hero`, `.hero .cta` | real iOS Safari only | none of the three headless engines | static heuristic only: a rule with a `vh` height. Not reproducible by rendering: in all three engines `100vh` equals `innerHeight`, even with the iPhone 15 descriptor |
| D5 | `height: calc-size(auto, size + 24px)` after a 40 px fallback. Engines that do not know `calc-size()` drop the declaration, the panel stays 40 px high and its text spills over the next section. | `.encart` in `css/style.css` | all | Firefox 157 and WebKit 27.2; not Chromium, which supports it (so it is not a defect there) | stylesheet text + `CSS.supports` |
| D6 | Uncaught error on click: `calculerTotal` is not defined. | `#btn-calcul` in `js/app.js` | all, on click only | all | `pageerror` event after pressing the button |
| D7 | Request answered 404: `GET api/promotions.json` at load. | `js/app.js` | all | all | `response` event |
| D8 | `<img>` with no `alt`, and a caption in `#aaa` on `#fff` (contrast 2.32:1, under 4.5:1). | `#galerie img`, `.legende` | all | all | rendering (DOM attribute, computed colours) |

Expected result per engine (`bench/expected.json`): Chromium 7 of 7 applicable defects (D5 does not exist there), Firefox 8 of 8, WebKit 8 of 8.

## Deliberate non-defects

Everything else on the page is clean on purpose (touch targets of at least 44 px, readable contrast, labelled form fields, a valid link, no favicon request), so that a report of anything else is a false positive and `site-fixed/` can reach zero findings.

## How site-fixed is made

`bench/make-fixed.mjs` holds one patch per defect (9 text replacements and 1 added file; D4 and D8 each need two). `node bench/make-fixed.mjs` rewrites `site-fixed/` from `site/`; `node bench/make-fixed.mjs --check` fails if the committed copy differs, and `bench/check.mjs` runs that check. So the gap between the two pages is exactly the list above:

| id | fix |
|----|-----|
| D1 | `max-width:600px` instead of `width:600px` |
| D2 | fixed height, `overflow:hidden` and absolute title removed |
| D3 | `min-height` and `min-width` 44 px, 8 px margin |
| D4 | `min-height:100dvh`, button in the flow (`margin-top:auto`), safe-area padding |
| D5 | `height:auto` |
| D6 | `calculerTotal` defined in `js/app.js` |
| D7 | `api/promotions.json` added (new file) |
| D8 | `alt` text on the image, caption colour `#595959` |
