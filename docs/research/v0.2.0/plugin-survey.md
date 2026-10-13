# Existing-plugin survey — initial findings (#4)

Observed 2026-10-13. Evidence comes from checked-out upstream source and GitHub repository/release APIs, pinned in [sources.json](sources.json). No upstream code is copied into Reports. A recent push/release is activity evidence, not a guarantee of maintainability. Chart capabilities below are code/documentation findings, not live Obsidian qualification.

## Maintenance, distribution size and licensing

| Plugin/source snapshot | Latest release / date | Last push | main.js bytes | GitHub-detected licence |
| --- | --- | --- | ---: | --- |
| [JCF-402/datacharts](https://github.com/JCF-402/datacharts/tree/4ac1488b5ac6cf6996b8914941f0e5a310415f2d) | 1.0.7 / 2026-09-06 | 2026-09-06 | 942,815 | MIT |
| [haiqiang-zhang/obsidian-bases-charts](https://github.com/haiqiang-zhang/obsidian-bases-charts/tree/f2c94106c46640b71947c40569fb698e66356b6e) | 0.4.1 / 2026-10-09 | 2026-10-09 | 1,199,684 | GPL-3.0 |
| [kevinmcaleer/obsidian-bases-chart](https://github.com/kevinmcaleer/obsidian-bases-chart/tree/cb8bc85af28e170f6839bbb2e55db234c886a4c1) | 1.4.4 / 2026-06-17 | 2026-06-17 | 261,518 | MIT |
| [phibr0/obsidian-charts](https://github.com/phibr0/obsidian-charts/tree/663814645bbad2e47df2d151cb982fff24a2a0f7) | 3.9.0 / 2024-01-26 | 2024-06-19 | 373,070 | AGPL-3.0 |
| [pyrochlore/obsidian-tracker](https://github.com/pyrochlore/obsidian-tracker/tree/933fa7537580fe79ecf567e83d5cb45ba18139e0) | 1.19.0 / 2026-02-21 | 2026-04-13 | 1,535,450 | MIT |
| [robertoallende/fancy-charts](https://github.com/robertoallende/fancy-charts/tree/0509b828f5ff4b2bc5a6b5b0a530cd7830321c33) | 0.2.0 / 2026-08-24 | 2026-08-25 | 1,592,358 | MIT |
| [zobweyt/obsidian-charts](https://github.com/zobweyt/obsidian-charts/tree/45be486f6b373cdf5f0e1b17426609d45c91323e) | 0.9.2 / 2026-06-21 | 2026-07-18 | 39,449 | MIT |

Sizes cover the entire published plugin: UI, integrations and libraries. They are not directly comparable renderer costs. Check release-tag source separately before reuse; HEAD and release can differ. Fancy Charts package.json still says 0.1.0 while its latest release is 0.2.0. Reports' build script measures raw/gzip/installed bytes and enforces a YAML-only dependency boundary; any renderer change needs a reviewed budget and boundary update.

## Functional comparison

| Plugin | Types and sources | Plotting conventions | Renderer/export and reuse assessment |
| --- | --- | --- | --- |
| Charts (phibr0) | Chart.js registered types plus Sankey; YAML series and Markdown table extraction (`src/chartFromTable.ts`) | Multiple datasets, stacking, axis options and annotation plugin; time adapter. No dedicated labelled SD/SE/CI contract established | Chart.js canvas; image output uses canvas `toDataURL` in `src/chartRenderer.ts`. No portable SVG path established. No recent push since 2024. Learn from UI/options; do not adopt plugin wholesale |
| DataCharts | Line, bar, scatter, pie, doughnut, polar area and radar in changelog; manual data, Markdown tables and mathjs equations | Settings expose linear/category/log scales; function plotting and ranges. Scientific uncertainty contract not established | Chart.js canvas. `helpers/svgFormatting.ts` reconstructs **line only** SVG from live chart pixels, scale ticks and `getComputedStyle(document.body)`; exports use timestamp filenames. Theme, size and layout affect output. Not a deterministic offline renderer |
| Fancy Charts | Eight simple types: bar, line, pie, scatter, area, funnel, heatmap, Sankey; YAML plus Markdown table, advanced ECharts options | Numeric XY scatter; category/value axes in simple mode; full advanced option surface does not imply a validated scientific schema | Modular ECharts + SVGRenderer (`src/render/echarts-init.ts`); DOM SVG view (`renderer.ts`), Obsidian theme. Persistent export not established by inspected renderer. Useful modular import pattern; evaluate ECharts directly |
| Charts for Bases (zobweyt) | Bar/line from Bases properties; category sums and series split | Fixed Y min/max, labels, reference lines, legend and styling | SVG DOM construction, zero runtime dependency approach (Deno build). Small published bundle. Interactive DOM is not a standalone export contract; promising layout/axis ideas under MIT |
| Bases Chart Views (haiqiang-zhang) | Scatter, line, grouped bar, pie/donut; Bases aggregation/grouping; AI raw ECharts config | Axis min/max, grouping, null/gap controls; unrestricted advanced options | Full ECharts import; interactive renderer. GPL plugin code should not be incorporated casually into MIT Reports. Evaluate Apache-licensed engine separately |
| Bases Chart (kevinmcaleer) | Bar/column, pie/doughnut/gauge, line, calendar and stat KPI; SQL over Bases, multiple sources | Labels, bucketing and aggregation; relative dates/today/now need frozen endpoints for reproduction | Chart.js + datalabels; canvas workflow. Useful KPI/query interaction examples; not evidence of deterministic vector publication |
| Tracker (pyrochlore) | Line/bar (including stacked), pie, calendar, summary/bullet; notes/frontmatter/inline fields/tags and expressions | Fixed Y limits, axis labels and multiple datasets documented in `docs/InputParameters.md` | D3 SVG approach, sizeable full-plugin bundle. Useful bounded data collection and summary precedents. Portable export and byte repeatability remain unverified |

For all plugins, user-facing error bars with explicitly identified SD, SE and CI have **not** been established by this initial inspection. Underlying-library flexibility is not evidence of plugin-level support. Histograms may be assembled from bars but that does not establish a binning contract.

## Licensing considerations

Charts has a material discrepancy: root LICENSE is AGPL-3.0, while package.json says MIT. DataCharts root LICENSE is MIT while package.json says 0-BSD. Treat these as unresolved provenance questions before copying code. MIT reuse requires retaining applicable copyright/permission notices. GPL/AGPL plugin code is not interchangeable with permissively licensed underlying libraries. Review exact library versions, transitive notices and any copied algorithms before adoption. This phase copies no upstream implementation.

## Library options and recommendation

| Candidate | Verified capability | Limitations / next evidence |
| --- | --- | --- |
| Current Reports SVG | Pure string rendering, escaped text, stable ordering, title/desc, vector primitives; no chart dependency | Time-only X, auto linear Y, fixed 960×540, two-decimal geometry/ticks, colour-only identification and system fonts. Need layout/tick/font work; renderer-only bundle delta not measured |
| Chart.js | [Canvas API and toBase64Image](https://www.chartjs.org/docs/latest/api/classes/Chart.html); MIT [licence](https://github.com/chartjs/Chart.js/blob/master/LICENSE.md) | No native SVG string export established. A canvas-to-SVG bridge adds a separate translation/layout dependency and verification burden |
| Apache ECharts | [Documented SVG string SSR](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/) with explicit dimensions and animation disabled; Apache-2.0 [licence](https://github.com/apache/echarts/blob/master/LICENSE) | SVG IDs, text metrics, CSS, animation, error-bar custom series and bundle cost require pinned experiments. Zero-dependency SSR means no DOM/canvas prerequisite, not zero engine bytes |
| Vega-Lite → Vega | Declarative compilation and Vega View [toSVG](https://vega.github.io/vega/docs/api/view/); [Vega-Lite BSD-3-Clause](https://github.com/vega/vega-lite/blob/main/LICENSE), [Vega BSD-3-Clause](https://github.com/vega/vega/blob/main/LICENSE) | Compiler + runtime footprint, expression/data-loading controls and font/text measurement require experiments; do not let a second dataflow silently redefine report semantics |
| Custom SVG + selected D3 helpers | [d3-scale](https://github.com/d3/d3-scale) provides independently importable scale utilities under ISC | Helpers do not supply print layout/accessibility. Measure selected imports and retain notices, rather than bundle all D3 |

**Provisional recommendation:** retain the existing renderer for legacy definitions; prefer a narrow pure SVG presentation pipeline for initial fixed-axis/comparison requirements. Compare that against a modular ECharts SSR spike before accepting the ADR. Vega-Lite is a credible declarative alternative if its extra grammar/runtime materially reduces maintenance. Chart.js is a weaker fit for the mandatory vector-output contract.

## Remaining work before P0 acceptance

- Pin candidate engine versions; measure minified raw/gzip delta with Reports' es2018/CJS build settings and transitive licence inventory in an isolated spike, not production dependencies.
- Generate repeated SVGs in one process and fresh processes; vary locale/timezone/theme/host size; inspect IDs, animations, resources, font metrics and escaping. Byte identity is a target, not yet demonstrated for engines.
- Exercise fixed/log axes, negative/zero values, long labels, asymmetric error bars, missing data and small page widths; compare resulting PDF/EPUB fixtures.
- Confirm release-tag versus HEAD export features, documentation contradictions and licence provenance. Investigate upstream test coverage/issue response before relying on a maintainer.

## Initial isolated engine experiment

Exact direct versions: ECharts 6.1.0, Vega 6.4.0, Vega-Lite 6.5.0, Chart.js 4.5.1, d3-scale 4.0.2, esbuild 0.23.1. [Script/run instructions](tools/README.md), [result/inventory](renderer-spike-results.json) and isolated [research lock](tools/renderer-spike-lock.json). The lock belongs to a disposable experiment, not Reports dependencies. npm package licence declarations supplement the upstream licence evidence; they are not a completed legal/notice audit.

| Standalone browser-platform export build, es2018/CJS/minified | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Chart.js registered types | 205,625 | 71,027 |
| Full ECharts | 1,141,634 | 384,496 |
| ECharts line/scatter/bar + grid/legend/title + SVG | 533,910 | 183,266 |
| Vega-Lite compile + Vega View/parse | 783,418 | 270,843 |
| d3-scale linear/log/band | 24,112 | 9,729 |

These are measured standalone retained exports, **not incremental Reports bundle costs**; surfaces differ. Modular ECharts measurement excludes the other proposed types/error-bar custom series. No candidate is installed into Reports.

Repeated simple fixed-domain line renders: ECharts differs in one process (`zr0-cls-0` versus later process counters such as `zr1-cls-4`); both renderer prefix and class counters change. Fresh-process first renders match. Diagnostic remapping of complete class tokens plus clip ID/reference prefixes makes this example equal, but is not a safe general canonicalisation design. Vega outputs match for same-process and fresh-process first renders in this simple example. Neither result qualifies all chart types, font metrics, locale/timezone variation or Obsidian runtime. The proposed adapter must solve repeatability before ECharts adoption; deterministic IDs cannot be assumed from animation being disabled.
