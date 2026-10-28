# Judging rubric

This is the rubric given to the blind judge (a model different from the one being measured). The judge read the anonymised reports (`R01` ... `R12`), the list of known defects ([`../DEFECTS.md`](../DEFECTS.md)) and the code of the page, and opened nothing else from the experiment: not the condition behind each report, not the costs, not the mapping file. To check numbers it could render its own copy of the page with headless Chromium.

The page has eight known defects, D1 to D8. Their ground truth is in [`../DEFECTS.md`](../DEFECTS.md); in short:

| id | defect |
|----|--------|
| D1 | horizontal overflow on mobile: a block fixed at 600 px wide |
| D2 | card text cut on tablet: fixed 90 px height with `overflow:hidden` between 700 and 900 px, title overlapping the text |
| D3 | two 26 px high buttons with 0 px between them |
| D4 | hero in `height:100vh` with its button at the bottom edge: hidden by the address bar on a real iPhone in Safari |
| D5 | `height: calc-size(auto, size + 24px)` after a 40 px fallback: engines that do not know `calc-size()` (Safari, Firefox 157 at the time) keep 40 px and the text spills over the next section |
| D6 | uncaught error on click: `calculerTotal` is not defined |
| D7 | `GET api/promotions.json` answered 404 at load |
| D8 | `<img>` with no `alt`, and a caption with a contrast of 2.32:1 |

## What is scored, per report

1. **Each of D1 to D8 is graded T, P or M.**
   - **T (found)**: the report names the defect, where it appears, and gives a cause or evidence that is consistent with the page.
   - **P (partial)**: the defect is seen but its cause is wrong or its description is incomplete in a way that matters (see the rules below).
   - **M (missed)**: not in the report.
2. **False claims.** A false claim is a statement the page contradicts: a wrong cause, an invented detail, a defect that is not there. They are checked against the CSS/JS text and, when numbers are involved, against a render of the page. A *minor* false claim is counted separately from a plain one. A measured number is never called false just because it is approximate (see the viewport rule below).
3. **Real defects outside the list.** Things that are really wrong on the page but are not D1 to D8 (verified against the code) are counted for the report but are not false claims.
4. **Dominant evidence.** How the report supports its findings: *measured* (numbers from a rendered page), *read in the code* (file and line quoted), or both. When D4 is reported from knowledge of iPhone Safari rather than from anything observed, it is labelled "assumed".
5. **Score out of 10.** A holistic grade that takes into account coverage (how many of the eight were found), accuracy (false claims cost points) and the quality of the evidence (measured, traceable to the code). There is no formula: each score comes with a short written justification, so that it can be audited finding by finding.

Anonymisation is only lexical (see the README), and the style of evidence (`file:line` versus measured `scrollWidth`) can still hint at the condition: the grade is meant to follow the content of the findings, not the style.

## Grading rules applied

These rules settle the cases that came up repeatedly, so that the same case is graded the same way in every report.

- **D1 is P** when the report attributes the overflow to a line of text that "would not wrap". The real cause is `width:600px` on `.grille-tarifs` (`css/style.css:11`); the text does wrap (the box is 600x74, two lines). The claim is also a false claim.
- **D3 is T** as soon as both the small size (26 px) and the missing gap are reported, even in the form "almost no gap". It is P when the 0 px gap is not mentioned at all.
- **D4 is T** when the report flags the risk of `100vh` on iPhone Safari, even without reading the CSS. In that case the evidence for D4 is "assumed".
- **D5 is T** when the report says that `calc-size()` is not supported by Safari or by engines that do not know it. (In Chromium the defect does not exist, so it cannot be seen in a Chromium render.)
- **Real defect outside the list.** The "Retour" link of `a-propos.html` was, at the time, an unstyled inline link about 17 to 19 px high. That is under the 44 px threshold the page applies everywhere else, while `DEFECTS.md` states that all targets are at least 44 px. It is therefore counted as a real defect outside the list, not as a false claim. Reservation: it passes WCAG 2.5.8 through the spacing exception, as it is the only target of its page. The same reasoning applies to the absence of a stylesheet and of a `<main>` element in `a-propos.html`. (The link was fixed afterwards, in the commit that follows the one the experiment ran on: see the README.)
- **Approximate hero heights are not counted as false.** Figures such as "about 450 px" of empty space at 390, "about 760 px" or "about 800 px" of hero, or "about 750 px" at 820 depend on the viewport really used. At 390x844 the empty space is 668 px; at 390x659, the real height of Playwright's iPhone 15 descriptor, it is 483 px. Such figures are reported by the judge but not penalised.
- **Measurements that depend on the font** (width of buttons, height of cards) are only checked for the order of magnitude: the judge's own render uses a different font, so a few pixels of difference is not a refutation.
