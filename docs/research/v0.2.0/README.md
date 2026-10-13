# Reporting capabilities: v0.2.0 research and design

Status: bounded final recommendation and **proposals for review**, 2026-10-13. No implementation decision has been accepted. v0.2.0 is a planning target, not a promise to ship every proposed capability.

[Epic #3](https://github.com/MurmurationPress/murmuration-reports/issues/3) tracks the checklist and dependencies. P0: [plugin survey #4](https://github.com/MurmurationPress/murmuration-reports/issues/4), [architecture #5](https://github.com/MurmurationPress/murmuration-reports/issues/5), [publishing #10](https://github.com/MurmurationPress/murmuration-reports/issues/10). P1: [plotting #6](https://github.com/MurmurationPress/murmuration-reports/issues/6), [chart types #7](https://github.com/MurmurationPress/murmuration-reports/issues/7), [tables #8](https://github.com/MurmurationPress/murmuration-reports/issues/8), [KPIs #9](https://github.com/MurmurationPress/murmuration-reports/issues/9).

- [First milestone, explicit-pair contract and bounded gates](first-milestone.md)
- [Bounded renderer recommendation](renderer-review.md)
- [Plugin survey and evidence](plugin-survey.md)
- [Current architecture](architecture-review.md)
- [Proposed ADR](../../adr/0001-reporting-pipeline.md)
- [Functional design sketches](design-sketches.md)
- [Publishing pathway, acceptance matrix and results](publishing.md)
- [Synthetic publication fixtures](fixtures/README.md)
- [Machine-readable source/release evidence](sources.json)

Audience: authors and publishers, project teams and environmental monitoring users. The product generates persistent reports from authoritative Markdown; advanced statistics belong in dedicated scientific applications. No nonlinear regression, advanced modelling or scientific-software workbench is proposed.

Recommended first implementation milestone **after all P0 recommendations are reviewed**: additive fixed Y bounds and explanatory captions, dash/marker series identity and explicit observation-pair comparisons, proven on unchanged legacy definitions and synthetic PDF/EPUB fixtures. This addresses concrete migration blockers before adding more chart families. Subsequent milestones: scatter and simple bar/column; richer comparisons and Markdown-first KPI scorecards; grouped/stacked bars and explicitly binned histograms. Pie/doughnut and radar remain ranked design candidates, not release commitments.

Review gate: accept the bounded custom-SVG/reference/compatibility recommendation and dispose of the Codex Press authored-width limitation (#145). Corrected specimens meet digital typography targets, but requested-width placement is not established. P0 is not ready for unconditional acceptance until that publishing contract is resolved or explicitly narrowed. Initial evidence does not close any child issue. No production source, dependency, output schema, existing saved asset or release metadata is changed.
