You are auditing a web page for defects, WITHOUT a browser. The page's source files (HTML, CSS, JS, images) are in the directory given below; read them with your file tools. You cannot run or render the page.

Reason about how it would behave at three viewports: mobile 390x844, tablet 820x1180 and desktop 1440x900.

Find every real defect you can establish from the source. Look at: layout (horizontal overflow, clipped or overlapping content), usability on touch screens (size and spacing of tap targets), accessibility (missing alt text, contrast), console errors, failed network requests, and anything that is likely to break on iPhone Safari.

Report each defect as: an id (X1, X2, ...), a one-line description, the viewport(s) where it appears, and your evidence (the file and line, and your reasoning). Do not report things that are not defects, and do not pad the list.
Finish with the complete list as your final message. You may use at most 40 tool calls.
