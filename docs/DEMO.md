# Product walkthrough

The landing page embeds `public/demo.mp4` with English captions from `public/demo.vtt`. It is an actual recording of the functioning application, including genuine local-model discovery; it is not an animation of invented results.

## Reproduce

1. Start the UI with `npm run dev`.
2. Start the MLX model server on loopback port 8766 as documented in README.
3. Ensure `evidence/capability.json` exists (run discovery if needed).
4. Run `npm run demo:record`.
5. Run `python3 scripts/render-demo.py` on macOS (FFmpeg and the installed Samantha system voice), or encode `work/demo/source.webm` to H.264 MP4 with FFmpeg; the committed video uses English system speech and captions for a concise two-minute narrated walkthrough.

Only synthetic records appear. Chapter overlays are presentation labels; screen states and outcomes come from the running app. The recording script also writes its real discovery exchanges and timing metadata into ignored `work/demo/`. The underlying submission evidence is independently captured in `evidence/`.

## Chapters

- 00:00 Product overview
- 00:10 Real local-model discovery
- 00:43 Typed reusable artifact
- 00:56 Deterministic replay with a new member
- 01:09 Known not-found outcome
- 01:19 Live-session human handoff
- 01:40 Cross-tenant reuse
- 01:51 Inspectable evidence

The recorded operator click is dispatched to the actual frame control to avoid browser coordinate issues at recording zoom. A separate non-zoomed test verifies ordinary browser clicks and same-session handoff.
