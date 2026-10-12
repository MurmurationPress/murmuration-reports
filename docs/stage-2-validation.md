# Stage 2 validation — 12 October 2026

## Reviewed Stage 1 merges

Reports #1: expected head `a611934bc45dee2f09fcb1ca68e91d9489cbfbeb`, squash merge `0b524fb84dd47ec0adf1d6e312ae074e6af7d853`. MWC #267: expected head `323a34266d6648c8d046139aeced99434a3f1773`, squash merge `a9d1b56ad10267224ae88869479bb5065340512b`. Both heads matched, Ubuntu/Windows checks passed, and merges used API expected-SHA guards in Reports-then-MWC order. Each reviewed/merged tree is identical (Reports tree `8889056400fca7159ad32d4a8d09688329aaa1b4`, MWC tree `b3f34488f5fed49240e4595c3de29c3b43a2e603`). Both post-merge Ubuntu/Windows runs passed.

Stage 2 uses isolated worktree `/tmp/reports-stage2`, branch `feature/reports-manager`, from merged Reports main. Original Reports, MWC and Codex Press checkouts were clean and remain untouched. No author vault was installed into or used. Stage 1 core/coordinator/ownership/native adapter/adoption implementation files are unchanged; all five core files retain extraction baseline bytes from MWC `d7c2e6e625e98fade7004a064ab081670e607d4e`.

## Automated qualification

`npm ci`, `npm test`, `npm run build`, `npm run release:check`.

**107 tests pass**: all 75 Stage 1 tests, 15 manager editing/catalogue tests and 17 manager service tests. Strict TypeScript, production build, external/dependency boundary, version/packaging checks and licences pass. Focused tests cover source-range patches, unknown nested fields, comments, CRLF, body preservation, unsafe YAML/aliases/duplicate keys, explicit three-way reconciliation, source/definition/output collisions, native callback races, shared queue and lifecycle cancellation, stale declarations, save-only behaviour, verified previews and no association by matching filenames. Catalogue counts prove one initial enumeration, deduplicated bursts, at most 64 changed paths per turn, cached renders and one publication for 300 batch outcomes. The workflow runs the same suite on Ubuntu and Windows; exact-head remote conclusions are reported on the review PR.

## Native desktop interaction

```sh
npm run build
node scripts/verify-manager.mjs /path/to/built/mwc-transition
node scripts/verify-live.mjs /path/to/built/mwc-transition
```

Requires Linux graphical session, `/opt/Obsidian/obsidian` and Node 22+ native WebSocket. Both create new marked disposable vaults and profiles; every runtime call verifies that vault path. No script accepts a live author vault for installation. `verify-manager` uses real pointer/keyboard input for controls, with some input values and fixture changes supplied through the diagnostic connection. It scrolls off-screen controls into view and waits for pending actions to finish; it does not bypass production coordination.

Final production bundle SHA-256: `3b427af82300c08de03eb115684b81f80f76c51269f7311206cf13b25effedb2`. Manager evidence: `/tmp/murmuration-reports-manager-THKR5X/evidence.json` and narrow screenshot `manager-narrow.png`. Its 15 checks cover reusable populated/empty states, image/static-table previews, chart save-only and explicit generation, date/window/axis options, navigation, external-update draft retention, comment/body/unknown-field preservation, reconciliation, editing through a rename, explicit ownership repair, state-table creation/editing/endpoint, failed individual/batch regeneration retaining assets, invalid/malformed definitions, first-click keyboard focus, refresh, narrow layout, disable/re-enable and byte-identical observations.

Stage 1 live evidence with the same bundle: `/tmp/murmuration-reports-live-LbVXoQ/evidence.json`. All 15 checks pass, including exact adoption, XML rejection, callback-time source edits, unload/re-enable barrier, either plugin loading order, MWC absent-Reports notice, observed/disabled moves, both-disabled native embeds and disabled restart. Environment: Obsidian 1.13.7 / Electron 43.3 / Chromium 150 on Linux. Failed diagnostic attempts are not counted as successful checks.

## Static exports, no plugins loaded

```sh
node scripts/verify-exports.mjs /path/to/codex-press /tmp/murmuration-reports-manager-THKR5X/vault
```

The optional manager fixture must carry the disposable fixture marker. The script copies synthetic content into a separate export vault, never loads either plugin, and uses Codex Press's real static transclusion and PDF/EPUB/DOCX planners/executors. Codex Press source: `93af44922cdb1b83b6166c4f8429d7d9f5b32c07`; existing `pandoc`, `xelatex` and `rsvg-convert` toolchain.

Successful final export evidence: `/tmp/murmuration-reports-exports-ovFYfF/evidence.json`. The fixture originated from the earlier successful manager run `aphTa6`; its manager-created/edited definitions and saved SVG/table are byte-identical to the final `THKR5X` fixture (verified separately). All three exports include both original and manager-created chart/table assets. PDF text, EPUB SVG/HTML table and DOCX drawing/Word table checks pass, with spaces/Unicode and all sources/assets/receipts unchanged. Missing chart blocks each format; missing table blocks static transclusion. The deliberately externally edited table still compiles with no plugin, demonstrating independence from receipt validity. PDF chart/table layouts were visually inspected; this is not qualification in every physical EPUB/Word reader.

## Installed sizes

Node 24.19.0 / esbuild 0.23.1. Gzip figures use independent asset compression; total is their sum.

| Reports asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| JavaScript | 166,873 | 52,490 |
| Scoped styles | 1,685 | 543 |
| Manifest | 266 | 187 |
| Installed total | 168,824 | 53,220 |

JavaScript is 136,177 raw / 41,962 gzip bytes larger than reviewed Stage 1. Pinned YAML 2.9.1 (ISC) is justified by source ranges and syntax validation; it is the sole bundled runtime dependency, with its complete notice included in main.js and THIRD_PARTY_NOTICES.md. Only Obsidian is external, with no plugin Node runtime imports. Build tools/types are not shipped.

No manager code or dependency is added to MWC. MWC's merged tree is exactly the measured transition tree: JS 667,724 / 188,600 gzip; styles 63,555 / 10,217; manifest 277 / 185; installed total 731,556 / 199,002. Its 720,896-byte JS ceiling retains **53,172 bytes** headroom; result is 1,972 below the 669,696 warning threshold. Installing both plugins adds Reports' assets; combined installation is not a size saving.

## Limits and release gates

No release or live-vault installation was performed. Stage 2 remains a review PR. General release requires review/merge approval and deliberate release qualification/packaging; Reports must be available before the transition MWC release. The bridge remains for one transition release and is removed in the following MWC release.

No mobile or Windows live UI claim; Windows CI establishes build/test portability only. Reader-specific EPUB/Word visual qualification remains unverified. Source-preserving editing deliberately refuses ambiguous YAML structures and overlapping reconciliation; drafts are session memory, not persisted after tab close/unload. Explicit saves/generation conservatively reject unreadable declaration frontmatter and can require retry after unrelated concurrent Markdown edits. SDK external-writer and multi-file/crash-atomic limits from Stage 1 remain unchanged. No orphan scan or automatic generation is introduced.
