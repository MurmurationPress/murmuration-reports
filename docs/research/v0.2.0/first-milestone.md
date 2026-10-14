# Bounded P0 recommendation and first implementation milestone

Current status: this planning record predates implementation. The specified first milestone and subsequent date-X editor work are merged and positively accepted by Ted; see [the chart/editor closeout](../../closeout/chart-editor-effort.md). Physical-print, reader/AT, accessible-PDF and broader feature qualification remain open.

Status: **Accepted for the first milestone only** by the explicit [bounded review](p0-acceptance.md). Scope: Epic #3, P0 #4/#5/#10 and research/design PR #11. No implementation is included.

## Recommendation

Use the existing pure custom SVG renderer and Markdown table renderer, extending them with small opt-in presentation/selection paths. Add **no chart engine or scale-helper dependency** for this milestone. Preserve the existing generation coordinator and ownership/recovery boundary. The engine comparison in [renderer-review.md](renderer-review.md) is sufficient for this bounded choice; it does not choose a renderer for every future chart type.

## Exact milestone

1. **Fixed Y bounds on existing time-based line charts.** Proposed definition fields `y_min` and `y_max` must be supplied together, finite numeric values, with `y_min < y_max`. Bounds apply after the unchanged source validation/window selection; selected values outside the domain block generation with source/property/value context. No silent clipping, expansion or rescaling. Tick positions stay inside the exact domain, include boundary labels and keep distinct readable numeric labels. No log axes, error bars, interpolation or new chart type.
2. **Explanatory captions.** Proposed `caption` is optional plain text, no Markdown/HTML evaluation. Include it visibly in SVG and in descriptive text; escape all content. An opt-in publication layout reserves room and wraps title/subtitle/axis labels/legend/caption at readable sizes; unsupported glyphs, excessively long unbreakable text or unfit content yield an actionable layout diagnostic before writes, never smaller text or truncation. First implementation should document a 240-character caption limit; this is a proposed validation limit, not current schema.
3. **Dash/marker series identification.** Proposed `presentation: publication` selects the reviewed publication layout and stable series-order identities: solid/circle, dashed/square, dotted/triangle, dash-dot/diamond. Retain the existing 1–4 series limit and colours, but colour carries no unique meaning. Legend swatches use the same pattern/marker. See [publication sizing/font policy](publishing.md). No interactive styling or arbitrary engine options.
4. **Explicit-pair state-table comparisons.** Proposed additive `comparison` mapping selects two exact source observation paths, with the [reference contract below](#explicit-pair-reference-contract). Keep signed two-decimal values and absolute delta only. No percentage changes, multi-period comparisons, configurable precision/units or KPI report type in this milestone.

These field names/limits are a concrete proposal for review, not a change to the production schema. The later implementation must add parsing, guided creation/source-preserving editing, previews and validation together; rejecting unsupported combinations is preferable to storing ineffective options.

### Compatibility boundaries

Definitions without new fields keep existing validation, selection, default layout, bytes, commands and receipts. New chart bounds/caption/identity take effect only with `presentation: publication`; new keys cannot quietly affect the legacy layout. In legacy definitions, previously opaque `y_min`/`y_max`/caption keys remain preserved and ignored, exactly as before: adding support must not activate them automatically. Guided creation/editing of the new publication options requires that explicit mode and previews the enforced settings. The guided editor rejects unknown requested modes before saving. Absent or non-publication presentation values stay on the legacy parser path; preview/review should explicitly report that publication options are not enforced, without rewriting or invalidating old opaque metadata. Only the exact opt-in value activates new chart semantics. Explicit pair alone opts into table selection; its emitted header labels the exact current/previous dates, while existing tables remain byte-compatible. Existing unknown-key preservation is not a promise of implemented semantics.

For publication charts, default minimum placement width is 3.5 inches; full-width placement or explicit width must be at least that. Smaller placements require a separately generated/adapted layout, outside this milestone. No automatic regeneration, schema migration or changed existing asset. Preserve receipt version/digests, Markdown ownership markers, path collision checks, adoption, backups and disable/concurrency/recovery behaviour. New output bytes may overwrite only via the existing explicit, ownership-checked regeneration flow. Safety checks remain the coordinator's responsibility.

## Explicit-pair reference contract

```yaml
# Proposed additive state-table fragment, not currently executable
source: Observations
x: measured_on
comparison:
  mode: explicit-pair
  current: Observations/2029-06-30.md
  previous: Observations/2029-05-29.md
```

- **Membership:** both notes must be actual Markdown files in the declared source folder or its recursive descendants. Compare resolved paths at a folder-segment boundary (`Observations-old` is not a descendant). Require safe vault-relative `.md` paths with forward slashes, no absolute/traversal segments, wikilinks, aliases, heading fragments, implicit extensions or basename search. This retains the report's bounded dataset/provenance contract and avoids cross-folder/mixed-schema comparisons. Cross-source comparison can be designed later.
- **Validation:** retain the current whole-source date/finite-parameter validation and canonical-note/output collision guards. Both references must identify valid observations using the same `x` and ordered parameter mapping. Read their current contents and snapshot them within the existing guarded generation plan. The explicit pair fixes selection, **not source bytes**: edits to a named note deliberately change regeneration; saved output stays persistent until explicit generation.
- **Rename:** references are path-based, with no inferred identity or rename following. A rename/move without an author-reviewed definition edit makes the old reference unavailable and blocks generation. The plugin must not rewrite definitions on vault events or search for a similarly named/datestamped replacement. User edits both references/source as needed through the existing source-preserving editor. Moving a referenced note outside the source also blocks until membership is deliberately restored/redefined. Reusing the old path denotes the new file at that path; there is no persistent identity promise. Definition editing, then explicit generation, remains the author-controlled workflow.
- **Missing/unreadable/ambiguous reference:** block that report before writing; retain the prior asset/receipt. Report which field/path failed. Never substitute latest, nearest date, canonical predecessor, zero or an unavailable delta. Resolve case/path aliases against actual files and use the existing collision identity checks; two spellings of the same file are not two observations.
- **Identical references:** reject current/previous resolving to the same file. A self-comparison zero would conceal a likely reference error.
- **Date order:** require previous observation date **strictly earlier** than current. Reject reversed dates and distinct notes on equal dates; equal-date canonical tie-breaking remains a legacy-only rule. No automatic swapping.
- **Endpoint:** explicit pair selects current directly; an optional `end` must equal its `x` date or validation blocks the contradictory endpoint. Neither reference is selected by `end`, window or predecessor search. State tables continue not supporting `start`/`window` selection.
- **Output labelling:** proposed explicit-pair header uses `current (2029-06-30)` and `previous (2029-05-29)`, plus ordinary parameter/Δ columns, followed by a visible plain-text comparison line naming both safe paths. Paths/labels escape Markdown metacharacters; receipt/ownership markers remain unchanged. A period label can be designed later; dates always identify the observations.
- **Legacy default:** absent `comparison` keeps current on/before `end` and immediate canonical predecessor, with existing first-observation em dashes and signed two-decimal output. A supplied mapping with missing/unknown mode is invalid; no fall-through to legacy behaviour. The previously unsupported top-level `previous` field must not suddenly acquire meaning; only the explicit new mapping opts in.

Synthetic acceptance cases: May=10 and June-end=15 give +5; inserting June-middle=12 leaves explicit delta +5 while canonical delta changes to +3. Reject outside-source, missing, renamed, same-file/alias, equal-date, reversed-date, invalid-value/date and contradictory-end cases without touching output. Verify a deliberate reference edit to the middle observation gives +3. Values can be zero/negative; absolute delta remains valid. **No percentage convention is accepted or required.**

## Bounded gates

| Gate | Before implementation may start | Evidence / why it matters |
| --- | --- | --- |
| Renderer choice | Review custom SVG recommendation; no production dependency | Existing byte-stable renderer and narrow required changes avoid an engine migration/ID canonicalisation burden; candidate limitations are recorded |
| Print/font policy | Review widths, ≥8pt text/≥0.5pt essential strokes, named font/fallback and overflow diagnostics | Mathematical sizing plus all-page digital review in the bounded fixture matrix prevent shipping the known 7.38pt layout |
| Pair/compatibility contract | Review the rules above, proposed fields and opt-in boundaries | Avoid silent predecessor substitution, rename guessing, endpoint contradictions or changed old bytes |
| Compiler placement | Verify merged #145 fix | Satisfied at `394cf109f035194b440e3b37d75de06e49fe074d`: requested widths and final text sizes are measured in actual compiler PDFs |
| Scope/review | Explicit review of P0 #4/#5/#10 and proposed ADR | Documents/experiments are evidence, not approval; bounded research recommendations accepted in p0-acceptance.md; later qualification remains open in #12 |

Before **merging the future first implementation**, add meaningful tests of new fixed-bound/caption/identity/pair behaviour, legacy byte replay, owner/backup guards and malformed/unsupported option diagnostics; run full existing tests/build/release checks; regenerate publication fixtures from that implementation at supported widths with a verified font; inspect every report-bearing page and confirm portable assets with Reports/MWC disabled. Research specimens do not establish that unimplemented behaviour works.

Before **claiming print/publication qualification or release readiness**, inspect an actual-size greyscale physical proof and the relevant reader/product flows. A physical proof is not a prerequisite for writing the implementation, but remains a prerequisite for a print-quality claim. Broader reader accessibility can require compiler changes; retain the separate [Codex Press #144](https://github.com/MurmurationPress/codex-press/issues/144) gate for accessible PDF claims. Current PDF is untagged.

## Later work, outside this decision

Log axes, statistical uncertainty, scatter/bars/histograms/pie/radar, many-series layouts, missing-data policies, percentage deltas, multi-period comparisons, configurable units/precision, KPI thresholds/sparklines/dual assets, full EPUB reader/assistive-technology qualification and tagged-PDF semantics. These still need their own P1/compiler acceptance. Unselected engine startup/integration benchmarks and upstream licence ambiguities do not block a milestone that imports none of their code. No promise of shipping all capabilities in v0.2.0.

## Acceptance assessment

The first milestone was sufficiently specified for implementation. All bounded P0 start gates were satisfied by the explicit review and exact-merge evidence in [p0-acceptance.md](p0-acceptance.md). The implementation is now merged; physical-print, reader and accessibility gates remain outstanding in [#12](https://github.com/MurmurationPress/murmuration-reports/issues/12).
