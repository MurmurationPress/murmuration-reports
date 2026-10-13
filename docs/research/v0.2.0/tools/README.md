# Isolated research experiments

These scripts do not change Reports or Codex Press functionality. Outputs must be directed to disposable directories, outside any real vault. Use Node 22+.

## Publication fixtures

Use an installed Codex Press checkout at the commit recorded in publishing.md; it needs its existing dependencies plus Pandoc, XeLaTeX, rsvg-convert, EPUBCheck and PDF text tools on PATH. No dependency installation or toolchain provisioning is performed by this harness.

```bash
node docs/research/v0.2.0/tools/run-publication.mjs ../codex-press docs/research/v0.2.0/fixtures /tmp/reports-publication-review
```

The harness constructs an assembled synthetic book, strips frontmatter as the compiler normally does, and invokes existing production PDF/EPUB planners and executors. It deliberately bypasses discovery/manuscript assembly and does not qualify the Obsidian UI or Markdown transclusion end to end. It checks all 80 table row markers occur exactly once in extracted PDF text. Outputs and working diagnostics remain in the disposable directory.

## Renderer spike

Copy `renderer-spike.mjs` to an empty scratch directory, install the exact research packages there, then run it from that directory. This is an experiment, not a production dependency proposal.

```bash
npm install --ignore-scripts --no-audit --no-fund --save-exact echarts@6.1.0 vega@6.4.0 vega-lite@6.5.0 chart.js@4.5.1 d3-scale@4.0.2 esbuild@0.23.1
node renderer-spike.mjs
```

The script records CJS/es2018 minified raw/gzip standalone bundle sizes, emits paired ECharts and Vega SVGs and compares exact bytes for repeat calls in one process. Run again in a fresh process and compare output files separately. No canvas shim is installed. For the original transitive versions, copy renderer-spike-lock.json to package-lock.json in the scratch directory and create package.json with the exact listed direct dependencies, then use npm ci --ignore-scripts. The research lock is not a production lockfile. Full engine output and modular choices are not equal feature surfaces and not measured incremental Reports cost.


## Bounded review reproduction

The revised positive publication harness accepts optional `WIDTH PROFILE --pdf-only` arguments. Use **fresh** output directories: the real compiler correctly refuses to overwrite an existing published output.

```bash
REPORTS_RESEARCH_SVG_CONVERTER=/tmp/reports-rsvg-reference node docs/research/v0.2.0/tools/run-publication.mjs ../codex-press docs/research/v0.2.0/fixtures /tmp/reports-p0-verified/reference-3.5 3.5 kdp_6x9 --pdf-only
REPORTS_RESEARCH_SVG_CONVERTER=/tmp/reports-rsvg-reference node docs/research/v0.2.0/tools/run-publication.mjs ../codex-press docs/research/v0.2.0/fixtures /tmp/reports-p0-verified/reference-4.1 4.1 kdp_6x9
REPORTS_RESEARCH_SVG_CONVERTER=/tmp/reports-rsvg-reference node docs/research/v0.2.0/tools/run-publication.mjs ../codex-press docs/research/v0.2.0/fixtures /tmp/reports-p0-verified/reference-5.5 5.5 draft_a4 --pdf-only
REPORTS_RESEARCH_SVG_CONVERTER=/tmp/reports-rsvg-fallback node docs/research/v0.2.0/tools/run-publication.mjs ../codex-press docs/research/v0.2.0/fixtures /tmp/reports-p0-verified/fallback-3.5 3.5 kdp_6x9 --pdf-only
```

The two converter wrappers set `FONTCONFIG_FILE` only when executing `/usr/bin/rsvg-convert "$@"`. In scratch reference configuration, include only `/usr/share/fonts/truetype/dejavu`; fallback includes only `/usr/share/fonts/truetype/liberation`. Each config has a scratch cachedir and ordinary `<fontconfig><dir>…</dir><cachedir>…</cachedir></fontconfig>` structure. Verify `fc-match` under that config and PDF font names. Do **not** apply those isolated configs to XeTeX, which needs its normal publishing fonts. No system font/configuration is changed. Font files/version/hashes are recorded in publication-review-results.json.

Research Python checks used a disposable venv with PyMuPDF 1.26.5 and Pillow 11.3.0. They are not production dependencies.

```bash
/tmp/reports-p0-review-venv/bin/python docs/research/v0.2.0/tools/prepare-fixtures.py docs/research/v0.2.0/fixtures
/tmp/reports-p0-review-venv/bin/python docs/research/v0.2.0/tools/audit-publication.py /tmp/reports-p0-verified/reference-3.5 docs/research/v0.2.0/fixtures
/tmp/reports-p0-review-venv/bin/python docs/research/v0.2.0/tools/audit-direct-widths.py docs/research/v0.2.0/fixtures /tmp/reports-p0-verified/direct-widths /tmp/reports-rsvg-reference /tmp/reports-rsvg-fallback
```

Repeat the publication audit for all four book directories. It checks standalone SVG text presence/bounds, point-size formula, all book page text bounds, observed chart-font minimum, table headings (including dehyphenation), and renders every report-bearing page greyscale. Its bounds checks are not a complete geometry-overlap proof; manually inspect every rendered report page. The direct-width audit measures exact converted PDF width, fonts/text and strokes for all eleven figures at three reference widths and narrow fallback width. Compiler placement must be measured separately because #145 overrides authored widths.

Copy `renderer-review.mjs` to the same isolated exact-version engine scratch environment used above, then run:

```bash
TZ=UTC LANG=C REPORTS_RESEARCH_THEME=light node renderer-review.mjs /absolute/path/to/murmuration-reports /tmp/reports-p0-review/renderer-utc-final
TZ=Pacific/Auckland LANG=en_GB.UTF-8 REPORTS_RESEARCH_THEME=dark node renderer-review.mjs /absolute/path/to/murmuration-reports /tmp/reports-p0-review/renderer-auckland-final
```

The theme flag is metadata, not an Obsidian simulation. Compare the recorded hashes and convert candidate SVGs via the reference wrapper at 3.5in. The unchanged production renderer is bundled into scratch for evidence; candidate configuration is a research experiment. The export-retention coexistence probe does not integrate an engine or measure a real production adapter. See renderer-review.md for exact scope and limitations.
