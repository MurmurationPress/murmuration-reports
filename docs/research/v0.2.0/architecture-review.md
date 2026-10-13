# Published 0.1.0 architecture review (#5)

Reviewed tag `0.1.0`, an annotated tag resolving to commit `262f11630da4fd5848ce6e82013c9ad1a0b25b23`. Local main matches that commit; no code difference. [Pinned source](https://github.com/MurmurationPress/murmuration-reports/tree/262f11630da4fd5848ce6e82013c9ad1a0b25b23). Release was published 2026-10-12.

| Layer | Current code | Contract and limitation |
| --- | --- | --- |
| Definitions | `src/core/DerivedArtefactDefinition.ts` | Discriminated line-chart/state-table; date/folder/series validation; chart series count 1–4 |
| Discovery and reads | `src/obsidian/VaultAdapter.ts`, `GenerationCoordinator.ts` | Fresh Markdown/frontmatter reads, declaration discovery, snapshots and inventory guards |
| Data semantics | `LineChartData.ts`, `StateTableData.ts` | All source records validated; stable date/path ordering; inclusive calendar windows; state table current ≤ endpoint and immediate predecessor |
| SVG presentation | `LineChartSvg.ts` | Pure text, 960×540, elapsed-time X, nice 1/2/5/10 Y tick steps, fixed two-decimal serialisation, escaped labels, title/desc; all series share circle/solid line and differ by colour |
| Markdown presentation | `StateTableMarkdown.ts` | Ordered rows; signed two decimals; em dash without predecessor; absolute delta only |
| Lifecycle/safety | `GenerationCoordinator.ts`, `OutputOwnership.ts`, `PathSafety.ts`, `MutationQueue.ts` | Explicit serial generation, collision/ownership checks, SHA-256 receipts, guarded writes, verified backups, adoption; cannot provide crash-atomic multi-file transaction or external-sync lock |
| Editing/UI | manager, commands, capability and adapter modules | Source-preserving YAML editing and known-field forms must evolve alongside any additive schema; preserve command/capability contracts |

Coordinator currently selects and calls the two normalisers/renderers directly while also planning writes. It already provides an important safety boundary: build content before mutation, retain observed input/output state and revalidate around writes. Extensibility should move report semantics behind a small pure planning interface, not duplicate or weaken this lifecycle.

Deterministic SVG **bytes** do not imply identical visual text on every host: `system-ui, sans-serif` resolves differently. Tiny tick intervals can also be rounded to identical two-decimal labels. Long legends/titles have no wrapping/layout measurement contract. These are inspection findings requiring fixture coverage, not claimed reproduced production defects.

PrimeTrilogy migration evidence: local `docs/reports-migration-0.1.0.md`, commit `f09b8c4d16d5ad88fb1e9b77d5c99103e12dc87d` ([source](https://github.com/tedwarddick/PrimeTrilogy/blob/f09b8c4d16d5ad88fb1e9b77d5c99103e12dc87d/docs/reports-migration-0.1.0.md)). Fixed −1…+1 charts carry explanatory captions. Two explicit-pair tables match today's predecessor but diverge after insertion of a historical record. An endpoint freezes neither the full source snapshot nor its predecessor. Do not expose manuscript content as fixtures; this research uses public synthetic examples only.

See [proposed ADR](../../adr/0001-reporting-pipeline.md). Backwards compatibility must cover default bytes and semantics, not only parsing old YAML. Receipts remain safety metadata, not a dependency of viewing/publishing. New paired assets must wait for an approved multi-output recovery design.
