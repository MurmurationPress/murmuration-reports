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
