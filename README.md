# Murmuration Reports

Persistent SVG charts and Markdown state tables from ordinary vault properties. Sources and Markdown definitions remain authoritative. Saved outputs display and compile without Murmuration Reports or Murmuration Writing Companion (MWC).

**Version 0.1.0** provides the Reports manager, guided creation and source-preserving editing, saved-output previews, explicit generation and bounded catalogue refresh. It works in ordinary vaults without MWC.

## Installation and requirements

Requires **Obsidian desktop 1.13.7 or newer**. Mobile is unsupported. Linux interaction and export checks have passed; Ubuntu/Windows CI checks build and test portability, without claiming Windows live UI qualification.

1. Download `main.js`, `manifest.json` and `styles.css` individually from the [0.1.0 release](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0).
2. Put all three files in `<vault>/.obsidian/plugins/murmuration-reports/`.
3. Reload Obsidian and enable **Murmuration Reports** in Settings → Community plugins.
4. Choose **Open Reports** from the command palette or ribbon.

MWC, Codex Press, Node.js and an npm installation are not required to use the plugin. Compilation of saved reports uses your compiler's existing toolchain; Codex Press PDF conversion of SVG requires `rsvg-convert`. Community-directory registration is separate from this GitHub release; manual installation does not require it.

## Commands

- **Open Reports** (also available on the ribbon): find, create, edit, preview and explicitly regenerate reports in a reusable workspace tab.

- **Generate active report definition**: open a definition note and explicitly generate its output.
- **Generate all report definitions**: sequential generation with structured per-report results; one invalid report does not prevent independent valid reports.
- **Adopt active report output and generate**: inspect an existing unowned asset, confirm its exact definition and destination, then regenerate with a recoverable original copy.

Opening files, enabling the plugin, renames and vault events never generate or migrate files. There is no report database, background generator or orphan-asset scan. Definitions use `world_entity: derived-artefact`; [the preserved schema](docs/definitions.md) explains dates, source validation, windows and table deltas. [The example vault](examples/vault) includes public synthetic source notes, definitions and saved assets.

## Ownership and recovery

Each generated asset has a versioned `<output>.murmuration-report.json` receipt containing definition path, output path and SHA-256 digest. Receipts are safety metadata, never needed to view, embed or compile the asset. Exact legacy table markers are retained. Legacy SVGs need explicit adoption; filenames and nearby files are not evidence of ownership.

Generation rejects changed assets/receipts, competing definitions, canonical-note collisions and folders. Every changed existing asset gets a verified adjacent `.murmuration-report-backup` copy (numbered if necessary). Sources and definitions are never rewritten by generation. See [ownership and failure handling](docs/ownership.md).

## Development

Use Node 22 or newer: `npm ci`, `npm test`, `npm run build`, `npm run release:check`. Production bundles pinned YAML 2.9.1 for source-preserving editing; its ISC notice is included in main.js and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Only Obsidian is external. No Node API is used by plugin code. Manager styles are scoped.

For development checks, install built `main.js`, `styles.css` and `manifest.json` into a disposable test vault. Production assets are ignored in Git. Ubuntu/Windows CI checks types, tests, build/dependency boundaries, versions and MIT attribution. There is intentionally no automatic release workflow yet.

Desktop-only support is declared. Linux live validation does not establish mobile or Windows live interaction support; Windows CI is a separate check. See [validation](docs/validation.md), [migration](docs/migration.md), [capability contract](docs/capability.md) and [provenance](docs/provenance.md).

See [manager behaviour and editing limits](docs/manager.md) and [Stage 2 validation](docs/stage-2-validation.md).

## Known limitations

Drafts and generation outcomes are session memory; closing the tab or disabling the plugin discards unsaved drafts. Ambiguous YAML, aliases, duplicate keys and overlapping edits require explicit repair or reconciliation. Unreadable declaration frontmatter and concurrent vault changes can block saves or generation. Legacy SVGs and uncertain ownership require explicit validated adoption.

Obsidian provides no exclusive create, external-sync lock or crash-atomic multi-file transaction. Interrupted or ambiguous writes may retain assets, receipts and recovery copies for manual inspection. See [the complete SDK limits and recovery policy](docs/ownership.md). Saved outputs remain usable with both plugins disabled.

See [release preparation and versioning](docs/releasing.md).

The [first milestone development branch](docs/implementation/first-milestone.md) adds explicit publication layout (fixed Y bounds, captions and dash/marker identity) and named observation-pair tables. These changes are pending implementation PR review; the published 0.1.0 release and existing legacy defaults remain unchanged. See [definitions](docs/definitions.md) for opt-in examples and qualification limits.
