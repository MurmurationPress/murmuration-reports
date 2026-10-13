# Bounded P0 acceptance — 2026-10-13

Accepted after source/contract/evidence review and fresh merged-compiler validation under the user’s explicit review authorisation. This accepts research/design recommendations for the **first milestone only**, not implementation, release readiness or every proposed chart type. Research PR #11 remains open for review.

## Decisions accepted

- Custom SVG plus existing Markdown tables; **no new chart or scale dependency**. The four-series engine comparison establishes a sufficient bounded choice: ECharts adds ID canonicalisation and an engine adapter; Vega adds compiler/dataflow and still requires print layout; Chart.js has no established native SVG exporter. Standalone bundles and hypothetical coexistence probes remain distinct from actual integration costs. Upstream plugin licence ambiguities do not block a choice that copies none of that code.
- Preserve legacy definition/default/output bytes, commands, receipts and guarded ownership/recovery. Add pure selection/presentation helpers when separately implementing, without a broad architecture migration. Unknown legacy keys remain opaque; only the exact publication opt-in activates new chart options.
- First milestone: **fixed Y bounds, explanatory captions, dash/marker series identification and explicit-pair comparisons**. Accept the concrete field/limit/reference proposal in first-milestone.md. Both pair paths must resolve to distinct valid observations in the source subtree, strictly date ordered; missing/renamed/ambiguous references block without writes or predecessor substitution. Legacy comparison defaults stay unchanged. No percentage convention is accepted.
- Publication widths 3.5/4.1/5.5in when local space permits; qualified installed DejaVu/Liberation policy, ≥8pt text and ≥0.5pt essential strokes, explicit overflow diagnostics. Smaller containers need separate layouts. Font identity is a host requirement, not guaranteed by identical SVG bytes.

## Independent compiler review and merge

Fetched PR #146 head `10ce8c7e62a93131978173680b808effd9929a1b`; reviewed production/tests/workflow, contract and evidence. No material defect found. Reproduced full repository checks and real-PDF ordinary/tall/narrow, width/height/combined, oversized local-container and unsized-default regressions. A scratch extreme 1:100-ratio compilation also succeeded; out-of-source label coordinates made that probe unsuitable for text measurement, so it is not label qualification. Temporary edits were restored.

Squash merge with expected-head guard: **`394cf109f035194b440e3b37d75de06e49fe074d`**. Reviewed and merged trees both `b1e8594895b7ce0e73a33e6a259ebf5378dce19d`. Pre/post-merge local `npm run release:check`: 67 files, 589 passed, one existing skip, TypeScript/build/unchanged 1.0.1 metadata passed. Exact-head Ubuntu/Windows CI: [38405699907](https://github.com/MurmurationPress/codex-press/actions/runs/38405699907); exact-merge Ubuntu/Windows CI: [38440879789](https://github.com/MurmurationPress/codex-press/actions/runs/38440879789), both successful. Hosted CI skips real-tool cases where tools are absent; it is not Windows PDF/UI qualification.

## Downstream validation

Reports inputs/harness read at `3492e836c0a7e0652c75f17d1d6f99562d2044a7`; unchanged synthetic fixtures. Fresh four-profile harness runs against the exact merged compiler, followed by publication, direct-width and final compiler-placement audits. [Machine ledger](merged-compiler-results.json) records commits, harness/fixture/output hashes, exact tool versions, all 44 measured placements, fonts/text sizes, table checks and EPUB payloads. Artifacts remain in `/tmp/reports-merged-146`, outside the repository.

| Case | Requested / measured width | Minimum chart text | Pages |
| --- | --- | ---: | ---: |
| KDP reference 3.5in | 252pt / 251.996pt | 11.19984pt | 34 |
| KDP reference 4.1in | 295.2pt / 295.207pt | 13.12032pt | 36 |
| A4 reference 5.5in | 396pt / 396.009pt | 17.60040pt | 24 |
| KDP fallback 3.5in | 252pt / 251.996pt | 11.19984pt | 34 |

All placements match within 0.02pt and preserve intrinsic ratios. Essential three-unit strokes measure approximately 1.05/1.23/1.65pt at these placements, above 0.5pt. All page text bounds pass; all 80 row markers occur once in every book, with continuation headings. Every figure page and every subsequent report/table page was inspected in greyscale (including small comparison/KPI tables missed by the original audit’s page selector). No visible clipping or lost labels/legends/captions; four patterns/markers remain distinguishable. External figure captions share their figure page. Narrow table headers/labels still wrap/hyphenate heavily; some section headings/prose precede the next-page figure, and the 4.1in book has a trailing blank page. These are existing editorial-layout limitations, not report implementation qualification.

44 standalone librsvg width conversions are recorded separately; they do not establish compiler placement. EPUBCheck: zero errors/warnings, eleven byte-identical SVG payloads, XHTML width 4.1in, existing max-width/height-auto CSS. No EPUB/DOCX policy change or reader qualification claim.

## Gates and issue disposition

P0 research deliverables/recommendations for #4/#5/#10 are complete and accepted for this bounded milestone. ADR 0001 is **Accepted for the first milestone only** because of the explicit review and reproduced evidence above. The first milestone is sufficiently specified for a later implementation task; this task starts none.

Before implementation can merge: executable new-behaviour/layout/reference diagnostics, legacy byte/safety replay, actual bundle measurement, actual generated-output four-profile publication matrix and disabled-plugin persistence/product-flow checks. Before print/release claims: actual-size greyscale physical proof. Reader/AT and accessible-PDF conformance remain unqualified; PDFs are untagged and [Codex Press #144](https://github.com/MurmurationPress/codex-press/issues/144) stays separate. These pending checks do not block bounded design acceptance, but cannot be waived by synthetic research fixtures. Track them in [Reports #12](https://github.com/MurmurationPress/murmuration-reports/issues/12); broader designs #6–#9 remain open.

Research checkout verification: `npm test` — **107/107 passed**; `npm run build` — typecheck and production bundle pass (**166873 raw / 52490 gzip bytes**, unchanged production inputs); `npm run release:check` — packaging, MIT attribution, dependency boundaries and version mapping pass. Research Python compilation, Node script syntax, JSON parsing, local documentation links and `git diff --check` pass. Fixture hashes and production files match the prior research head; no output book/image or manuscript is committed.
