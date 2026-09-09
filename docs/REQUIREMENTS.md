# Assignment coverage map

| Brief                        | Implementation                                                         | Proof                                                      |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| 3.1 Goal-driven LLM loop     | Runner.discover + local Model adapter; real nested-frame UI            | evidence/discover/model-exchanges.json and run.json        |
| 3.2 Typed versioned artifact | Zod ArtifactSchema, parameter binding, output schema and checkpoint    | evidence/capability.json                                   |
| 3.3 Deterministic replay     | Runner.replay, output/identity validation, explicit outcomes           | evidence/replay, not-found, slow, transient, unknown-error |
| 3.4 Safety                   | Route/action allowlist, unique matches, risky-action block, redaction  | unit tests; evidence/risky-action-blocked                  |
| 3.5 Observability            | Redacted structured events and failure snapshots; CLI screenshots      | evidence directories                                       |
| 3.6 Human control            | Pause, same-session manual interaction, capture, resume, abort         | evidence/handoff and aborted                               |
| 3.7 Heterogeneity/scale      | Surface interface, nested frames, vendor versioning and tenant binding | REPORT.md; evidence/tenant-harbor                          |
| Capability interface         | Catalog and typed invoke; feature-detected WebMCP registration         | evidence/catalog.json and invocation tests                 |
| Code generation              | Export runnable Playwright invocation of shared interpreter            | evidence/generated-automation.mjs                          |
| Confidence/approval          | Unassisted validation counts, draft→approved gate                      | evidence/approved-capability.json and approval-gate        |
| Assisted fallback            | One allowed model recovery click, separately classified                | evidence/assisted-recovery                                 |
| Cross-tenant reuse           | Shared artifact + explicit control-name override                       | evidence/tenant-harbor                                     |
| Multi-run stability          | Five runs with measured outcomes                                       | evidence/stability.json                                    |

The mock is the target banking application and synthetic dataset, not the discovery model or handoff mechanism. The operator in automated evidence is a browser-driven human stand-in; the product supports actual manual takeover. Native WebMCP support is optional and experimental; the portable callable interface is verified.

Presentation requested beyond the brief: a consistent shared color system, an accessible responsive workbench, and the same end-to-end walkthrough in 4K at 1:45. Evidence: `color-verification.json`, `redesign-verification.json`, and `demo-verification.json`. The target records are synthetic; the UI execution and model discovery are real.

## Submission audit against the complete brief

Rechecked against all ten pages of Assignment A on 9 September 2026. The numbered requirements above are implemented for one bounded savings-balance workflow. The following distinctions matter when reviewing the submission:

| Additional detail in the brief | Where to verify |
| --- | --- |
| Goal plus concrete target entry point; real observe/decide/act loop with stopping limits | `scripts/cli.ts`, `core/engine.ts`, `core/models.ts`; `RELAY_URL` selects the workbench, whose surface adapter targets the permitted banking UI |
| Artifact independent of the raw model transcript | `evidence/capability.json` versus `evidence/discover/model-exchanges.json`; the artifact contains parameter bindings instead of recorded member values |
| Stable targeting and typed outputs checked against the requested identity | `core/schema.ts`, `core/surface.ts`, `core/engine.ts`; checkpoint, invalid-input and ambiguity checks |
| Expected outcomes, bounded recovery and hard failure remain distinct | `evidence/not-found/`, `transient/`, `dialog/`, `permission-denied/`, `unknown-error/`; `evidence/verification.json` |
| Configurable policy and conservative treatment of irreversible actions | `defaultPolicy` in `core/schema.ts`, enforcement in `core/surface.ts`, risky-action evidence and tests |
| Sensitive data excluded from saved artifacts and logs | Parameterized artifact, marked sensitive UI fields, `core/privacy.ts`, redaction tests and sanitized failure snapshots |
| Rich failure evidence, beyond a status code | `observed` snapshots in failed `run.json` files include the sanitized screen, route, version and available controls |
| Intervention context, explicit ownership, same-session takeover, manual-action capture, resume and abort | `Runner.handoff`, `BrowserSurface.onHumanAction`, `evidence/handoff/`, `evidence/aborted/` |
| Extending to legacy web, desktop, tenant overlays and version drift | `Surface` interface and the Heterogeneity & multi-tenant section of `REPORT.md`; two live browser variants are implemented, desktop execution is a documented extension |
| Root README: setup, configuration, offline/service-free replay, exact discovery and replay commands | `README.md`; the committed discovered artifact allows replay without a model service |
| Root REPORT: all seven exact headings, reasoning, limits and next steps | `REPORT.md`: Architecture; Artifact schema; Determinism & error handling; Heterogeneity & multi-tenant; Escalation & handoff; Safety; Cuts |
| Required artifact and evidence from genuine discovery and replay | `evidence/capability.json`, `evidence/discover/`, `evidence/replay/`; actual model exchanges are included |
| Public repository and email handover instructions | `docs/HANDOVER.md`: repository URL on its own line, send from the application email, no ZIP; email remains a draft |

The PDF recommends choosing at most one or two optional extensions. All six are included following the additional request for every optional item; each reuses the same executor and has evidence. The design-only allowances in the brief are documented honestly rather than presented as implemented infrastructure. The video, visual identity and hosted landing page supplement the required code and evidence.
