# Release preparation

The initial release is **0.1.0**, incorporating the accepted implementation merged at `0e39f1b3ba199c15744770e62463a94daff5b5af`. Local acceptance, 107 automated tests, native disposable-vault checks and PDF/EPUB/DOCX qualification have passed. See [validation evidence](stage-2-validation.md).

Use an annotated tag that exactly matches `manifest.json.version`: **`0.1.0`**, without a `v` prefix. Obsidian resolves release assets by the manifest version. A release title may use “Murmuration Reports v0.1.0”. Version metadata in manifest, package, lockfile and versions.json must agree; minimum app version remains 1.13.7, desktop-only.

1. Use a clean checkout containing the reviewed implementation. Refresh documentation without changing accepted functionality.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and `npm run release:check`. Confirm Ubuntu/Windows CI for the release commit.
3. Keep the MIT and bundled YAML ISC notices intact. Record SHA-256 for `main.js`, `manifest.json` and `styles.css`; ensure no MWC or Node runtime dependency enters the bundle.
4. Create/push the annotated version tag at the validated commit. Create a GitHub release with concise functionality, installation, requirements and limitations notes. Attach the three assets individually, using their exact filenames.
5. Download the published assets and compare bytes/digests with the validated build. Confirm the tag commit, non-draft/non-prerelease status and clean working tree.

Production assets are generated/assembled by the build and ignored in Git; manifest and styles are source-controlled. Publishing GitHub assets is separate from registering in Obsidian's community directory. There is no automatic publishing workflow. Reports must be available before the transition MWC release; this release does not modify or publish MWC.

Known limitations remain: desktop-only, no mobile or Windows live UI qualification, session-only drafts, conservative refusal of ambiguous YAML/ownership, and SDK limitations on exclusive creation, external-writer locking and crash-atomic transactions. Retain [ownership and recovery documentation](ownership.md) with every release.
