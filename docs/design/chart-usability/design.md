# Chart usability milestone — design before implementation

Status: implementation proposal for review, 2026-10-14. Epic #3; broader #6 and numeric-X design remain open. Builds on accepted ADR 0001 without extending its acceptance to new capabilities. Custom SVG, no chart dependency; no release or asset migration.

## Primary-source comparison and selected conventions

[Chart.js linear axes](https://www.chartjs.org/docs/latest/axes/cartesian/linear.html) distinguish hard min/max, suggested bounds, include-zero and tick step/precision. Adopt independent hard numeric endpoints, nice automatic bounds and an include-zero policy; never adopt silent clipping or observation rounding. [Chart.js axis titles](https://www.chartjs.org/docs/latest/axes/labelling.html) expose separate axis titles/alignment; [line datasets](https://www.chartjs.org/docs/latest/charts/line.html) separate property data from display labels. Adopt centred axis titles and explicit editable labels, preserving keys. [ECharts axis handbook](https://echarts.apache.org/handbook/en/concepts/axis/) separates axis name, ticks and labels and illustrates rotated names, label units and legends. Adopt separation and reserved layout space, not interactive runtime rendering. The engine configuration documents are not evidence for a particular editor UI: use Reports' own accessible HTML fieldsets instead of claiming that Chart.js/ECharts prescribe tabs.

## Compatibility and schema

Only `presentation: publication-v2` enables this milestone's axes/layout. Absent, opaque modes, `legacy` and existing `publication` retain their exact render path/defaults and output bytes. No automatic rewriting or regeneration. Existing paired numeric `y_min`/`y_max` remain supported in v2 when `y_axis` is absent, retaining hard bounds while deliberately opting into new ticks/title layout. With `y_axis` supplied, old paired bounds must be removed explicitly in the source note to avoid contradictory settings; guided controls preserve opaque fields and diagnose the conflict.

```yaml
presentation: publication-v2
y_axis:
  minimum: zero   # auto | zero | finite number
  maximum: auto   # auto | finite number
  ticks: auto     # auto | integer | {step: positive finite number}
x_axis_label: Observation Date
y_axis_label: Boundary Orientation
y_axis_unit: score
caption: Scores are assessments, not probabilities.
description: Two dated observations across four monitoring sites.
```

Absent v2 y_axis/leaf values default to auto. Description is optional plain descriptive text (240 code points), appended to generated SVG description, not a second managed output. Existing axis-label fields remain title text; optional x_axis_unit/y_axis_unit are appended in parentheses. No automatic unit inference. New fields in old modes remain inert.

## Bounds and ticks

Compute domain after unchanged whole-source validation and date/window selection. Independent numeric endpoints are hard: reject selected outliers with path/property/value context and never expand them. Resolved min must be below max. `zero` means include zero AND all selected data: nonnegative data starts at zero; mixed-sign data keeps its negative lower bound; all-negative data extends automatic maximum to zero. An explicit negative maximum contradicts include-zero and fails. UI must describe this as inclusion, not claim negative data starts at zero.

Automatic endpoints round outward to multiples of a deterministic 1/2/2.5/5 × power-of-ten nice step, targeting about five intervals. Example .18–.96 with zero/auto yields domain 0–1, ticks 0/.2/.4/.6/.8/1, with original fractional values unchanged. Constant/single data first gets magnitude-relative padding (zero uses ±1); overflow or unrepresentable domains fail with instructions to set finite readable limits.

Ticks are independent of endpoint policy. Integer mode selects a nice step ≥1 and emits only integer grid ticks; fractional data retains exact numeric geometry and explicit fractional endpoints stay exact, even when not ticked. Positive explicit steps use a zero-anchored grid inside the domain; off-grid endpoints are not fabricated as step ticks. Auto also uses grid ticks. Domain remains in SVG description. Empty grids, nonrepresentable index/step arithmetic, >9 ticks, non-distinct labels or vertical label spacing below 48 units block with actionable diagnostics. Never silently hide configured ticks, shrink text, coerce strings or round observations. Tiny/large domains can diagnose rather than promise every IEEE-754 interval can be printed legibly.

## Layout, labels and discovery

V2 reserves a gutter for a vertical Y title, tick labels and units; X title is centred under the plot. Use existing qualified-font/glyph policy, 32-unit text, 3-unit strokes and 960-unit width. A 480-unit plot height accommodates tick/title spacing; bounded wrapped titles, legend, caption and total height ≤1440 block overflow. Rotation has deterministic reserved bounds, not browser/font measurements. Supported publication widths remain 3.5/4.1/5.5in where compiler fitting allows ≥8pt text and ≥0.5pt strokes. Four existing dash/marker identities remain unchanged.

Humanisation splits underscores and camel/acronym boundaries, uppercases initial lower-case letters, retains uppercase acronyms, numbers and punctuation. Examples boundary_orientation → Boundary Orientation, completedPages → Completed Pages, HTTPStatus2 → HTTP Status2. Never mutate property keys. In a new/blank series row, picking a property creates an editable materialised label; later property edits refresh it only while session-generated and unedited. Editing the label makes it an override. Saved/reopened labels are explicit and never refreshed automatically, even if equal to a generated spelling.

Discovery is an explicit read-only operation: resolve the actual folder, read every Markdown descendant through the existing adapter and inspect the union of keys. Report humanised display, exact key, observed types, missing count and incompatible/nonfinite values with source diagnostics. ISO-date strings remain a distinct date type, numeric strings remain strings; mixed types never coerce. Configured properties not discovered remain editable and unchanged. Discovery is not a transactional generation snapshot or a guarantee selected properties pass whole-source generation. Errors/unreadable notes do not become empty valid data. Async results cannot replace a changed draft/source or closed UI.

## Editor and implementation split

Use always-visible fieldsets Data, Axes, Appearance, Publication, followed by persistent destination/save/generate/source-repair controls. This avoids hidden-field errors and tab state/focus loss. Data: actual dataset/X date property/Y keys and date selection. Axes: title/unit/bound/tick policy. Appearance: chart/subtitle, editable series labels, retained fixed identities/legend. Publication: presentation, caption/description and output. Labels stay associated with controls; errors use a live region and focus the relevant visible input when identifiable. Grouping alone does not alter schema or generate assets.

1. Pure v2 schema/domain/ticks/layout; byte compatibility against both legacy and merged-publication baseline.
2. Pure humanisation/discovery + fresh adapter reads, retaining manually configured properties.
3. Grouped manager controls, explicit opt-in, source-preserving leaf patches, diagnostics and native checks.
4. Feature-generated publication matrix and actual bundle/CI evidence; review before merge.
5. Numeric-X design only, separately reviewed before implementation. Proposed explicit x_type numeric, finite whole-source numeric validation; scatter displays every point, line sorts by X with path tie ordering and rejects duplicate X initially rather than inventing aggregation. Date start/end/window are invalid in numeric mode. No cosmetic terminology change activates this proposal. Whether duplicate-X lines should instead draw vertical segments remains a Ted/reviewer decision for that later issue.

## Synthetic before/after and acceptance

Before: existing publication definition of .18/.96 has five ticks .18/.375/.57/.765/.96 and horizontal Y title above plot. After explicit v2: zero/auto, six .2-step ticks on 0–1, vertical title alongside and centred X title. Existing definition/output remains unchanged until deliberate opt-in and guarded regeneration. Numeric-X, log axes, statistics, new chart families, variable styles/KPIs/percentage changes remain outside implementation.

Tests must cover independent fixed endpoints and outliers, zero/mixed/negative, integer ticks with fractional values, explicit-step overflow, constants/subnormals/large values, source preservation and both old byte paths; discovery all-note/missing/type/scope failures; generated-label override lifecycle. Exercise actual native groups/focus/save/preview in a disposable vault and publish actual generated assets through exact current merged compiler. Physical-print, EPUB/Kindle/AT and accessible-PDF qualification remain separate #12 work; do not claim these from synthetic conversion or EPUBCheck.
