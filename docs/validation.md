# Stage 1 validation — 12 October 2026

Extraction baseline: MWC `d7c2e6e625e98fade7004a064ab081670e607d4e`, freshly fetched main. Codex Press source: `93af44922cdb1b83b6166c4f8429d7d9f5b32c07`. All initial repositories were clean; dedicated Reports and MWC worktrees were used. No live author vault was read, installed into or modified.

## Automated checks

- Reports: **75 tests** (21 extracted regressions, 29 coordinator/safety/golden tests, 3 command/capability tests, 7 native-adapter boundary tests and 15 independent safety regressions), strict TypeScript, production build and packaging validation pass.
- MWC: **981 TypeScript tests and 15 script tests**, production/test type checks, build and release validation pass after removal. The two new bridge tests cover IDs, path capture, both loading orders, disable/re-enable, incompatible/absent capability and rejection.
- Golden checked-in SVG/Markdown and the historical service oracle match new outputs byte-for-byte. All five production core files retain their original bytes.
- Tests cover fresh reads despite lagging metadata caches, duplicate/trimmed destinations, invalid paths/sources/observations, source/definition preservation, exact markers, receipt mismatch, adoption expiry, former-path repair, concurrent edits, serialisation, unload cancellation, backup verification, output/receipt failures after writes and failed compensation.
- Runtime production imports are exclusively Obsidian. Build tools, tests, historical service and bundled npm packages are excluded. MIT licence and source revision are included in the bundle. Ubuntu/Windows CI performs the same package/type/test checks; remote results are available on the PRs.

## Live desktop check

Reproduce on Linux with `/opt/Obsidian/obsidian`, Node 22+ (native WebSocket required), and a graphical session:

```sh
npm run build
node scripts/verify-live.mjs /path/to/built/mwc-transition
```

The script creates a new `/tmp/murmuration-reports-live-*` vault/profile, copies unmodified built plugins, and verifies the exact vault before every runtime operation. Never pass an author vault. It closes the Settings window opened by Trust author and waits for Obsidian to persist disabled-plugin settings before restarting.

The successful run used Linux Obsidian **1.13.7**, Chromium 150 / Electron 43.3. Native pointer checks pass adoption Cancel, validated adoption and content-change rejection. Commands/capability checks pass Reports-only, Reports-first/MWC-second, MWC-only notice, MWC-first/Reports-re-enable and batch delegation. Renaming a definition leaves asset/receipt bytes unchanged until explicit former-path repair. A move while Reports is disabled is handled on re-enable with no inferred ownership. Both-disabled SVG and Markdown table embeds render; restart preserves source/definition/asset bytes.

Successful evidence: ``/tmp/murmuration-reports-live-gYqRpj/evidence.json``. Bundle SHA-256 values there bind the run to the production artifacts. Failed diagnostic runs are not counted as successful checks. No mobile support is claimed; minimum app version is the tested 1.13.7 and the manifest is desktop-only. Windows CI does not establish Windows live UI or physical keyboard/IME/theme qualification.

## Codex Press exports without either plugin

```sh
node scripts/verify-exports.mjs /path/to/codex-press
```

Requires existing `pandoc`, `xelatex`, `rsvg-convert`, `pdftotext`, `unzip` and Codex Press's installed development dependencies. The script copies the checked-in synthetic vault to a new temporary directory. No Obsidian plugin is loaded or invoked during export. It calls the real static-transclusion, PDF/EPUB/DOCX plan and executor paths, using Codex Press's SVG PDF conversion toolchain.

All three exports completed. PDF text contains vector-chart labels and the numeric table; visual inspection of page 4 confirms the chart, axes, legend and table are present without clipping. EPUB contains a packaged SVG image and numeric HTML table. DOCX contains a drawing/media asset and numeric Word table. These checks do not establish Kindle acceptance or a visual proof in every EPUB/Word reader.

Spaces/Unicode are present in dataset, output and embed paths. Missing Markdown table transclusion is an error; missing chart assets block each of the three export plans. All original Markdown, SVG and receipt bytes are checked after the run and remain unchanged. Successful outputs and evidence are retained under `/tmp/murmuration-reports-exports-x8IbuW`; PDF visual evidence is `/tmp/reports-independent-pdf-page.png`. Reproduction does not depend on those temporary files.

## MWC production size

Node 24.19.0 / esbuild 0.23.1; fresh lockfile install and unchanged build settings. After includes the final bridge.

| Asset | Before raw / gzip bytes | After raw / gzip bytes |
| --- | ---: | ---: |
| JavaScript | 682,304 / 193,378 | 667,724 / 188,600 |
| CSS | 63,555 / 10,217 | 63,555 / 10,217 |
| Manifest | 277 / 185 | 277 / 185 |
| Installed total | 746,136 / 203,780 | 731,556 / 199,002 |

Savings are **14,580 raw / 4,778 summed-gzip bytes**, with no relocation. JavaScript headroom is **53,172 bytes** against the 720,896 ceiling, and the result is 1,972 bytes below the 669,696 warning threshold. Reports' corrected production `main.js` measures 30,696 raw / 10,528 gzip bytes and is a separate installed asset, not excluded content in MWC. Installing both plugins is not a combined bundle-size reduction.

The older 705,732-byte investigation used revision `7799412`, not current main. Subsequent MWC changes include native CSS relocation and code reductions. The current 682,304-byte baseline reproduces #266. See MWC's committed bundle history for details.

## Historical release gate

At this Stage 1 checkpoint, manager implementation and release qualification were pending. They have since completed for 0.1.0; see [manager validation](stage-2-validation.md) and [release preparation](releasing.md). Obsidian APIs do not provide multi-file transactions or external-sync locks; interrupted writes may require receipt/asset recovery as documented.
