# Chart usability milestone — design before implementation

Status: implementation proposal for review, 2026-10-14. Epic #3; broader #6 and numeric-X design remain open. Builds on accepted ADR 0001 without extending its acceptance to new capabilities. Custom SVG, no chart dependency; no release or asset migration.

## Primary-source comparison and selected conventions

| Concern | Chart.js documentation | Apache ECharts handbook | Reports convention |
| --- | --- | --- | --- |
| Endpoints/ticks | [Linear scale](https://www.chartjs.org/docs/latest/axes/cartesian/linear.html) distinguishes hard `min`/`max`, suggestions, include-zero, tick step/precision and automatically generated ticks. | [Axis handbook](https://echarts.apache.org/handbook/en/concepts/axis/) shows value-axis min/max and unit formatters. | Independent explicit endpoints are hard and reject outliers; automatic endpoints round outward. Tick policy is separately automatic, integer-only or explicit positive step. No silent label skipping or data rounding. |
| Titles/units | [Axis labeling](https://www.chartjs.org/docs/latest/axes/labelling.html) provides a separate axis title, alignment, text and font/padding. | The [axis handbook](https://echarts.apache.org/handbook/en/concepts/axis/) models line, ticks, labels and title independently, with X below and Y left by default and examples of unit formatters/rotated axis labels. | Reserve deterministic SVG space for vertical Y title, centred X title, units, tick labels, legend and caption. Fail on overflow instead of relying on interactive layout/overlap suppression. |
| Series display | [Line dataset properties](https://www.chartjs.org/docs/latest/charts/line.html) distinguish data from a `label` shown in legend/tooltips and support dash and point styles. | The axis/series examples use display `name` values independently of the source data and support a legend. | Keep exact Markdown property keys; materialise humanised editable labels and use fixed dash/marker identities. SVG/legend carry the same identity in grayscale. |
| Editor conventions | Engine configuration describes chart options, not a guided Obsidian form. | Handbook likewise documents runtime options, not editor accessibility patterns. | Accessible labelled Data, Axes, Appearance, Publication, and Output/definition fieldsets. We do not attribute a tabs convention to either renderer. |

Decision: retain the custom SVG renderer and add no chart/scale dependency. Both tools document useful axis/series semantics, but neither's interactive behavior is a publishing contract for stable self-contained SVG. Our small additive needs are covered by pure deterministic layout, while avoiding engine runtime cost, output canonicalisation and integration/upgrade surface.

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

Use always-visible fieldsets Data, Axes, Appearance, Publication, followed by persistent destination/save/generate/source-repair controls. This avoids hidden-field errors and tab state/focus loss. Data: actual dataset/X date property/Y keys and date selection. Axes: title/unit/bound/tick policy. Appearance: chart/subtitle, editable series labels, retained fixed identities/legend. Publication: presentation and caption/description. Output/definition destinations remain in their own fieldset; save, generate and recovery actions remain persistently discoverable. Labels stay associated with controls; errors use a live region and focus the relevant visible input when identifiable. Grouping alone does not alter schema or generate assets.

1. Pure v2 schema/domain/ticks/layout; byte compatibility against both legacy and merged-publication baseline.
2. Pure humanisation/discovery + fresh adapter reads, retaining manually configured properties.
3. Grouped manager controls, explicit opt-in, source-preserving leaf patches, diagnostics and native checks.
4. Feature-generated publication matrix and actual bundle/CI evidence; review before merge.
5. Numeric-X design only, separately reviewed before implementation. Proposed explicit x_type numeric, finite whole-source numeric validation; scatter displays every point, line sorts by X with path tie ordering and rejects duplicate X initially rather than inventing aggregation. Date start/end/window are invalid in numeric mode. No cosmetic terminology change activates this proposal. Whether duplicate-X lines should instead draw vertical segments remains a Ted/reviewer decision for that later issue.

## Synthetic before/after and acceptance

Before: existing publication definition of .18/.96 has five ticks .18/.375/.57/.765/.96 and horizontal Y title above plot. After explicit v2: zero/auto, six .2-step ticks on 0–1, vertical title alongside and centred X title. Existing definition/output remains unchanged until deliberate opt-in and guarded regeneration. Numeric-X, log axes, statistics, new chart families, variable styles/KPIs/percentage changes remain outside implementation.

Tests must cover independent fixed endpoints and outliers, zero/mixed/negative, integer ticks with fractional values, explicit-step overflow, constants/subnormals/large values, source preservation and both old byte paths; discovery all-note/missing/type/scope failures; generated-label override lifecycle. Exercise actual native groups/focus/save/preview in a disposable vault and publish actual generated assets through exact current merged compiler. Physical-print, EPUB/Kindle/AT and accessible-PDF qualification remain separate #12 work; do not claim these from synthetic conversion or EPUBCheck.

## Implementation progress — 2026-10-14

Branch `feature/chart-usability` implements the bounded date-X portion against the compatibility boundary above. `publication-v2` is the opt-in. Existing absent/opaque/legacy/publication paths are protected by independent legacy byte goldens. Paired `y_min`/`y_max` remain accepted with v2 only when `y_axis` is absent; the manager hides independent endpoint/tick controls in that legacy-pair case and asks the author to remove both old fields deliberately before reloading. New controls include independent auto/zero/number minimum, auto/number maximum, auto/integer/step ticks, axis titles/units, editable humanised labels, full recursive property discovery and grouped fieldsets. Numeric X remains a separate design question in #18; no date terminology change introduces it. Implementation is not accepted until the draft PR's validation and review gates pass. See [validation evidence](validation.md) for the native vault exercise, exact compiler matrix, measured PDF placement and bundle comparison. Physical-print and reader qualification remain pending.
