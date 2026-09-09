# Product walkthrough

The landing page embeds `public/demo.mp4` with English captions from `public/demo.vtt`. It is an actual recording of the functioning application, including genuine local-model discovery; it is not an animation of invented results.

## Reproduce

1. Start the UI with `npm run dev`.
2. Start the MLX model server on loopback port 8766 as documented in README.
3. Ensure `evidence/capability.json` exists (run discovery if needed).
4. Run `npm run demo:record`.
5. Install FFmpeg and `pip install -r scripts/demo-requirements.txt`, then run `python3 scripts/render-demo.py`. The renderer uses the Andrew multilingual neural voice through `edge-tts`, normalizes loudness, and creates sentence captions. `--audio-only` renders a narration preview. The narration script is public, contains no member data, and is sent to the speech service only when rebuilding the video. No speech service is called by the running app.

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

The refreshed recording uses the current Relay interface. Narration is synthesized, with a conversational script and deliberate pauses; it is not a recording of the applicant.

The recorded operator click is dispatched to the actual frame control to avoid browser coordinate issues at recording zoom. A separate non-zoomed test verifies ordinary browser clicks and same-session handoff.
