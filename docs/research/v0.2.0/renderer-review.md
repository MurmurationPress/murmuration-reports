# Renderer recommendation for the first milestone

Status: **custom SVG accepted for the first milestone only**; [review record](p0-acceptance.md). This comparison decides only fixed Y bounds, plain explanatory captions, four dash/marker identities and explicit-pair Markdown comparisons. It is not a renderer selection for the complete chart/KPI roadmap.

## Evidence and scope

Baseline Reports production code is unchanged from `262f11630da4fd5848ce6e82013c9ad1a0b25b23`; original research commit `b1b48e74b86dc84afffe3946588edfa6fd817dba`; review fixtures/scripts pinned at `8f47104ca36a66f31554f492640fc56bb0f08f6d`. Engine dependencies come from the existing isolated [research lock](tools/renderer-spike-lock.json), not Reports' dependency files. ECharts 6.1.0, Vega 6.4.0 / Vega-Lite 6.5.0, esbuild 0.23.1, Node v24.19.0. [Script](tools/renderer-review.mjs), [results](renderer-review-results.json).

Four synthetic series use the same ordered values as `line-four-series.svg`; candidate configurations request fixed −1…+1 domains, captions, dash/marker identity and 24-unit DejaVu Sans text. The existing renderer is exercised **unchanged** for repeatability/compatibility evidence, not misrepresented as having the proposed options. The research SVG specimen is hand-authored, not a prototype implementation. Formats/layouts are not pixel-equivalent. Both candidate outputs convert with librsvg after using separate ECharts font properties.

| Option | Bounded evidence | Decision implication |
| --- | --- | --- |
| Existing custom SVG | Two repeated calls match exactly; first-render bytes also match across UTC/C and Auckland/en_GB processes; sources contain no DOM/theme/viewport queries. Headless SVG generation already exists. Legacy layout remains too small at narrow publication widths, with one observed date-label extent beyond its SVG bounds in this isolated font environment | Extend opt-in layout and pure presentation helpers; keep legacy default bytes unchanged. No new engine/scale dependency is necessary for these four features |
| ECharts SVG SSR | Correct fixed domain, four styles and visible caption/legend in the specimen; converted text at 3.5in is ≥8.40039pt. Consecutive chart instances change class/clip IDs, while fresh-process first renders match across the two environments | Technically viable for later broader scope, but importing an engine plus ID/reference canonicalisation and adapting ownership/layout creates more work than this milestone needs |
| Vega-Lite → Vega | Four-series repeated and fresh-process SVG bytes match across tested environments; valid converted SVG. Automatic total width grows to 922 units; 24-unit text becomes 6.55957pt at 3.5in. Visible point/legend contrast needs further styling. Bounds fit the expanded SVG | Grammar can express the requirements, but it does not eliminate publication layout or style qualification. Extra compiler/dataflow runtime is unjustified for this small milestone |
| Chart.js | Verified canvas/image API; no native SVG string exporter established by API/source survey | A vector bridge would be an additional unqualified path; exclude from this milestone |
| D3 helpers | Standalone scale import costs already measured; current renderer already has linear scaling/tick logic | Defer helpers. No scale-helper code is copied or installed |

The ECharts caption experiment first used a quoted font shorthand (`font: 24px "DejaVu Sans"`), which was emitted as invalid XML in a style attribute. Using `fontFamily` and `fontSize` separately produced valid XML. Record this concrete limitation instead of claiming that every ECharts option is portable. No generic output repair/canonicaliser was implemented.

No DOM/theme is involved in these headless runs. `REPORTS_RESEARCH_THEME` was an informational flag, not a simulated Obsidian theme implementation. Locale/timezone coverage is exactly two environments; no all-platform or arbitrary-input determinism claim. SVG byte equality does not imply identical font metrics or accessible PDF output.

## Bundle evidence: three distinct measures

1. **Standalone exports:** original [spike results](renderer-spike-results.json): modular ECharts line/scatter/bar 533,910 raw / 183,266 gzip bytes; Vega-Lite compile + Vega View/parse 783,418 / 270,843 bytes. These have different retained feature surfaces and are not Reports integration costs.
2. **Hypothetical coexistence probe:** export the current Reports plugin and retain the stated candidate engine exports in a scratch es2018/CJS/minified browser bundle (only Obsidian external). No production file/dependency is changed. Baseline 164,968 raw / 51,442 gzip bytes; ECharts line + grid/legend/title/graphic/SVG 682,495 / 229,293; Vega-Lite+Vega 948,840 / 322,307. Raw differences are +517,527 and +783,872 bytes. This deliberately retains engine exports alongside the current implementation, includes no adapter/migration and omits the production licence banner. It is a comparison probe, **not actual integration cost**.
3. **Actual integration:** not measured because no proposed architecture or engine is integrated. The custom SVG recommendation adds no engine dependencies; its eventual parser/layout/test code size and startup/generation costs still require measurement during implementation. Do not call the custom option zero total cost or assign a final numerical bundle budget before that code exists.

The isolated probe corrects the earlier temptation to treat a standalone engine build as an integration delta. It provides enough order-of-magnitude evidence to avoid an unnecessary engine migration for this bounded milestone. An actual-integration benchmark of an unselected engine is not a start gate for custom SVG.

## Recommendation and limitations

Recommend **custom SVG, with no new chart or scale library**, plus existing Markdown table output. Keep the coordinator/receipts/recovery boundary; add pure validation/selection/presentation helpers as needed without a broad architectural rewrite. Preserve default rendering/selection bytes; new features require explicit opt-in as specified in [first-milestone.md](first-milestone.md).

Bounded start gates are satisfied by the explicit contract review and merged [Codex Press #145](https://github.com/MurmurationPress/codex-press/issues/145) evidence in [p0-acceptance.md](p0-acceptance.md). Implementation merge gates remain open in #12. Statistical plotting, larger chart-type scope, engine startup benchmarks, copied-plugin licensing and reader/accessibility qualification are later gates unless the chosen scope changes. Compiler accessibility remains separate [#144](https://github.com/MurmurationPress/codex-press/issues/144); no accessible PDF has been established.
