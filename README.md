<div align="center">
  <img src="public/favicon.svg" alt="Relay" width="64" />
  <h1>Relay</h1>
  <p><strong>Discover a workflow. Record its contract. Replay with control.</strong></p>
  <p>A working computer-use automation system with local LLM discovery, deterministic replay, and live-session human handoff.</p>
</div>

## Try it

- **Public app:** https://utsavd7.github.io/relay-computer-use/
- **Walkthrough:** the landing page embeds a two-minute recording, with English captions.
- **Design:** [REPORT.md](REPORT.md)
- **Evidence:** [evidence/](evidence/) — real discovery, replay, exceptional outcomes, handoff, and stability results.

No application login, database service, hosted model subscription, or API key is required. Storage is explicitly local to the current browser. The target contains only synthetic records; the automation and UI interactions are real. This is a focused implementation of Assignment A, not a production banking integration.

### Immediate replay

Open the workbench. Leave **Replay** selected, enter member `67890`, and choose **Replay capability**. The saved capability runs through the live nested-frame banking UI, verifies the member and final checkpoint, and returns the current synthetic balance.

Try `99999` for a known not-found outcome. The condition selector injects slow loading, transient errors, a known dialog, permission denial, session expiry, or an unknown application error. For human takeover, select **Session expiry → human**, run replay, click **Restore session** in the live session, then **Return control**. You can also abort.

### Run locally

Prerequisites: Node.js 22.13+ and npm. A Chromium-compatible desktop browser is recommended. Replay works without WebGPU or a model download.

```bash
git clone https://github.com/Utsavd7/relay-computer-use.git
cd relay-computer-use
npm ci
npx playwright install chromium
npm run dev
```

Open the exact local URL printed by the server (normally `http://localhost:3000`). The workbench is `/?app=1`. Keep this server running for the CLI commands below.

### Genuine model discovery

**Browser:** select Discover, enter the goal, and start discovery. WebLLM downloads model weights and performs inference on your device. Weights are cached in IndexedDB on the device. The first load is substantial; WebGPU, sufficient GPU memory, and a modern Chrome/Edge browser are required. A download or inference failure is reported; it never falls back to fake model decisions.

**CLI with a free local model:** on Apple Silicon, install MLX-LM in a virtual environment and start the model server in a separate terminal:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install mlx-lm
mlx_lm.server --model mlx-community/Qwen3-4B-Instruct-2507-4bit --host 127.0.0.1 --port 8766
```

Then run the real discovery and replay in another terminal:

```bash
MODEL_URL=http://127.0.0.1:8766/v1/chat/completions \
MODEL_NAME=mlx-community/Qwen3-4B-Instruct-2507-4bit \
npm run discover -- --member 12345 \
  --goal "Look up this member and read their current savings balance."

npm run replay -- --artifact evidence/capability.json --member 67890
npm run replay -- --artifact evidence/capability.json --member 99999 --out evidence/not-found
npm run replay -- --artifact evidence/capability.json --member 24680 --tenant harbor --out evidence/tenant-harbor
npm run replay -- --artifact evidence/capability.json --member 12345 --scenario transient --out evidence/transient
npm run replay -- --artifact evidence/capability.json --member 12345 --scenario handoff --headed --out evidence/handoff-manual
```

On other platforms, use an OpenAI-compatible **local** model server such as Ollama, set `MODEL_URL` to its `/v1/chat/completions` endpoint, and `MODEL_NAME` to its installed model name. The CLI rejects non-loopback model URLs. This alternative is supported by the protocol; the submitted genuine evidence was generated with MLX.

`MODEL_URL` and `MODEL_NAME` are needed only for discovery or explicitly assisted recovery. `RELAY_URL` can target a running deployment, including `?app=1`. No secret belongs in source or configuration. Headless CLI failures terminate and save evidence; `--headed` enables actual operator intervention.

### Result contract

- `success / OK`: checkpoint and member identity matched; outputs contain `balance: number` and `currency: string`.
- `business_outcome / MEMBER_NOT_FOUND`: a legitimate application answer, not an exception.
- `failure`: step, expected state, sanitized observed state, and a diagnostic code.

Every result carries `model_calls`, `assisted`, and `run_id`. Deterministic replays have zero model calls. An assisted recovery is separately labeled and never counted as a deterministic stability success. Caller outputs exist in memory; persisted evidence redacts balance values and member identifiers.

### Capability interface and stretch goals

In the workbench console, or through a browser agent:

```js
window.relay.catalog();
const { artifact } = window.relay.snapshot();
await window.relay.invoke(artifact, { member_id: '67890' });
```

The invocation returns `{ result, artifact, events }`. It uses the same session lock and executor as the UI. A small feature-detected WebMCP surface registers `relay_list_capabilities` and `relay_replay_balance` where available; the portable `window.relay` interface works without that proposed browser API.

All six optional extensions are included:

| Extension                       | How to exercise it                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Agent-facing capability catalog | `window.relay.catalog()` and `invoke()`; [catalog evidence](evidence/catalog.json)                            |
| Runnable code generation        | Capabilities → Export runnable code; `node evidence/generated-automation.mjs`                                 |
| Confidence and approval         | Validate 5 replays, then Approve; enable Require approval to gate execution                                   |
| Bounded assisted fallback       | Select session expiry, enable one model recovery; exactly one allowlisted recovery click                      |
| Cross-tenant reuse              | Replay the same artifact on Harbor; explicit Search members → Find member binding and supported version check |
| Multi-run stability             | Five replay runs, observed success rate, per-run evidence; no inflated statistical guarantee                  |

The catalog is an API **to the automation system**. The target application exposes no automation API and is always operated through its UI.

### Validation and reproducibility

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
# Include the real local-model assisted recovery test:
TEST_ASSISTED=1 npm run test:e2e
```

The UI server must be running for `test:e2e`. The genuine discovery artifact is committed so replay and most verification require no live model service. Unit-test fake surfaces/models are isolated in tests and are not presented as discovery evidence.

The recorder can reproduce the walkthrough with the local model server running:

```bash
npm run demo:record
```

See [docs/DEMO.md](docs/DEMO.md) for narration/caption production and recording prerequisites. Review [evidence/verification.json](evidence/verification.json) for the actual completed checks rather than inferring coverage from this command list.

### Project map

```text
core/schema.ts        Typed capability, action, parameter and result contracts
core/engine.ts        Discovery/replay, ownership, outcomes, recovery, approval
core/surface.ts       DOM/legacy-frame adapter; UI targeting and policy enforcement
core/models.ts        Live observation → model choice; local WebLLM adapter
core/privacy.ts       Redaction at evidence boundaries
public/bank*.html     Real, synthetic, nested-frame target UI
components/relay/    Landing page and operator workbench
scripts/cli.ts        Genuine discovery and deterministic replay commands
scripts/verify.ts     Integrated verification and evidence generation
scripts/record-demo.ts  Actual product walkthrough recording
REPORT.md             Architecture and deliberate trade-offs
```

### Hosting and handover

`npm run build` produces static files in `dist/`. The repository includes a GitHub Pages workflow for public hosting. No server or database is needed for the deployed app; model inference stays in the visitor's browser. The first model download needs network access. Local-model CLI discovery is the reproducible alternative for devices without WebGPU.

The repository includes the required source, README, seven-heading REPORT, and evidence. [docs/HANDOVER.md](docs/HANDOVER.md) contains a reviewer walkthrough and submission checklist. The hiring email should contain the public repository URL on its own line, be sent from the application email address, and contain no ZIP attachment.

### Limits worth understanding

Only the savings-balance capability profile is implemented; arbitrary goals with different output contracts require a new profile. The browser adapter controls the same-origin sandbox, not arbitrary cross-origin websites. Desktop support and institution-scale tenancy are designs, not implemented products. Approvals are device-local review markers; a real deployment would need authenticated reviewers, signed artifacts, authorization, and encrypted institutional storage. Risk classification uses an explicit small deny rule set alongside route/action allowlists; it is not a general semantic safety classifier. See REPORT.md for the complete boundaries.

### Primary references

[WebLLM](https://webllm.mlc.ai/docs/), [MLX-LM](https://github.com/ml-explore/mlx-lm), [Qwen model card](https://huggingface.co/mlx-community/Qwen3-4B-Instruct-2507-4bit), [Playwright](https://playwright.dev/), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages).
