# Derived Artefacts

Derived artefacts are portable files generated from authoritative Markdown properties. The Markdown notes remain canonical; generated files are disposable projections that can be regenerated or deleted without losing source data. Murmuration Reports supports `line-chart` SVG projections and `state-table` Markdown projections. It does not read either format back as canonical data.

## Define a line chart

Create a Markdown note with frontmatter like this generic example:

```yaml
---
world_entity: derived-artefact
artefact_type: line-chart
source: "Research/Measurements"
x: measured_on
series:
  - property: water_level
    label: Water level
  - property: flow_rate
    label: Flow rate
window: 12 months
end: 2029-05-29
title: River measurements — rolling twelve months
subtitle: Field observations
x_axis_label: Measurement date
y_axis_label: Recorded value
output: "Visualisations/River measurements — 2029-05-29.svg"
---
```

The source must be a vault folder. Every Markdown file below it is one observation and must contain a valid `YYYY-MM-DD` value for the property named by `x`, plus a YAML number for every declared series. A series requires unique `property` and human-readable `label` values. One to four series are supported.

`title`, `source`, `x`, `series`, and an `.svg` `output` path are required. `subtitle`, `x_axis_label`, `y_axis_label`, `start`, `end`, and `window` are optional. A window is a positive number of `months` or `years`, such as `12 months`.

Reports rejects the whole definition if a source observation is incomplete or malformed. It does not skip points, interpolate, aggregate, sample, or smooth them.

## Dates and rolling windows

Observations are sorted by their x date, with source path as the stable tie-break for equal dates. Their horizontal positions reflect real elapsed time, so irregular event-driven observations remain visible.

The rolling window ends at `end`. If `end` is omitted, it ends at the latest source observation. Window boundaries are inclusive and use calendar month/year subtraction. If `start` is also present, Reports uses the later of the explicit start and rolling-window start; `end` remains the upper bound. This intersects the configured constraints without sampling the observations.

Use explicit `end` and dated output filenames for stable historical snapshots.

## Define a state table

A state table compares the current observation at an endpoint with the immediately preceding canonical observation. Define one with generic frontmatter like this:

```yaml
---
world_entity: derived-artefact
artefact_type: state-table
source: "Research/Measurements"
x: measured_on
end: 2029-05-29
parameters:
  - property: water_level
    label: Water level
  - property: flow_rate
    label: Flow rate
output: "Visualisations/River state — 2029-05-29.md"
---
```

`source`, `x`, `parameters`, and a `.md` `output` path are required. Each parameter has a unique property and a label. Declared parameter order becomes table row order. `end` is optional for consistency with line charts; when omitted, Reports uses the latest valid canonical observation.

Reports sorts every Markdown observation below `source` by the `x` date, using source path as the stable tie-break for equal dates. Current means the latest observation on or before `end`. Previous means the immediately preceding observation in that canonical sequence—not the previous chapter and not a sampled or aggregated value. Adding an intermediate observation therefore changes previous and delta on regeneration.

For every parameter, delta is `current - previous`. Values use deterministic signed two-decimal formatting: positive values and zero include `+`, negative values retain `-`. If current is the first observation, previous and delta are em dashes because Reports does not invent history.

Generated state tables are ordinary portable Markdown:

```markdown
|parameter|current|previous|Δ|
|---|---:|---:|---:|
|Water level|+0.94|+0.92|+0.02|
|Flow rate|+0.33|+0.37|-0.04|
```

Reports retains a deterministic HTML ownership comment to the generated file. This allows safe regeneration without treating an unrelated Markdown note as disposable output. A state-table output may not collide with a source note, definition note, folder, or unrelated Markdown file.

## Generate and embed

To generate one projection, open its definition note and run **Generate active report definition** from the Command Palette. Run **Generate all report definitions** to regenerate every note marked `world_entity: derived-artefact`. Generate-all dispatches each mixed `line-chart` or `state-table` definition to its renderer; one invalid definition is reported without preventing valid definitions from being generated.

Generation creates missing parent folders and replaces an owned existing projection at the output path. Existing SVGs without receipts require explicit adoption; conflicting ownership and changed receipts/assets are blocked. Changed outputs have recovery copies. Invalid definitions or malformed source observations do not write output or modify source/definition notes. Generated files do not require either plugin to remain active. Embed one with normal Obsidian syntax:

```text
![[Visualisations/River measurements — 2029-05-29.svg]]
```

Markdown state tables can be embedded the same way, using their `.md` path.

## Publication line charts (first milestone, development build)

These additive features are available in the development build; the published 0.1.0 release remains unchanged. See the [independent review](implementation/independent-review.md) for validation and remaining qualification. Choose **Publication** in the manager, or add the exact opt-in:

```yaml
presentation: publication
y_min: -1
y_max: 1
caption: Signed assessments; these values are not probabilities.
```

Both limits must be finite numbers with `y_min < y_max`, or both must be absent for automatic scaling. Generation validates every source note first, selects the date/window range, then rejects selected values outside fixed limits with the note/property/value. Limits never silently expand or clip. The legacy automatic renderer, selection and output bytes stay unchanged for definitions without the exact opt-in. Previously opaque bounds/caption fields and unknown presentation values remain ignored and preserved; the manager explains when they are not enforced. A newly requested unsupported presentation is rejected by guided saves.

Publication charts visibly include plain-text captions (up to 240 Unicode code points), deterministic wrapped title/subtitle/axis/legend/caption text and useful SVG title/description. One to four ordered series use solid/circle, dashed/square, dotted/triangle and dash-dot/diamond styles in both chart and legend. Colour is supplemental. ISO endpoint dates label the elapsed-time X axis; they stagger vertically if their conservative width bounds would overlap.

The layout uses fixed 32-unit text and three-unit essential strokes on a 960-unit canvas. Publish at **3.5, 4.1 or 5.5 inches**, where the local page/container can fit. At 3.5in these correspond to 8.4pt and 0.7875pt. Check **actual compiler placement**: an unsized image, narrow callout or height fitting can make labels smaller. Use explicit authored dimensions with merged Codex Press #145, for example:

```markdown
![Assessment and its limits](<Visualisations/Assessment.svg>){width=3.5in}
```

The operator must verify the installed reference/fallback font: `DejaVu Sans, Liberation Sans, Arial, sans-serif`. DejaVu/Liberation are digitally checked; Arial/generic viewing fallbacks are not print-qualified. No external font or runtime resource is required. Text wraps at whitespace with conservative host-independent bounds; titles allow three lines, subtitles/axis labels/each legend two, captions six, and total height 1200 units. Unsupported glyphs, unbreakable words or unfit content block before writes with shortening/restructuring advice; no silent shrinking/truncation. Supported text is printable ASCII, Latin U+00A0–024F, Greek U+0374–0375/037A–037E/0384–038A/038C/038E–03A1/03A3–03CE/03D0–03FF, punctuation U+2010/2012–2022/2026 and minus/≤/≥. Whitespace is normalised before visible-glyph checks. Other control/format/unassigned/combining code points, emoji, CJK and RTL scripts need separate layout qualification. Numeric labels adapt precision to remain distinct; unusably long tick labels produce a layout diagnostic. The [implementation contract](implementation/first-milestone.md) records these limits.

## Explicit-pair state tables (first milestone, development build)

```yaml
comparison:
  mode: explicit-pair
  current: Observations/2029-06-30.md
  previous: Observations/2029-05-29.md
```

Choose **Two explicit observations** in the manager and enter both complete vault-relative `.md` paths. Both must resolve to distinct valid observations in the actual declared source folder/subtree. No basename search, wikilinks, aliases/fragments or traversal. Case/NFC spellings resolve only when unique; ambiguous paths block. The previous date must be strictly earlier; equal dates/reversed dates are rejected without swapping. Optional `end` must equal the current observation date. `start` and `window` are unsupported for explicit-pair state tables.

Whole-source validation remains in force, including other observations. Inserting an intermediate note changes a canonical-predecessor table but **does not change an explicit pair**. Renaming/deleting a reference blocks the next generation without changing its old output/receipt or substituting a predecessor. References are path-based; no automatic identity tracking or definition rewrites. Correct the reference deliberately, then generate explicitly.

Output keeps ordered parameters and signed two-decimal current/previous/absolute delta values. Date-labelled headers and a plain-text line naming both actual paths explain the comparison. Markdown metacharacters in that provenance line are escaped. Zero/negative values are valid; nonfinite absolute-delta overflow blocks. No percentage-change convention is implemented. Without `comparison`, existing endpoint/current/canonical predecessor, first-observation em dashes and bytes remain unchanged; old top-level `previous` does not acquire meaning. A supplied incomplete/unknown comparison mapping is invalid rather than falling back.

Manager saves preserve unknown fields, nested extensions, comments and body. Remove an existing `comparison` mapping or fixed limits directly in the definition note when returning to automatic/legacy selection: the source-preserving guided editor does not silently delete author metadata. Toggling Publication off leaves its options inert. Saved previews show actual saved chart/table bytes and comparison provenance, never regenerated content. Receipt/marker, explicit adoption, backups and guarded generation remain unchanged.

Physical-print proof, reader/AT and accessible-PDF qualification remain pending; visible descriptions, EPUBCheck and untagged PDF conversion do not establish accessibility. No broader chart type, uncertainty, percentage, KPI or dual-output behaviour is included.

Font coverage was checked with Fontconfig `fc-query` for the installed reference/fallback fonts. Conservative advance bounds use 1.2em ordinarily and 1.6em for wide Latin digraphs; no font table/runtime metric dependency is shipped. Substitution or broader text still requires operator sizing/bounds checks.
