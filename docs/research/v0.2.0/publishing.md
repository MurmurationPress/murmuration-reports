# Bounded publication compatibility review (#10)

Status: **Accepted for the bounded first milestone**, following the independent review in [p0-acceptance.md](p0-acceptance.md). Reports production code remains at `262f11630da4fd5848ce6e82013c9ad1a0b25b23`; initial research `b1b48e74b86dc84afffe3946588edfa6fd817dba`; revised fixtures/harness `8f47104ca36a66f31554f492640fc56bb0f08f6d`. Historical baseline compiler: `93af44922cdb1b83b6166c4f8429d7d9f5b32c07`. Current verified compiler: [`394cf109f035194b440e3b37d75de06e49fe074d`](https://github.com/MurmurationPress/codex-press/tree/394cf109f035194b440e3b37d75de06e49fe074d), merged through PR #146.

## Publication widths and sizing policy

Proposed supported **design** placements: narrow 3.5in (252 PDF pt), normal 4.1in (295.2 pt), wide 5.5in (396 pt), with the inclusive 3.5–5.5in range bounded by these specimen checks. These are image widths, not trim/page widths. Use narrow/normal within KDP 6×9 and wide within A4 when its available body width permits. A callout/multicolumn placement reducing width below 3.5in needs a separately fitted layout and later qualification. Do not apply a 3.5in minimum to EPUB reflow or screen zoom; those need their own reader checks.

Targets: **≥8 PDF pt for all chart labels, units, legends and internal captions; ≥0.5 PDF pt for essential axes, series, marker outlines and error-bar strokes**. Decoration must not carry essential information. No colour-only identification. External prose/table text follows the publishing profile, with its own layout review. These are proposed engineering minima, not proof of comfortable physical reading or an accessibility standard.

For a 720-unit SVG printed at width W inches, one unit = `72W/720` PDF pt. These are PDF points (72/in), distinct from TeX points (72.27/in). SVG unit sizes alone cannot guarantee final size.

| SVG size | At 3.5in | At 4.1in | At 5.5in |
| --- | ---: | ---: | ---: |
| Old 18-unit text | 6.30pt | **7.38pt** | 9.90pt |
| 24-unit text, theoretical design minimum | 8.40pt | 9.84pt | 13.20pt |
| Revised 32-unit labels | 11.20pt | 13.12pt | 17.60pt |
| Revised four-series 36-unit labels | 12.60pt | 14.76pt | 19.80pt |
| 2-unit essential stroke | 0.70pt | 0.82pt | 1.10pt |
| Revised 3-unit essential stroke | 1.05pt | 1.23pt | 1.65pt |

The revised specimens use 32-unit labels (36 for the taller four-series figure), 3-unit strokes, wrapped captions, matching legend markers and increased spacing. This larger reserve is necessary under the **historical compiler's further height-based reduction**. It is a specimen solution, not a universal production font size: the future layout must compute actual placement/fit, diagnose overflow and never shrink text below the target. Do not convert this into an implicit change to old chart bytes.

### Historical compiler limitation — resolved by merged #146

The following baseline evidence is retained for provenance, **not current behaviour**. Fresh merged-compiler results in [p0-acceptance.md](p0-acceptance.md) and [merged-compiler-results.json](merged-compiler-results.json) verify distinct requested placements, final text sizes and captions. #145 is resolved; #144 remains separate.

`src/exporters/pdf/asset-plan.ts` preserves authored attributes in the plan, but `src/exporters/pdf/lua-filter.ts` `codex_image_latex` replaces ordinary images with `width=0.92\\linewidth,height=0.33\\textheight,keepaspectratio`, ignoring authored width/height. Requested 3.5in and 4.1in produce pixel-identical report-page renders. The revised tall KDP specimens actually measure **2.68320in**, and the four-series specimen **2.42355in**. A4 also uses its own capped placement rather than the requested 5.5in.

Before correction, 24-unit four-series labels measured **5.81652pt** in KDP. Corrected final PDFs now meet typography minima at those smaller actual widths: minimum label **8.58624pt** and essential stroke **0.727065pt**; A4 minimum figure label **11.76672pt**. Passing typography does **not** establish the 3.5–5.5in placement contract. Separate compiler follow-up: [Codex Press #145 — Respect authored report image sizing in PDF within page constraints](https://github.com/MurmurationPress/codex-press/issues/145).

Direct librsvg conversion **does** honour the three requested widths. [44 exact-width checks](direct-width-results.json) cover all eleven SVGs at 3.5/4.1/5.5in with the reference font and 3.5in with the fallback, including measured labels/strokes and text bounds. They establish standalone SVG-to-PDF sizing, not end-to-end Codex Press sizing. The historical width blocker is now resolved by the independently reviewed merged compiler; standalone conversion remains separate evidence.

## Practical font and fallback policy

Use the explicit family list **`DejaVu Sans, Liberation Sans, Arial, sans-serif`** for the opt-in publication layout. Reference publishing font: installed DejaVu Sans 2.37 (Debian package 2.37-8); qualified fallback for these specimens: installed Liberation Sans 2.1.5 (package 1:2.1.5-3). Arial/generic sans-serif are viewing fallbacks, **not print-qualified by these checks**. Require the publishing operator to verify the actual resolved font and rerun sizing/overflow checks after substitutions. No reliance on `system-ui` or Obsidian theme fonts for new publication layouts; old default layout remains unchanged.

No font binary, web font, external URL, embedded font dependency or outlined text is introduced. SVG remains self-contained in resources; font resolution is a documented host dependency, so identical SVG bytes do not promise identical visuals on all readers. The converter embeds the selected font subset into the observed PDF, verified in its font resources. Unsupported glyphs/long unbreakable text require a future layout diagnostic or deliberate author shortening; do not silently omit labels. The evidence covers the synthetic Latin/month/unit/math symbols used here, not every script/glyph.

The default local Fontconfig resolver unexpectedly chose an OpenDyslexic-named file when asked for DejaVu Sans. Therefore the research isolated Fontconfig **only for rsvg-convert**, selecting the actual DejaVu or Liberation directory and verifying PDF font names. Applying that configuration to all tools initially hid Latin Modern Mono from XeTeX; the final wrapper scopes it correctly and leaves compiler/source/tool installation unchanged. Exact font hashes/tool versions are in [results](publication-review-results.json).

Font use/redistribution remains subject to exact notices: [DejaVu licence](https://dejavu-fonts.github.io/License.html), [Liberation licence](https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE), and the installed distribution's copyright files. This policy installs/distributes no font. Any future font bundling requires its own licence/notice decision.

## Verified existing pathway and historical baseline digital checks

Current final checks are the fresh exact-merge matrix in [p0-acceptance.md](p0-acceptance.md); the baseline table below documents the earlier height-cap behaviour.

Markdown transclusion recognises saved SVG/SVGZ as media and saved Markdown as content. PDF stages/normalises SVG and converts via librsvg before Pandoc/XeLaTeX. EPUB normalises package SVG/SVGZ names/media types without rasterising these reports. PDF table filters measure row packets and use breakable wrappers/repeated continuation headings; [existing table evidence](https://github.com/MurmurationPress/codex-press/blob/93af44922cdb1b83b6166c4f8429d7d9f5b32c07/docs/pdf-table-pagination-validation.md) remains distinct from this research.

[Final results](publication-review-results.json), [research commands](tools/README.md). Exact toolchain: Node v24.19.0; Python 3.12.3; PyMuPDF 1.26.5; Pillow 11.3.0; Pandoc 3.1.3; XeTeX 3.141592653-2.6-0.999995 / TeX Live 2023/Debian; librsvg 2.58.0; Fontconfig 2.15.0; EPUBCheck 5.3.0. Research Python packages live in a disposable venv; production dependencies are unchanged. Artifacts remain under `/tmp/reports-p0-verified`; no manuscript or compiled book is committed.

| Run | Digital evidence |
| --- | --- |
| Reference requested 3.5in, KDP 6×9 | 32 pages; report-bearing pages 7–31 all rendered/visually reviewed; 11 figures; ≥8.58624pt chart text; no extracted text outside SVG/page bounds; 80 row markers once; continuation headings on pages 15–31 |
| Reference requested 4.1in, KDP 6×9 | Same effective figure sizes and **pixel-identical report-page renders**, hash-checked against 3.5in; all pages checked. EPUBCheck zero errors/warnings; 11 SVG payloads byte-identical to fixtures |
| Reference requested 5.5in, A4 | 20 pages; report-bearing pages 7–20 rendered/visually reviewed; ≥11.76672pt figure text; all rows once and headings on pages 13–20 |
| Liberation fallback requested 3.5in, KDP | 32 pages; report-bearing pages 7–31 rendered/visually reviewed; resolved LiberationSans font resources; same minimum point sizes, all rows and bounds checks |

Review covered every report-bearing page in the matrix using greyscale renders/contact sheets, with full-size chart-page inspection to correct tick/axis spacing, captions, radar label spacing and scorecard borders. Plot/legend dash-and-marker identities remain distinguishable without colour; filled/outlined bars and directly labelled circular plots do too. SVG text-presence and text-bound checks supplement visual review. Essential stroke minima are calculated from the **observed final placement transform**, not requested width. These checks are bounded digital evidence, not a complete mathematical proof of every geometry intersection.

Known limits visible in those pages: prose descriptive alternatives can flow onto the next page; captions **inside** the SVG stay with the plot. Narrow five-column table headers/parameter names wrap and hyphenate heavily without overlap or dropped rows; richer table column-width design is later #8 work. Broad chart/KPI specimens are illustrative layouts, not implemented or semantically qualified report types. Historical [initial results](publication-results.json) belong to commit b1b48e7 and its old fixtures; they must not be mistaken for the current source/output hashes.

## Bounded acceptance and pending qualification

- **Before implementation starts:** explicit P0 review of custom SVG, proposed fields/legacy compatibility, exact pair semantics, minimum-size/font/overflow policy, and the exact-merge compiler-placement verification. These bounded start gates are satisfied by the recorded review; implementation merge gates below remain outstanding.
- **Before future implementation merges:** replay old bytes and receipt/safety cases; test all new validation/selection/layout rules; build measurements; render actual implementation outputs at supported widths; review all report pages and saved assets with plugins disabled. No hand-authored specimen proves unimplemented behaviour.
- **Before print/release claims:** actual-size greyscale physical proof and real publishing/product flows. No physical proof has been performed. Broader chart, uncertainty, KPI, arbitrary glyph, narrow callout, oversized-row and all-reader scenarios have separate later acceptance work.
- **EPUB/readers/accessibility:** EPUBCheck and exact SVG payloads are digital packaging evidence only. No representative EPUB/Kindle/assistive-technology reader is qualified. [Codex Press #144](https://github.com/MurmurationPress/codex-press/issues/144) remains separate compiler accessibility work. All observed PDFs report **Tagged: no**; accessible PDF output has not been established.

The detailed gate/dependency and explicit-reference contracts are in [first-milestone.md](first-milestone.md). Bounded research acceptance follows the explicit review and fresh validation in [p0-acceptance.md](p0-acceptance.md), not documentation edits alone. Later qualification is tracked in [#12](https://github.com/MurmurationPress/murmuration-reports/issues/12).
