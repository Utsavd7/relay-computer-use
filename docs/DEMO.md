# Product walkthrough

The landing page embeds `public/demo.mp4` with English captions from `public/demo.vtt`. A visible Subtitles button beneath the video turns captions on or off and stays synchronized with the browser’s native caption controls. It is an actual recording of the functioning application, including genuine local-model discovery; it is not an animation of invented results.

The delivered MP4 is **3840 × 2160 (4K), 105 seconds, H.264 with AAC audio**. The same discovery, artifact, replay, error, handoff, tenant reuse, and evidence sequence is preserved. Pauses between chapters are tightened; the recorded neural speech keeps its natural pace. Capture uses lossless PNG compositor frames from a native 4K browser viewport, with a 2.5× UI scale for legibility. The final H.264 file is encoded once at CRF 16 and 30 fps; the source is not a previously compressed screen recording.

## Reproduce

1. Start the UI with `npm run dev`.
2. Start the MLX model server on loopback port 8766 as documented in README.
3. Ensure `evidence/capability.json` exists (run discovery if needed).
4. Run `npm run demo:record`.
5. Install FFmpeg and `pip install -r scripts/demo-requirements.txt`, then run `python3 scripts/render-demo.py`. The renderer uses the Andrew multilingual neural voice through `edge-tts`, normalizes loudness, and creates sentence captions. `--audio-only` renders a narration preview. The narration script is public, contains no member data, and is sent to the speech service only when rebuilding the video. No speech service is called by the running app.

The opening starts on Discover and frames the complete execution-loop card. Recording-only styles remove surrounding marketing copy and workspace summary chrome so the live controls, results and timeline are larger and remain in frame. These styles do not change the target data or execution logic.

Only synthetic records appear. Chapter overlays are presentation labels; screen states and outcomes come from the running app. The recording script also writes its lossless frame sequence, timestamped FFmpeg manifest, real discovery exchanges and timing metadata into ignored `work/demo/`. The underlying submission evidence is independently captured in `evidence/`.

## Chapters

- 00:00 Product overview
- 00:09 Real local-model discovery
- 00:34 Typed reusable artifact
- 00:45 Deterministic replay with a new member
- 00:57 Known not-found outcome
- 01:05 Live-session human handoff
- 01:24 Cross-tenant reuse
- 01:33 Inspectable evidence

The refreshed recording uses the current Relay interface. Narration is synthesized, with a conversational script and deliberate pauses; it is not a recording of the applicant.

The recorded operator click is dispatched to the actual frame control to avoid browser coordinate issues at recording zoom. A separate non-zoomed test verifies ordinary browser clicks and same-session handoff.
