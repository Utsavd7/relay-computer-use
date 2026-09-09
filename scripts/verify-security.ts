import { chromium } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { defaultPolicy } from '../core/schema';
await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: {
      entry: resolve('core/surface.ts'),
      name: 'SecuritySurface',
      formats: ['iife'],
      fileName: () => 'surface.js',
    },
    outDir: 'work/security-surface',
    emptyOutDir: true,
  },
});
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(process.env.RELAY_URL || 'http://127.0.0.1:4173/?app=1');
  await page.waitForFunction(() => !!(window as any).relay);
  await page.evaluate(() => (window as any).relay.reset());
  await page.evaluate(
    (await readFile('work/security-surface/surface.js', 'utf8')) +
      '\nwindow.__SecuritySurface = SecuritySurface; window.__name = (fn) => fn;',
  );
  const checks = await page.evaluate(async (policy) => {
    const root = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Live banking session"]',
    )!.contentDocument!;
    const child = root.querySelector('iframe')!.contentDocument!;
    const surface = new (window as any).__SecuritySurface.BrowserSurface(
      () => root,
      policy,
    );
    const results: { name: string; code: string }[] = [];
    async function blocked(name: string, work: () => Promise<unknown>) {
      try {
        await work();
        results.push({ name, code: 'NOT_BLOCKED' });
      } catch (e) {
        results.push({ name, code: (e as Error).message });
      }
    }
    const params = { member_id: '12345' };
    const click = (name: string) =>
      surface.act(
        { action: 'click', target: { kind: 'control', name } },
        params,
      );
    const button = child.querySelector<HTMLButtonElement>('button')!;
    const input = child.querySelector<HTMLInputElement>('input')!;
    const previous = child.URL;
    child.defaultView!.history.replaceState(
      null,
      '',
      '/unapproved/bank-frame.html',
    );
    await blocked('route-prefix-bypass', () => surface.observe());
    await blocked('out-of-policy-read', () => surface.identity());
    child.defaultView!.history.replaceState(null, '', previous);
    button.disabled = true;
    await blocked('disabled-control', () => click('Search members'));
    button.disabled = false;
    input.type = 'password';
    await blocked('password-field', () =>
      surface.act(
        {
          action: 'fill',
          target: { kind: 'field', name: 'Member ID' },
          input: 'member_id',
        },
        params,
      ),
    );
    input.type = 'text';
    const unknown = child.createElement('button');
    unknown.textContent = 'Export records';
    child.body.appendChild(unknown);
    await blocked('unknown-control', () => click('Export records'));
    unknown.remove();
    const link = child.createElement('a');
    link.textContent = 'Search members';
    link.href = 'javascript:void(0)';
    button.replaceWith(link);
    await blocked('link-disguised-as-control', () => click('Search members'));
    link.replaceWith(button);
    const form = child.createElement('form');
    button.replaceWith(form);
    form.appendChild(button);
    await blocked('form-submission', () => click('Search members'));
    form.replaceWith(button);
    const nested = child.createElement('iframe');
    nested.setAttribute('sandbox', '');
    nested.src = child.URL;
    await new Promise<void>((resolve) => {
      nested.onload = () => resolve();
      child.body.appendChild(nested);
    });
    await blocked('opaque-frame', () => surface.observe());
    nested.remove();
    const script = document.createElement('script');
    script.textContent = 'window.__injectedScriptExecuted=true';
    document.head.appendChild(script);
    results.push({
      name: 'inline-script-injection',
      code: (window as any).__injectedScriptExecuted
        ? 'NOT_BLOCKED'
        : 'CSP_BLOCKED',
    });
    return results;
  }, defaultPolicy);
  for (const check of checks)
    assert.match(check.code, /^(POLICY_|CSP_BLOCKED)/, JSON.stringify(check));
  const snapshot = await page.evaluate(() => {
    const data = (window as any).relay.snapshot();
    data.artifact.approval.state = 'approved';
    return (window as any).relay.snapshot().artifact.approval.state;
  });
  assert.equal(snapshot, 'draft');
  checks.push({ name: 'snapshot-reference-isolation', code: 'ISOLATED' });
  const forged = await page.evaluate(async () => {
    const artifact = (window as any).relay.snapshot().artifact;
    artifact.approval = {
      state: 'approved',
      successful_replays: 999,
      failed_replays: 0,
      reviewer: 'Forged',
    };
    return (window as any).relay.invoke(
      artifact,
      { member_id: '12345' },
      { requireApproval: true, noHuman: true },
    );
  });
  assert.equal(forged.result.code, 'APPROVAL_REQUIRED');
  checks.push({ name: 'forged-caller-approval', code: forged.result.code });
  const pending = page.evaluate(() =>
    (window as any).relay.invoke(
      (window as any).relay.snapshot().artifact,
      { member_id: '12345' },
      { scenario: 'handoff' },
    ),
  );
  await page.locator('.intervention').waitFor();
  assert.equal(
    await page.evaluate(async () => {
      try {
        await (window as any).relay.reset();
        return 'NOT_BLOCKED';
      } catch (e) {
        return (e as Error).message;
      }
    }),
    'SESSION_BUSY',
  );
  await page.evaluate(() => (window as any).relay.cancel());
  await pending;
  checks.push({ name: 'reset-during-owned-session', code: 'SESSION_BUSY' });
  await writeFile(
    'evidence/security-verification.json',
    JSON.stringify({ checked_at: new Date().toISOString(), checks }, null, 2),
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
}
