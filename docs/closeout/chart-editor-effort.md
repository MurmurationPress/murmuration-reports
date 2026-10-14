# Chart and editor effort closeout — 2026-10-14

## User acceptance

Ted installed the merged build and reports that he is much happier with it. This is positive user acceptance of the current editor and chart workflow. It is not acceptance of every proposed report type or a claim that publication has been fully qualified for physical print, EPUB/Kindle readers, assistive technology or accessible PDF.

## Delivered scope

The work landed through three reviewed pull requests:

- [PR #13](https://github.com/MurmurationPress/murmuration-reports/pull/13), merge `be6ac624b1f665c6334ca31240bb9624a3429a3f`: opt-in publication line charts with fixed Y bounds, explanatory captions and greyscale-identifiable dash/marker series; explicit-pair state-table comparisons with source-bounded references and no predecessor substitution.
- [PR #19](https://github.com/MurmurationPress/murmuration-reports/pull/19), merge `ea77415740d16e2e078f8daa038b91d3b18a0c84`: independent Y endpoint and tick policies, axis titles/units, editable humanised series labels, recursive dataset property discovery and grouped editor controls.
- [PR #21](https://github.com/MurmurationPress/murmuration-reports/pull/21), merge `09ea631632e0f2c0cf25eb4f7f47b83c741fd6e2`: new charts default to `publication-v2`; saved presentation semantics and output destinations survive unrelated edits; detail messages distinguish the current definition from a persistent saved output; property discovery runs automatically with stale-result protection; the title control appears directly beneath the editor heading.

The implementation preserves legacy output behaviour and byte goldens, source comments and unknown YAML fields, existing commands, receipts, ownership/recovery paths and saved assets. Discovery and opening are read-only; saving a definition does not generate output. Generation remains deliberate. No numeric-X implementation, new chart dependency, version change or release was included.

## Review and validation record

The feature baseline was `09ea631632e0f2c0cf25eb4f7f47b83c741fd6e2`; main was clean and synchronized there at the start of this documentation-only closeout. PRs #13, #19 and #21 are merged. Their exact merged-commit Ubuntu/Windows workflows passed:

- [PR #13 merge checks](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38457704690)
- [PR #19 merge checks](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38550159511)
- [PR #21 merge checks](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38559514763)

The last closeout independently reran `npm test`, `npm run build` and `npm run release:check` on PR #21 and again on its merge tree. The reviewed and merged trees matched. It also exercised the editor in disposable Obsidian, including automatic discovery, stale-result handling, save-only versus deliberate generation, preservation of source metadata and viewing saved assets with Reports disabled. Bundle and detailed publication measurements remain in the linked PRs and [validation records](../implementation/validation.md) and [chart-usability record](../design/chart-usability/validation.md); expensive native/publication checks were not repeated for this documentation-only closeout.

Issues #4, #5, #10, #14–#17 and #20 are closed for their bounded accepted scopes. Epic #3 remains open. Broader plotting foundations (#6), additional chart types (#7), table comparison design (#8), KPI design (#9) and remaining qualification work (#12) remain open.

## Remaining work

- [#18 — Numeric X semantics](https://github.com/MurmurationPress/murmuration-reports/issues/18) remains open for schema, ordering, date-window and scatter design. Ted decided that future numeric-X **line charts reject duplicate X values**, with diagnostics naming the duplicate and every affected source note. Do not draw vertical segments, aggregate, or add a duplicate-policy option. This does not change date-X behavior or define scatter duplicate semantics.
- Physical actual-size print proof and author/reader legibility review remain pending.
- EPUB/Kindle reader and assistive-technology qualification remain pending; EPUBCheck and payload identity do not qualify readers.
- Accessible PDF remains separate [Codex Press issue #144](https://github.com/MurmurationPress/codex-press/issues/144). Current PDFs are untagged; no accessible-PDF claim is made.
- Broader chart, table and KPI designs and implementation qualification remain tracked in #6–#9 and #12. No further milestone is started by this closeout.

No further action is required from Ted for this closeout.
