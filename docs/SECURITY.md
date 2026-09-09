# Security controls and verification

Relay is a bounded browser automation demonstration using synthetic banking records. This review hardens that boundary; it does not establish production banking security or constitute an independent penetration test.

| Boundary | Enforced behavior |
| --- | --- |
| Policy configuration | Strict schema, known routes/actions, finite integer step/retry/time limits, mandatory risky-action blocking. |
| Frames and reads | Exact paths resolved within the pinned application base and origin. Unknown, opaque or inaccessible frames fail closed. Observations, identity reads and actions check the same boundary. |
| UI actions | Only named workflow controls are allowed. Targets must match uniquely and be visible, enabled and of the expected type. Password fields, links, form submissions and unknown controls are denied. |
| Capability imports | Files start as drafts with cleared review counts. Invocation ignores supplied approval claims and only reuses the review of an identical local contract. Required approval cannot be disabled by an invocation option. |
| Session ownership | API results and snapshots are cloned; callers cannot mutate internal review state by reference. External reset is rejected while a run or human intervention owns the session. |
| Model decisions | Discovery and assisted recovery share bounded response waits and cancellation checks. Late answers cannot execute after cancellation. Goals, observations and history pass through redaction. |
| Local model bridge | Available only for discovery or explicitly assisted CLI runs; main-frame origin and path are checked. Model endpoints must be credential-free HTTP(S) loopback URLs and redirects are rejected. |
| Static pages | Content Security Policy restricts scripts, frames, media and connections. Banking inline scripts receive build-time hashes; arbitrary inline script injection is blocked. Model downloads are limited to configured Hugging Face and GitHub origins. |
| Dependencies | The transitive development dependency `sharp` is pinned to 0.35.4 through an override. The full dependency audit after installation reported no known vulnerabilities. |

The dependency update addresses the maintainer's [sharp/libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c). Audit results are a point-in-time check, not a guarantee about future advisories.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run start -- --host 127.0.0.1 --port 4173
# In another terminal:
npx tsx scripts/verify-security.ts
RELAY_URL='http://127.0.0.1:4173/?app=1' npm run test:e2e
npm audit
```

The 23 unit tests include malformed-policy rejection, draft import behavior, forged approval claims, empty outcome matching, assisted model timeout, cancellation and redaction. The 12 focused browser checks in `evidence/security-verification.json` exercise real DOM controls and the production CSP. The integrated verifier covers the original workflow and deliberate failure modes. CI runs the focused browser security verifier before publishing.

## Remaining trust assumptions

- The banking page and its scripts are trusted application code. This same-origin adapter is not a sandbox for hostile third-party pages or arbitrary websites. A control allowlist cannot determine whether trusted page code has been maliciously rewritten.
- Approval is a device-local review aid. A person controlling the browser, developer tools or local storage controls that state. Institutional use needs authenticated reviewers, signed artifacts and server-side authorization.
- Redaction covers known fields and common credential patterns; arbitrary sensitive prose requires stronger data classification. No real customer data or credentials should be loaded into this demonstration.
- Cancellation prevents subsequent automation actions but may leave underlying model computation running until it returns. Model initialization and device resource use are not governed by a server quota.
- CSP is embedded in production HTML. The generated `_headers` file adds browser security headers only on hosts that honor it; GitHub Pages ignores it. Meta CSP cannot provide `frame-ancestors`, so the application does not claim uniform clickjacking protection across hosts.
- The CLI trusts the explicitly selected workbench URL. Its local inference server is intended for the operator's own machine, not exposure to the public network.
