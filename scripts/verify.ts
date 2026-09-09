import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { approve, recordValidation, exportAutomation } from '../core/engine';
import { ArtifactSchema } from '../core/schema';
import { messages, resolveDecision } from '../core/models';
import { redact } from '../core/privacy';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const checks: any[] = [];
const artifact = ArtifactSchema.parse(
  JSON.parse(await readFile('evidence/capability.json', 'utf8')),
);
const save = async (name: string, data: any) => {
  await mkdir(`evidence/${name}`, { recursive: true });
  await writeFile(
    `evidence/${name}/run.json`,
    JSON.stringify(redact(data), null, 2),
  );
};
try {
  await page.goto(process.env.RELAY_URL || 'http://localhost:3000/?app=1');
  await page.waitForFunction(() => !!(window as any).relay);
  async function run(name: string, member_id: string, opts: any = {}) {
    const data = await page.evaluate(
      async ({ artifact, member_id, opts }) =>
        (window as any).relay.invoke(
          artifact,
          { member_id },
          { noHuman: true, ...opts },
        ),
      { artifact, member_id, opts },
    );
    await save(name, data);
    checks.push({
      name,
      status: data.result.status,
      code: data.result.code,
      model_calls: data.result.model_calls,
      assisted: data.result.assisted,
    });
    return data;
  }
  const normal = await run('replay', '67890');
  assert.equal(normal.result.status, 'success');
  assert.equal(normal.result.outputs.balance, 9615.25);
  assert.equal(normal.result.model_calls, 0);
  const missing = await run('not-found', '99999');
  assert.equal(missing.result.status, 'business_outcome');
  assert.equal(missing.result.code, 'MEMBER_NOT_FOUND');
  const invalid = await run('invalid-input', 'abc');
  assert.equal(invalid.result.status, 'failure');
  assert.ok(!invalid.events.some((e: any) => e.type === 'action.complete'));
  for (const scenario of ['slow', 'transient', 'dialog']) {
    const r = await run(scenario, '12345', { scenario });
    assert.equal(r.result.status, 'success');
    assert.equal(r.result.model_calls, 0);
  }
  const tenant = await run('tenant-harbor', '24680', { tenant: 'harbor' });
  assert.equal(tenant.result.status, 'success');
  assert.equal(tenant.result.outputs.balance, 125);
  const ambiguous = await run('ambiguous-target', '12345', {
    scenario: 'ambiguous',
  });
  assert.equal(ambiguous.result.code, 'AMBIGUOUS_TARGET');
  const denied = await run('permission-denied', '12345', {
    scenario: 'permission',
  });
  assert.equal(denied.result.status, 'failure');
  const unknown = await run('unknown-error', '12345', { scenario: 'unknown' });
  assert.equal(unknown.result.status, 'failure');
  assert.ok(unknown.result.observed.includes('Unexpected application error'));
  const gated = await run('approval-gate', '12345', { requireApproval: true });
  assert.equal(gated.result.code, 'APPROVAL_REQUIRED');
  // Real live-session transfer: automation pauses; browser interaction supplies the human action.
  const handoffPromise = page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '12345' },
        { scenario: 'handoff' },
      ),
    artifact,
  );
  await page.locator('.intervention').waitFor({ timeout: 20000 });
  const frameURL = page
    .frames()
    .find((f) => f.url().includes('bank-frame.html'))!
    .url();
  await page
    .frameLocator('iframe[title="Live banking session"]')
    .frameLocator('iframe')
    .getByRole('button', { name: 'Restore session' })
    .click();
  await page
    .getByRole('button', { name: 'Return control', exact: true })
    .click();
  const handoff = await handoffPromise;
  assert.equal(handoff.result.status, 'success');
  assert.equal(
    page
      .frames()
      .find((f) => f.url().includes('bank-frame.html'))!
      .url(),
    frameURL,
  );
  assert.ok(handoff.events.some((e: any) => e.type === 'human.action'));
  await save('handoff', handoff);
  checks.push({
    name: 'handoff',
    status: 'success',
    same_session: true,
    human_action_capture: true,
    model_calls: 0,
  });
  const abortedPromise = page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '12345' },
        { scenario: 'unknown' },
      ),
    artifact,
  );
  await page.locator('.intervention').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Abort', exact: true }).click();
  const aborted = await abortedPromise;
  assert.equal(aborted.result.code, 'CANCELLED');
  await save('aborted', aborted);
  checks.push({ name: 'aborted', status: 'expected-cancellation' });
  let validated = structuredClone(artifact);
  const stability = [];
  for (let i = 0; i < 5; i++) {
    const r = await run(`stability-${i + 1}`, i % 2 ? '67890' : '12345');
    assert.equal(r.result.status, 'success');
    validated = recordValidation(validated, r.result);
    stability.push(r.result);
  }
  validated = approve(validated, 'Local reviewer');
  await writeFile(
    'evidence/approved-capability.json',
    JSON.stringify(validated, null, 2),
  );
  await writeFile(
    'evidence/stability.json',
    JSON.stringify(
      {
        runs: 5,
        successes: 5,
        observed_success_rate: 1,
        confidence_note:
          'Five deterministic local runs; not a statistical production guarantee.',
        results: redact(stability),
      },
      null,
      2,
    ),
  );
  await writeFile(
    'evidence/generated-automation.mjs',
    exportAutomation(validated),
  );
  // Direct structured capability invocation, same path as the UI.
  const catalog = await page.evaluate(() => (window as any).relay.catalog());
  assert.equal(catalog[0].name, 'get_savings_balance');
  await writeFile('evidence/catalog.json', JSON.stringify(catalog, null, 2));
  // Explicitly opt into one real local-model recovery; never part of deterministic baseline.
  if (process.env.TEST_ASSISTED === '1') {
    const exchanges: any[] = [];
    await page.exposeFunction(
      'relayModel',
      async (goal: string, observation: any, history: any[]) => {
        const request = {
          model: 'mlx-community/Qwen3-4B-Instruct-2507-4bit',
          messages: messages(goal, observation, history),
          temperature: 0,
          max_tokens: 220,
        };
        const response = await fetch(
          'http://127.0.0.1:8766/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(120000),
          },
        );
        const data: any = await response.json();
        exchanges.push(redact({ request, response: data }));
        return resolveDecision(
          data.choices[0].message.content,
          observation,
          history,
        );
      },
    );
    const assisted = await run('assisted-recovery', '12345', {
      scenario: 'recovery',
      assisted: true,
    });
    assert.equal(assisted.result.status, 'success');
    assert.equal(assisted.result.model_calls, 1);
    assert.equal(assisted.result.assisted, true);
    await writeFile(
      'evidence/assisted-recovery/model-exchanges.json',
      JSON.stringify(exchanges, null, 2),
    );
  }
  const risky = structuredClone(artifact);
  risky.steps.push({
    action: 'click',
    target: { kind: 'control', name: 'Submit transfer' },
  });
  const blocked = await page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '12345' },
        { noHuman: true },
      ),
    risky,
  );
  assert.equal(blocked.result.code, 'POLICY_RISKY_ACTION');
  await save('risky-action-blocked', blocked);
  checks.push({ name: 'risky-action-blocked', status: 'blocked-before-click' });
  await writeFile(
    'evidence/verification.json',
    JSON.stringify({ timestamp: new Date().toISOString(), checks }, null, 2),
  );
  console.log(JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
}
