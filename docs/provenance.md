# Extraction provenance and attribution

Parser, date/window logic, normalisers, SVG/Markdown renderers and 21 original regression tests were extracted from Murmuration Writing Companion main **d7c2e6e625e98fade7004a064ab081670e607d4e**, fetched on 12 October 2026. The five production core files are byte-for-byte copies. The historical service is retained only under `tests/helpers/LegacyService.ts` as a golden compatibility oracle, with import paths adjusted. It is not shipped.

Source repository: https://github.com/MurmurationPress/murmuration-writing-companion/tree/d7c2e6e625e98fade7004a064ab081670e607d4e/src/derived-artefacts

MWC's MIT licence is copyright © 2026 Murmuration Press. This repository's existing MIT licence is preserved; production includes the licence text and source revision. There is no shared runtime package or charting dependency. Obsidian API types, esbuild and Node types are MIT; TypeScript is Apache-2.0. They are build dependencies, not shipped runtime code. No new font, artwork or template is included.
