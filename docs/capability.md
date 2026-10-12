# Transition capability version 1

Reports registers `app.murmurationReports` on load and removes it on unload only if the registration still belongs to it. This namespaced extension is a small documented contract between the two plugins, not an Obsidian plugin-registry API.

The capability has `version: 1`, `generateDefinition(path): Promise<ReportResult>`, `generateAll(): Promise<readonly ReportResult[]>`, and `showResults(results): void`. Results carry definition/output paths, status (`created`, `replaced`, `unchanged`, `blocked`, `failed`), message, observation count and optional recovery paths.

Both plugins resolve the capability when a command runs. They capture the active Markdown path synchronously, before awaits. The coordinator serialises all generation requests using an app-scoped versioned mutation queue retained across disable/re-enable. Unload closes its dialogs and guards prevent pending callbacks from writing after disposal. The MWC bridge performs no discovery, parsing, rendering, adoption or vault writes. Unavailable/incompatible capabilities produce an enable-Reports notice. Re-enabling installs a new coordinator; an old inspection is not accepted by the new instance.

This app-scoped capability disappears with the one-release bridge. It is not required by the standalone plugin, definitions, assets or Codex Press.
