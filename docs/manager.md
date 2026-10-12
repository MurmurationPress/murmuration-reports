# Reports manager

Open **Reports** from the ribbon or **Open Reports** command. Repeated requests reuse one workspace tab. Search report names and filter charts, state tables and problem states. Duplicate names always include vault paths. Select a report to inspect its definition/source/output destinations, diagnostics and saved asset. Narrow desktop panes stack the list above the details.

Markdown definitions and saved assets remain authoritative. The catalogue is an in-memory metadata projection; there is no report database, orphan scan, background generation or automatic migration. Availability means **Saved output available**, never “current”. No timestamp-based freshness claim is made.

## Create and edit

Create report collects title/name, definition destination, dataset folder, date property, ordered numeric fields/labels and output. Charts support one to four series, subtitle, axis labels, start/end dates and a duration window. State tables support ordered parameters and an endpoint. Definition/output defaults are `Reports/Definitions/<name>.md` and `Reports/Outputs/<name>.svg` or `.md`. Paths are validated, never silently renamed. Both new definitions and outputs must stay outside declared dataset folders. Changing an output declaration leaves the previous asset untouched.

Dataset folder suggestions come from the vault. Property suggestions are an explicit action sampling at most 200 cached source notes; they may be incomplete. Sources are recursive, and generation validates all observations, including those outside a selected date window. No observation is created or edited.

**Save definition** writes only the definition. **Save and generate** explicitly requests a save followed by generation. Editing by itself does not generate, move outputs or repair ownership.

The editor uses pinned YAML 2.9.1 syntax nodes/source ranges. Changed scalar values are patched in place; untouched keys, comments, quote styles, unknown top-level/nested fields and the Markdown body remain intact. Block-list additions/removals and existing flow-list leaves are supported. Structural changes that cannot preserve the source safely explain the limitation and offer Open definition. Duplicate keys, aliases/anchors, merge keys and explicit tags require repair in the note rather than destructive guided saving. Their existing definition can still be handled by the generation coordinator where its schema is valid.

Explicit saves also read the current Markdown declaration inventory for collision safety, without interpreting observation values. Unreadable frontmatter elsewhere can block a save until repaired. Inventory and native change counters are rechecked inside the write callback, so coalesced catalogue lag is not permission to write. Definition writes read the latest content, use `Vault.process` conditional callbacks, verify the saved bytes, share the generation mutation queue and check plugin lifecycle inside the write callback. External edits keep the user's draft. **Reload latest (replace draft)** is explicit; **Reconcile with latest** performs a conservative three-way merge, retaining independently changed fields/comments and refusing overlapping field changes. Drafts and generation outcomes live only in memory for the session; they are not another source of report configuration. Refreshes and failures retain drafts. Closing the tab or disabling the plugin discards unsaved drafts.

## Saved previews and generation

Only the selected asset is read. A valid receipt or exact legacy table marker must bind it to that definition. Mismatched/unknown ownership, collisions and invalid definitions are explained; unrelated matching files are not previewed. The latest definition declaration is checked before association. SVG is displayed as an image resource made from inspected saved bytes, with no markup injection. Tables use a static table-only renderer: no Markdown processors, embeds, HTML or dataset evaluation. Open output remains available for manual inspection when preview fails.

Generate one/all uses the existing Stage 1 coordinator and displays per-report results that persist while the plugin stays loaded. A failed report does not authorise blanket adoption or damage another output. **Inspect adoption / repair** uses the existing exact-content consent dialog, coordinator, ownership checks and recoverable copies. Definition moves retain path-based identity; former-path markers/receipts need explicit repair. Moving a definition while disabled never guesses its former identity.

## Refresh and lifecycle

One initial Markdown metadata enumeration seeds the catalogue. Changed paths are coalesced for 80 ms and reconciled in batches of at most 64; renders reuse the cached projection. Folder/asset changes invalidate structural diagnostics without enumerating the vault again. Metadata arriving after startup reconciles only previously unresolved paths. Known malformed definitions remain visible; initial malformed-frontmatter candidates identified by metadata are read in bounded batches of 16. Those reads identify definition syntax, never interpret observations. Explicit Refresh may enumerate metadata again.

Only relevant selected output/receipt/definition changes refresh a preview, with coalescing and disposal of old image resources. No output is read for every list render. Observed definition renames retain selection and drafts; a draft stays bound to its original path until explicit reload/reconciliation. Unload cancels pending UI timers, removes listeners, closes adoption dialogs and detaches manager tabs. In-flight writes retain the documented SDK limitations and shared barrier.

## Ownership and SDK limits

The [ownership and recovery policy](ownership.md) still applies. No exclusive create, external-sync lock, crash-atomic transaction or atomic compare-delete is claimed. Definition save failures do not attempt speculative rollback; inspect a possibly written definition after an SDK rejection. Saved SVG/Markdown and embeds display and compile with both plugins disabled; receipts and manager catalogue are unnecessary for publication.
