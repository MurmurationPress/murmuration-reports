# Murmuration Reports

Persistent SVG charts and Markdown state tables from ordinary vault properties. Sources and Markdown definitions remain authoritative. Saved outputs display and compile without Murmuration Reports or Murmuration Writing Companion (MWC).

This is **Stage 1**, an unreleased desktop implementation. The Reports manager, guided definition creation/editing, saved previews and bounded catalogue refresh belong to Stage 2. The first general release is gated on both stages and export qualification. Do not publish this stage as a complete product.

## Commands

- **Generate active report definition**: open a definition note and explicitly generate its output.
- **Generate all report definitions**: sequential generation with structured per-report results; one invalid report does not prevent independent valid reports.
- **Adopt active report output and generate**: inspect an existing unowned asset, confirm its exact definition and destination, then regenerate with a recoverable original copy.

Opening files, enabling the plugin, renames and vault events never generate or migrate files. There is no report database, background generator or orphan-asset scan. Definitions use `world_entity: derived-artefact`; [the preserved schema](docs/definitions.md) explains dates, source validation, windows and table deltas. [The example vault](examples/vault) includes public synthetic source notes, definitions and saved assets.

## Ownership and recovery

Each generated asset has a versioned `<output>.murmuration-report.json` receipt containing definition path, output path and SHA-256 digest. Receipts are safety metadata, never needed to view, embed or compile the asset. Exact legacy table markers are retained. Legacy SVGs need explicit adoption; filenames and nearby files are not evidence of ownership.

Generation rejects changed assets/receipts, competing definitions, canonical-note collisions and folders. Every changed existing asset gets a verified adjacent `.murmuration-report-backup` copy (numbered if necessary). Sources and definitions are never rewritten by generation. See [ownership and failure handling](docs/ownership.md).

## Development

Use Node 22 or newer: `npm ci`, `npm test`, `npm run build`, `npm run release:check`. Production has no bundled third-party runtime packages and only Obsidian is external. No Node API is used by plugin code. Native Obsidian modals need no custom stylesheet.

Install built `main.js` and `manifest.json` only into a disposable test vault. Production assets are ignored in Git. Ubuntu/Windows CI checks types, tests, build/dependency boundaries, versions and MIT attribution. There is intentionally no automatic release workflow yet.

Desktop-only support is declared. Linux live validation does not establish mobile or Windows live interaction support; Windows CI is a separate check. See [validation](docs/validation.md), [migration](docs/migration.md), [capability contract](docs/capability.md) and [provenance](docs/provenance.md).
