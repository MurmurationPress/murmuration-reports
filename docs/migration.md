# MWC transition

Extraction baseline: freshly fetched MWC main `d7c2e6e625e98fade7004a064ab081670e607d4e`. Manuscript numbering, annotation counts, entity indexes, continuity and other manuscript-aware reports stay in MWC.

Install/enable Reports to create or regenerate dataset assets. Existing definitions, assets, paths, embeds and legacy table markers are preserved. Nothing moves or regenerates during installation. There are no reporting settings to migrate; report configuration already lives in Markdown. Deleting/disabling either plugin leaves saved assets readable and compilable. PDF SVG conversion still needs Codex Press's existing `rsvg-convert` dependency.

For **one transition MWC release**, the old command IDs delegate to Reports at invocation, retaining their hotkey bindings:

| Old MWC full ID | New Reports full ID |
| --- | --- |
| `murmuration-writing-companion:generate-derived-artefact` | `murmuration-reports:generate-derived-artefact` |
| `murmuration-writing-companion:generate-all-derived-artefacts` | `murmuration-reports:generate-all-derived-artefacts` |

Reports-only runs independently. MWC-only retains the aliases but explains how to enable Reports; it contains no fallback generator. Both use one Reports coordinator. Neither is needed for saved outputs. Older MWC versions with their original generator cannot enforce the new safety policy; do not use those commands to overwrite assets managed by Reports.

Remove the bridge in the **next MWC release after the transition release**. Reassign shortcuts through Obsidian's Hotkeys settings before upgrading. Neither plugin edits hotkey files. Release notes in both repositories must name the transition and removal versions once scheduled.

Reports must be released and available before the transition MWC release. The general Reports release itself is blocked until Stage 2 and export qualification are complete. Stage 1 review/merge is not permission to release either transition prematurely.

Definition identity is its vault path. A rename/move never rewrites markers or receipts, relocates outputs, or generates. A stale former-path marker/receipt requires explicit adoption/repair when the former definition is absent. The same rule applies after a move made while disabled. No prior identity is guessed and no orphan asset scan runs. Editing an output destination leaves the old asset intact.
