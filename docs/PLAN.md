# Relay implementation scope

All Section 3 requirements, all six stretch goals, public no-login landing/workbench, 1:45 real-UI walkthrough in 4K, README, seven-section REPORT, authentic discovery/replay evidence, GitHub and hosting.

Architecture: a typed TypeScript interpreter shared by browser workbench and Playwright CLI. BrowserSurface reads/acts on a same-origin legacy-style nested iframe; the target exposes no automation API. Discovery gets redacted observations and returns constrained actions. Free WebLLM handles hosted discovery; free local MLX or Ollama handles CLI discovery. No remote database: explicitly device-local browser storage plus portable artifact/evidence downloads.

Validation: schema/policy/ambiguity/redaction unit tests, genuine local-model discovery, different-input replay, business outcome, transient retry, unknown failure, handoff/resume, tenant variant, approval gate, generated code, one-step assisted recovery, stability, public deployment.

Brand: Relay, independent engineering submission; graphite/ivory/mint with a custom R mark and Outfit/DM Sans typography, technical workbench and concise explanatory landing page. No claims of affiliation or production banking readiness.
