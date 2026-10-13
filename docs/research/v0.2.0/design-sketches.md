# Functional design sketches (P1, not an accepted schema)

These are discussion examples for #6–#9. **Current Reports does not implement these fields.** Keep legacy parsing, whole-folder validation, defaults and output bytes unchanged. Final schema awaits P0 recommendations and individual design acceptance.

## Plotting foundations (#6)

```yaml
# Proposed fragment, not a runnable report definition
presentation:
  width: 720
  height: 480
  x_axis: {scale: linear, title: Distance, unit: km, range: auto}
  y_axis: {scale: linear, title: Assessment, range: {min: -1, max: 1}}
  caption: Signed assessments; these values are not probabilities.
  description: Two assessment series across four observations.
  number_format: {precision: 2, notation: auto}
series:
  - property: assessment
    label: Assessment
    style: {line: solid, marker: circle}
    uncertainty:
      kind: confidence-interval
      lower_property: assessment_lower
      upper_property: assessment_upper
      confidence_level: 0.95
      method: supplied
```

Proposal: symmetric uncertainty uses a nonnegative `magnitude_property`; asymmetric uncertainty uses absolute `lower_property`/`upper_property` bounds. Never confuse bounds with deltas. Require exactly one representation, explicit kind (`standard-deviation`, `standard-error`, `confidence-interval`, or `supplied-bounds`) and applicable method/level. Rendering supplied CI does not imply Reports has calculated it. Computation proposals must name sample/population variance, sample count, CI method and assumptions; defer automatic inference in the first milestone.

Linear axes allow automatic or finite fixed domains. Log axes require strictly positive values **and uncertainty bounds**, a declared base >1, and a meaningful single-point domain. Mixed units on one axis should be rejected or require deliberate normalisation; multiple Y axes are a separate decision. Automatic ticks choose readable intervals while numeric precision preserves distinct labels at small/large magnitudes. Fixed domains must not expand silently; propose block on out-of-domain data by default, with explicit clipping plus a descriptive warning as a separately reviewed option.

Missing observations: legacy fail-closed behaviour remains. New opt-in policy can leave gaps or omit a point with an explicit count/reason; zero-fill and interpolation must never be automatic. Invalid numeric/date values remain diagnostics, distinct from intentionally absent values. Define duplicate X handling per chart type, stable source-path ties, and selection versus whole-source validation explicitly.

Acceptance proposals: finite/log-domain validation; fixed −1…+1 limits preserved with captions; correct symmetric/asymmetric extents; bounds order and centre validated; no silent uncertainty assumptions; colour-independent dash/marker match between series and legend; long labels wrap or yield a diagnostic; units/titles/caption available in SVG and surrounding text; fonts/weights remain legible at final page width. Cases include single/constant series, tiny increments, very large magnitudes, mixed signs, missing bounds and duplicate dates.

## Additional chart types (#7)

| Order | Type | Mapping/configuration proposal | Rendering/accessibility acceptance |
| --- | --- | --- | --- |
| First | XY scatter | Numeric X + numeric Y per observation, optional group and point label | True numeric position, stable group order, distinguish shapes, bounds/error bars if declared; no connecting lines or regression by default |
| First | Bar/column | Category + value; explicit category order and orientation | Zero baseline by default; disclose any exception; signed values around zero; labels and data table alternative |
| Next | Grouped bars | Category + group + value; declared aggregation if duplicate keys | Stable category/group order; legend and non-colour identity; insufficient width diagnostic |
| Next | Stacked bars | Category + component + value, explicit absolute/100% mode | Signed stacks separately above/below zero; zero-total percent stack unavailable; labels disclose totals/normalisation; avoid implying easy comparison of interior segments |
| Next | Histogram | Numeric observations; explicit edges, or a named reproducible bin rule frozen into resolved spec | Left-closed/right-open except final closed bin; counts/density explicitly labelled, under/overflow policy and count conservation |
| Later | Pie/doughnut | Category + nonnegative value, total >0; zero handling explicit | Direct labels with values/percent, stable order, accessible table; reject negatives and diagnose crowding; no 3D/exploded distortion |
| Later | Radar | Ordered dimensions + series, explicit per-dimension scales/units | Disclose normalisation/domain; stable dimension order and labelled ticks; dash/markers; table alternative; do not imply area is a meaningful total |

Prioritise scatter and simple bars; keep histogram, grouped/stacked and circular/radar formats subject to demonstrated demand and publishing quality. Nonlinear regression and advanced modelling are excluded. Every type needs a mapping example, defined duplicate/missing policy, deterministic category order and representative publication fixture before implementation acceptance.

## Tables and comparisons (#8)

```yaml
# Proposed additive fragment
comparison:
  mode: explicit-pair
  current: Observations/2029-06-30.md
  previous: Observations/2029-05-29.md
  label: Since the May review
columns: [current, previous, delta] # first milestone excludes percentage deltas
format: {precision: 2, unit: points}
```

Default remains canonical predecessor, current latest on/before endpoint, ordered parameter rows and signed two decimals. Explicit-pair mode must read and validate the named notes, display their dates/period label and remain fixed when a June intermediate note appears. For the first milestone, both notes must belong to the source subtree, references are path-based with no automatic rename following, dates must be strictly ordered, and identical references are rejected; fail clearly if either reference disappears, never fall back to predecessor. More than one comparison period should use ordered named comparison specifications, avoiding a very wide default table.

The first milestone accepts absolute delta = current − comparison only. All remaining paragraph rules are **later unaccepted design alternatives**, outside the milestone. Provisional percent delta = 100 × (current − comparison) / abs(comparison); another convention is legitimate, so approve and document the denominator before implementation. Zero baseline means unavailable (even 0→0), not infinity or silent zero. Negative baselines require an explicit chosen convention; changing it is a semantic change. Missing values yield a labelled unavailable cell/reason; formatting never substitutes zero. Units and precision belong to the parameter or shared format; perform calculations before rounding and avoid negative zero display.

Acceptance: synthetic May=10, June-middle=12, June-end=15 gives explicit delta +5 despite inserting the middle note; canonical predecessor gives +3. Missing references block; equal-date ties deterministic; zero/negative baselines follow approved policy; multiple periods labelled; pipes/backslashes/newlines in labels cannot corrupt Markdown; plain Markdown survives Obsidian transclusion and Codex Press, with bounded column count and repeated headers on PDF continuation. Preserve legacy defaults and table ownership markers.

## KPI scorecards (#9)

```yaml
# Proposed report shape; not currently executable
artefact_type: kpi-scorecard
kpis:
  - property: completed_pages
    label: Pages completed
    unit: pages
    precision: 0
    comparison: {mode: explicit-pair, current: Publishing/June.md, previous: Publishing/May.md}
    target: 160
    desired_direction: higher
    status: {good_at_or_above: 160, warning_at_or_above: 140}
    trend: {property: completed_pages, window: 6 months}
output_format: markdown
```

Publishing: pages completed 150 vs 120, +30/+25%, target 160, target variance −10, higher better, warning. Project: open defects 8 vs 12, −4/−33.33%, target ≤5, lower better, warning. Environment: nitrate 2.4 vs 3.0 mg/L, −0.6/−20%, target ≤2.0 mg/L, lower better, warning. These are synthetic reporting examples, not environmental or clinical threshold advice.

Share comparison/variance rules with tables. Target variance is current − target with direction-aware status separate from the signed value; target=0 also makes percentage target variance unavailable. Threshold equality, inclusive intervals, ordering and precedence require validation. Support a neutral/informational direction or explicit thresholds rather than infer whether a metric is good. Unknown current/target means unavailable/unknown status, never green. Each KPI displays period, value, comparison, target and status text as applicable; symbols/colour supplement text. Optional sparkline retains a fixed dated range, gap policy and textual trend description.

Provisional output preference: one ordinary Markdown scorecard table first; optional standalone SVG scorecard for controlled print layout later. SVG plus Markdown could improve accessibility, but two managed outputs require reviewed ownership/recovery and regeneration rules. Accept multiple KPIs with independent units/directions, no reliance on colour, readable compact page widths and informative missing data; avoid large tables where one row cannot fit a printed page.

The authoritative bounded proposal is [first-milestone.md](first-milestone.md); review sketches above do not expand its scope. Print sizing/placement, reference rules and gates are resolved or explicitly blocked there and in [publishing.md](publishing.md).
