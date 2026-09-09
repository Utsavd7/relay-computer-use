# Run evidence

These are captured executions against the running, nested-frame banking sandbox. All records are synthetic. Identifiers and returned balance values are redacted at the persistence boundary.

- `discover/`: genuine local MLX Qwen3-4B discovery. Five live model decisions complete the search → member → savings account → read workflow. Model exchanges include prompts, responses and usage.
- `browser-discovery/`: independent successful WebGPU Qwen3-4B discovery in Chromium, using five real model decisions and cached device-local weights.
- `capability.json`: the typed artifact emitted by that discovery, also bundled into the app.
- `replay/`: the artifact replayed with a different member, with zero model calls.
- `not-found/`, `invalid-input/`, `slow/`, `transient/`, `dialog/`, `permission-denied/`, `unknown-error/`, `ambiguous-target/`: deliberate outcomes and exceptional states.
- `handoff/`: automation pauses, browser-driven operator interaction restores the same live session, and execution resumes. Frame identity and human-action capture are checked by the verifier.
- `aborted/`: cancellation while waiting for the operator.
- `tenant-harbor/`: the original artifact used against the second vendor variant.
- `assisted-recovery/`: exactly one real model recovery, explicitly marked assisted. This is not deterministic replay evidence.
- `stability.json` and `stability-*/`: five repeated unassisted runs and their observed results.
- `approved-capability.json`: locally reviewed capability after stability validation.
- `generated-automation.mjs` and `generated-code-verification.json`: runnable generated invocation and its successful execution.
- `catalog.json`: the callable capability schema.
- `verification.json`: integrated check results; known failure cases are intentionally successful tests of safe behavior.
- `ui-verification.json`: desktop/mobile replay, font-loading and overflow checks.

The two-minute screen recording is in `public/demo.mp4`, with English captions in `public/demo.vtt`. Screenshots in discovery are masked; the video only displays synthetic training records.
