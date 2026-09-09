# Reviewer handover

## Five-minute review path

1. Open the public landing page and watch the two-minute product demo.
2. Open the workbench; replay member `67890` and inspect the verified result and zero model decisions.
3. Replay `99999`: observe a known business outcome rather than a crash.
4. Select the session-expiry condition, replay, restore the existing session manually, and return control. The timeline records ownership transfer and the human action.
5. Open Capabilities: inspect parameters, outputs, steps and provenance. Export JSON or runnable code. Validate five runs, then approve and enable the approval gate.
6. Replay Harbor using the same artifact, then inspect `REPORT.md` and the evidence directory.

## Required submission contents

- Public source repository.
- Root README with setup and exact discovery/replay commands.
- Root REPORT with the seven required headings.
- Evidence from genuine local-model discovery, deterministic replay, exceptional conditions and handoff.
- Example capability, generated code, model exchanges, verification and stability results.
- Optional screen recording embedded in the landing page.

## Submission email draft

To: assignments@interface.ai
Subject: Software Engineer assignment — Computer-Use Automation System

Hello Hiring Team,

Please find my completed Computer-Use Automation System assignment below.

https://github.com/Utsavd7/relay-computer-use

Live demo: https://utsavd7.github.io/relay-computer-use/

The repository includes setup instructions, the design report, genuine local-model discovery evidence, deterministic replay evidence, runtime error handling, live-session handoff, and the optional extensions. The landing page includes a two-minute walkthrough.

Thank you for reviewing my submission.

## Sending

Send the repository link from the email address used for the application. Keep the repo URL on its own line and do not attach a ZIP. The draft is prepared for review; no email is sent by the build workflow.
