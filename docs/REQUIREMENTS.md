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
