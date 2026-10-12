# Independent Stage 1 review

Reviewed original Reports `1f075a92dc71f3a2ef4ea2e69476e9581247caa3` and MWC `323a34266d6648c8d046139aeced99434a3f1773`, against extraction source `d7c2e6e625e98fade7004a064ab081670e607d4e`. All five pure core files remain byte-identical. Original exact-head Ubuntu/Windows CI passed, but eight additional safety reproductions failed before corrections.

## Fixed findings

- High: a rejected create/replace was treated as a committed mutation. Compensation could delete or revert a concurrent writer's byte-identical asset. Only API-confirmed writes now qualify; uncertain files and verified recovery copies are retained, never reported successful. Newly created files are never deleted on failure.
- Medium: unload during a pending native process callback could still mutate; re-enable could race its recovery. Callback-time guards and an app-scoped queue prevent this. Pending dialogs close on unload.
- Medium: an empty receipt owner was adoptable, unreadable uncached frontmatter could conceal a competing definition, and nonportable/case/Unicode aliases could bypass collision checks. Receipt/path validation and conservative fresh metadata handling now reject these cases.
- Medium: marker-like prose blocked valid chart/table regeneration; CRLF/EOF legacy markers were rejected. Recognition now requires actual canonical comments, rejects duplicate/conflicting comments and cannot use a table marker to own an SVG.
- Medium: the adoption regex accepted malformed SVG XML. Native XML parsing now validates without rendering the markup. Consent and source snapshots are checked again at the SDK callback boundary, including source edits and former owners reappearing.

Focused reproductions are in `tests/ReviewSafety.test.ts` and `tests/AdapterLifecycle.test.ts`. Native disposable-vault validation exercises callback-time source edits, unload/re-enable, adoption, definition moves and both-disabled rendering. Export validation uses Codex Press's real PDF/EPUB/DOCX executors without loading either plugin; source and asset bytes are preserved.

## Limits and release gate

No SDK multi-file transaction, exclusive create, atomic compare-delete or external-sync lock is claimed. An SDK rejection after a write is ambiguous; retained files/backups require inspection. Conditional restoration of confirmed replacements remains best effort against external writers. No mobile or Windows live UI qualification is claimed. At this review point, both PRs were open and manager/release qualification was pending. Both implementation stages have since merged; local acceptance and release qualification have passed for 0.1.0.

## Reproduced evidence

Reports: 75 tests, strict types, production build and packaging checks pass. Disposable native evidence: `/tmp/murmuration-reports-live-gYqRpj/evidence.json`; Reports bundle SHA-256 `6b6006b6a5652d293bd296ccb0dd09782cbedde84669625f0932d7fa7fd0772f`. Export evidence: `/tmp/murmuration-reports-exports-x8IbuW/evidence.json`; independently inspected PDF page 4. MWC: 981 TypeScript and 15 script tests pass; unchanged final bridge build is 667,724 JS bytes / 188,600 gzip, CSS 63,555 / 10,217, manifest 277 / 185, installed total 731,556 / 199,002. Baseline JS 682,304 / 193,378; ceiling headroom 53,172.
