# Codex Press publishing compatibility (#10)

Inspected Codex Press commit [`93af44922cdb1b83b6166c4f8429d7d9f5b32c07`](https://github.com/MurmurationPress/codex-press/tree/93af44922cdb1b83b6166c4f8429d7d9f5b32c07), 2026-10-13. No compiler changes. Reports [ADR](../../adr/0001-reporting-pipeline.md) remains proposed.

## Verified pathway

- `src/compiler/markdown-transclusion.ts` treats SVG/SVGZ as media; Markdown notes are transcluded as content. Saved reports require neither Reports nor MWC during publication.
- PDF `src/exporters/pdf/asset-plan.ts` stages SVG, schedules a normalised SVG and invokes `rsvg-convert --format=pdf --output …`; output paths replace image references before Pandoc/XeLaTeX. `pdf-executor.ts` verifies dependencies, normalises/validates SVG resources and retains actionable diagnostics on failure. Width/alt attributes are preserved by planning; image scale is determined by the document width and attributes, not screen viewport.
- EPUB stages SVG and uses `epub-packaging.ts` through the existing title postprocessor. It normalises SVGZ/XML packaging to ordinary SVG with `image/svg+xml`, updates package references and preserves correct payloads; no report rasterisation is necessary in this path. [Packaging evidence and limitations](https://github.com/MurmurationPress/codex-press/blob/93af44922cdb1b83b6166c4f8429d7d9f5b32c07/docs/epub-packaging.md).
- PDF tables use `content-filter.ts` and `table-pagination-header.ts`: row packets, measured local-width fitting, breakable wrappers and repeated continuation headings, including top-level callouts. This is not simply a blanket longtable conversion. Oversized rows/nested tables can fail deliberately. [Prior real-tool validation](https://github.com/MurmurationPress/codex-press/blob/93af44922cdb1b83b6166c4f8429d7d9f5b32c07/docs/pdf-table-pagination-validation.md). EPUB uses HTML/CSS table behaviour, requiring reader/reflow verification separately.

## Initial fixture results (observed, not full qualification)

Research-only [harness](tools/README.md) invoked existing production planners/executors on [fixtures](fixtures/README.md), constructing an assembled synthetic book and stripping source frontmatter. It bypasses vault discovery, manuscript assembly and Obsidian UI. Artifacts were written only to `/tmp/reports-publication-final`, with no source/compiler/vault changes.

Toolchain: Node 22+, Pandoc 3.1.3; XeTeX 3.141592653-2.6-0.999995 / TeX Live 2023/Debian; rsvg-convert 2.58.0; EPUBCheck 5.3.0. Exact harness results, output hashes and runtime versions are in [publication-results.json](publication-results.json). Runtime tool diagnostics are local artifacts, not committed books.

- PDF publish/KDP 6×9 succeeds, 30 pages, 432×648 pt. All ten SVG conversion tasks run. No planner/executor warnings. All 80 ROW001–ROW080 markers occur exactly once in extracted PDF text; table spans pages 15–30 and every row-bearing page includes its headings. This establishes row completeness/continuation, not complete geometric proof.
- EPUB publish succeeds. EPUBCheck: zero errors/warnings. Ten standalone SVG payloads are byte-identical to their fixtures; package references use `.svg`, with authored img alt text and nearby descriptive alternatives. Formal validity does not establish reader compatibility/accessibility.
- Visual spot-check of PDF page 7: fixed-domain line series, markers/dashes, title and two-line explanatory caption fit. Initial long single-line caption exceeded SVG width; the research fixture was corrected and publication rerun. This confirms why layout needs explicit wrapping/overflow rules. Other pages and final physical print remain unqualified.
- `pdfinfo` reports **Tagged: no**. SVG title/desc cannot be assumed to become accessible PDF figure semantics. Compiler follow-up: [Codex Press #144 — Accessible reporting figures and tables in PDF and EPUB](https://github.com/MurmurationPress/codex-press/issues/144). This asks for a conformance/authoring contract and tagged-PDF feasibility/design, not an unreviewed compiler rewrite. Existing toolchain provisioning/discovery is already tracked in [#96](https://github.com/MurmurationPress/codex-press/issues/96) and [#113](https://github.com/MurmurationPress/codex-press/issues/113).

## Acceptance matrix to review

| Concern | Proposed acceptance | Current evidence / remaining work |
| --- | --- | --- |
| Standalone SVG | Valid XML; no script, animation, foreignObject, external href/CSS/font/image resources; fixed viewBox; useful title/desc | Ten synthetic SVGs inspected/converted and EPUB bytes preserved; enforce renderer resource contract later |
| Reproduction | Identical bytes for same source snapshot/config/renderer across repeated runs; stable dates/order/precision/IDs | Fixture hashes recorded; library repeatability spike partial; locale/timezone/theme matrix pending |
| PDF vectors | All SVGs convert, labels preserved, no missing/clipped geometry; source bytes untouched | Ten conversions succeed; page 7 visually inspected; full text/bounds/geometry audit pending |
| Print layout | At supported profile widths, target ≥8pt labels and ≥0.5pt essential line weights; colour-independent distinctions and readable contrast | Targets proposed, not yet approved. At a 4.1-inch body width a 720-unit figure scales 18-unit text to about 7.4pt: revise sizing/layout rather than assume nominal font sizes suffice |
| Fonts | Agreed distributable/installed font policy, no external fetch, predictable layout; document fallback | Fixture DejaVu Sans + fallback, not embedded. Production system-ui is host-dependent; font policy/licensing remains open |
| Captions/alternatives | Meaningful short alt + visible caption and detailed text/data table; accessible reading order and units/uncertainty semantics | Fixture title/desc and nearby alternatives; compiler accessibility #144; screen-reader checks pending |
| EPUB | Correct media types/references, EPUBCheck clean, no runtime resources; usable reflow, zoom and alternatives in representative readers | Packaging/validation pass; reader, assistive-tech and Kindle-specific checks pending |
| Markdown tables | Stable escaped cells/order/units; row/heading/caption integrity; bounded width/precision; no dropped rows | 80 rows exactly once and repeated PDF headings; column bounds/callout/oversized-row/EPUB reflow fixtures pending |
| KPI formats | Unknown never styled as success; labelled periods/units/directions; single output ownership initially | Synthetic SVG/Markdown examples; no production KPI support; dual-output policy unresolved |
| Persistence | Reports/MWC disabled, assets still view/embed/compile; receipts unnecessary for consumption | Existing architectural contract; new fixture live Obsidian check pending |
| Physical publication | Review actual-size greyscale print proof and representative page widths; no clipping or unreadable text | Pending; PDF success is not print or retailer acceptance |

## Next fixtures/checks

Add log-domain negative cases, supplied SD/SE/CI variants, tiny/large tick magnitudes, one-point/constant series, missing gaps, many/long category labels, unit symbols, long captions, narrower/wider publication profiles, table-in-callout and oversized-cell diagnostics. Produce matched fixtures with candidate engines before final renderer recommendation. Keep invalid cases isolated from the positive specimen book. No future schema should claim these pass until executable behaviour exists and is checked.

The current compiler already provides the basic vector/Markdown pathway. Accessibility design and font/layout/reader qualification remain material work. No new dependency or compiler implementation is introduced here.
