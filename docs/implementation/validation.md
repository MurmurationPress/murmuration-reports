# First milestone implementation validation — 2026-10-13

Current status: the PR #13 implementation and subsequent PR #19/#21 editor work are merged. The pre-merge gate notes below are historical; the final scope, user acceptance and remaining qualification work are summarized in [the chart/editor closeout](../closeout/chart-editor-effort.md).

Historical implementation evidence for PR #13; see the subsequent [independent review](independent-review.md) for review results and remaining qualification. Production candidate `f6f5b75f68ca2de474d08c08121b6f83eb6bea6e` contains the four-feature implementation plus clarified manager guidance. The later evidence/harness changes do not change production behaviour. [Machine-readable ledger](validation-results.json) records source commits, exact bundle/tool/font/input/output hashes, native checks and actual compiler measurements.

## Research review and authorised merge

Fetched PR #11 at `508d38aa77fde9059400e2551db072afdfcd2724`. Corrected a stale fixture README hash and added the missing requested-width assertion to the standalone conversion audit. No production changes in that PR. Reviewed final head `20cc914c762857bdb98b72db27fd220cbab79565`: 107 tests, typecheck/build/packaging, JSON/Python/Node syntax, fixture hashes, local links and diff checks passed; all 44 standalone conversions and 44 recorded compiler placements reproduced. Exact-head Ubuntu/Windows CI passed: 38443629042 / 38443635423.

Marked ready and squash-merged with expected-head guard as **`c15efbe2f79809fd0139ea14ed69268862a04543`**. Reviewed/merged trees both `d04d10cdc5cdfd7804e92d1be7731f682aa74ee8`. Post-merge local checks and Ubuntu/Windows CI passed ([38443904405](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38443904405)). Separate implementation branch starts from that merged main.

## Production and compatibility checks

`npm test`: **129/129 passed**, strict types included. New cases test fixed-domain validation after unchanged whole-source validation/selection; deterministic caption/layout/glyph/height/XML diagnostics; shared chart/legend patterns/markers; explicit-pair insertion stability and missing/renamed/ambiguous/same-file/outside-source/equal/reversed dates/endpoint failures; finite delta overflow; source-preserving editing and opaque fields; coordinator receipts, collisions, changed assets, callback-time source edits, verified backup/recovery, disable barriers and adoption after definition moves.

Ten byte goldens were generated **independently from archived merged-main core code**, then checked by SHA-256 against current legacy output. They cover ordinary/single/constant/multiple/windowed/opaque-field charts and ordinary/first-observation/endpoint/tied-date tables. Existing command/capability, lifecycle and ownership suites also pass. No production dependency, version/manifest, receipt format, command or capability change; YAML remains the only bundled dependency and Obsidian the only external.

`npm run build` and `npm run release:check` pass. Exact candidate Ubuntu/Windows push and PR CI passed ([38448871364](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38448871364), [38448873831](https://github.com/MurmurationPress/murmuration-reports/actions/runs/38448873831)); final evidence-head checks are recorded on the draft PR.

| Asset/measure | Merged main | Candidate | Change |
| --- | ---: | ---: | ---: |
| Production JavaScript raw | 166873 | 179666 | +12793 |
| Production JavaScript gzip | 52490 | 57216 | +4726 |
| Installed total raw | 168824 | 181617 | +12793 |
| Installed total gzip | 53220 | 57946 | +4726 |

Styles and manifest are unchanged. This is **actual production bundle cost**, not the research engine standalone/coexistence estimates. Candidate main.js SHA-256: `515c7f8d69655c892fb713041c95511595c15fa36b953f946efe1d6021663ffd`.

## Native generation, saved previews and disabled persistence

Linux Obsidian 1.13.7 / Electron 43.3.0 / Chromium 150.0.7871.212. Every launch creates a new marked disposable vault/profile and verifies the exact vault in every runtime call; no author vault or manuscript was used.

Final native feature run: `/tmp/murmuration-reports-milestone-kX5v61/evidence.json`, using the candidate bundle. Manager controls enable publication, set fixed −1…+1 bounds and caption, and save/generate four actual series; preview loads the persisted 960-unit SVG. Pair controls generate an 80-parameter dated table and provenance preview. Inserting a middle observation keeps the pair/receipt unchanged; a rename fails with no predecessor substitution and retains prior asset/receipt; restoring the path allows explicit chart regeneration with a verified backup. Comments/body/unknown nested fields survive. Both assets render through ordinary Obsidian embeds after Reports/MWC are disabled, including a disabled restart. Original observations remain unchanged.

Existing native manager suite: 15 checks at `/tmp/murmuration-reports-manager-iNvMKX`; existing lifecycle suite: 15 checks at `/tmp/murmuration-reports-live-TLlbwr`. The manager run used the previous candidate hint text; its functional paths are unchanged. The lifecycle run uses the same core implementation. Its MWC peer is the existing built transition fixture (bundle hash in the ledger), not a claim of testing every current MWC release.

Two fresh processes (`TZ=UTC LANG=C`, `TZ=Pacific/Auckland LANG=en_GB.UTF-8`) reproduce the exact native SVG and marker-bearing table bytes. Final native generation also reproduces the same hashes as the earlier source vault used in the four-profile publishing matrix: SVG `8ad020ffb9ef64740d83e2656ecd28a818ca796e52db304dec106e2d2a39ede3`, table `4b8e21c850fb9ee2e0110d6b96126a8602fecca691f9056c819ad923517c075a`. The later UI hint change does not affect source parsing, selection, rendering or these assets.

Failed diagnostic attempts are retained, not counted as passes. The harness now makes its author-trust click one-shot, waits for disabled settings to persist, checks metadata readiness and yields before polling compiler modals. This avoids duplicate-load/startup timing races in the diagnostic driver. Generic native startup diagnostics are not a claim of an exception-free Obsidian session or all-platform lifecycle qualification.

## Actual feature-generated publication

Exact compiler: **Codex Press `394cf109f035194b440e3b37d75de06e49fe074d`**. Inputs are actual native-generated SVG/Markdown; no hand-authored research chart substitutes for implemented output. Static transclusion and production PDF/EPUB planners/executors run without either reporting plugin. Four fresh runs plus final-PDF audits are under `/tmp/reports-milestone-publication-final`.

| Run | Requested width | Measured final width | Minimum chart text | Minimum essential stroke |
| --- | ---: | ---: | ---: | ---: |
| KDP reference | 3.5in / 252pt | 251.99281pt | 8.39976pt | 0.78748pt |
| KDP reference | 4.1in / 295.2pt | 295.20001pt | 9.84000pt | 0.92250pt |
| A4 reference | 5.5in / 396pt | 396.00001pt | 13.20000pt | 1.23750pt |
| KDP Liberation fallback | 3.5in / 252pt | 251.99281pt | 8.39976pt | 0.78748pt |

Every placement matches within 0.02pt, with intrinsic ratio preserved. All chart text, axes, legends and captions survive; external caption shares its figure page. All 80 row markers occur exactly once per book, with dated continuation headings and all 80 absolute deltas +5.00. SVG/page text bounds pass. Every relevant page was inspected greyscale: KDP/fallback pages 7–11 and A4 pages 7–10. Four series remain identifiable by dash/marker; no visible clipping/overlap/lost table rows. The A4 table starts with one row below the figure before continuing; page composition remains the compiler's policy, not a promise of ideal editorial pagination.

EPUBCheck: zero errors/warnings; the generated SVG payload is byte-identical, all 80 rows are present and authored width is retained. Reader/AT qualification is not inferred. There is no direct SVG-only conversion result presented as compiler placement.

A separate native **Codex Press Compile book UI** run additionally exercises real folder-note discovery, distributed scene ordering, assembly, options, preflight, confirmation and PDF/EPUB execution with Reports/MWC absent. Successful evidence at `/tmp/murmuration-reports-publishing-ui-Y2NQXR`: actual 4.1in placement is 295.20001pt with 9.84000pt chart text, caption intact and 80 rows/deltas. EPUBCheck and exact SVG payload/rows also pass. Inputs remain unchanged. This supplements rather than replaces the four-profile matrix.

Legacy disabled-plugin export checks also pass PDF/EPUB/DOCX, missing assets and byte preservation (`/tmp/murmuration-reports-exports-ZRM367`), against the same compiler. No Codex Press production file was modified during this implementation.

The declared glyph subset is present in both installed fonts: 675 allowed code points checked with `fc-query`; single-glyph advances fit the 1.2em/1.6em bounds. Wide Latin digraphs require the larger bound. Font hashes/results are in the ledger. This is not exhaustive shaping/all-reader/font-substitution qualification. Reference DejaVu 2.37 and fallback Liberation 2.1.5 are installed host fonts, not distributed binaries. Tool versions: Node 24.19.0, TypeScript 5.9.3, esbuild 0.23.1, Python 3.12.3, PyMuPDF 1.26.5, Pillow 11.3.0, Pandoc 3.1.3, XeTeX/TeX Live 2023/Debian, librsvg 2.58.0, Fontconfig 2.15.0 and EPUBCheck 5.3.0.

## Reproduction and remaining gates

```bash
npm test
npm run build
npm run release:check
node scripts/verify-first-milestone-live.mjs /path/to/built/mwc-transition
TZ=UTC LANG=C node scripts/verify-first-milestone-determinism.mjs /tmp/MARKED_NATIVE_VAULT
TZ=Pacific/Auckland LANG=en_GB.UTF-8 node scripts/verify-first-milestone-determinism.mjs /tmp/MARKED_NATIVE_VAULT
REPORTS_RESEARCH_SVG_CONVERTER=/tmp/reports-rsvg-reference node scripts/verify-first-milestone-publication.mjs /path/to/pinned/codex-press /tmp/MARKED_NATIVE_VAULT /tmp/NEW_OUTPUT/reference-3.5 3.5 kdp_6x9 --pdf-only
# Repeat reference-4.1 (without --pdf-only), reference-5.5/A4 and fallback-3.5.
node scripts/verify-first-milestone-publishing-ui.mjs /path/to/pinned/codex-press /tmp/MARKED_NATIVE_VAULT
/tmp/reports-p0-review-venv/bin/python scripts/audit-first-milestone-publication.py /tmp/NEW_OUTPUT /tmp/NEW_OUTPUT/audit.json --native-ui /tmp/NEW_NATIVE_UI_ROOT
```

Use the research tools README's isolated converter/font wrappers and existing toolchain. Scripts refuse existing publication destinations and unmarked source vaults. Python packages are disposable validation tools, not production dependencies. Do not run generation into author vaults or regenerate existing user assets to reproduce these checks.

Before implementation merge: independent PR review of the narrowed schema, layout limits and source identity/error handling, and successful final-head checks. The five bounded implementation evidence gates in #12 are satisfied for the tested subset; that is not acceptance of broader #6/#8 designs or all publication scenarios. Keep #3/#6/#8/#12 open. Physical actual-size greyscale proof and author reading review remain pending before print-quality/release claims. EPUB/Kindle/AT readers remain unqualified; PDFs are untagged and accessible PDF remains separate Codex Press #144 work. Windows CI is build/test evidence, not live Windows Obsidian/PDF qualification. No implementation merge or release is authorised by this delivery.
