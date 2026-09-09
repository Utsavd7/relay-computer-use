import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { messages, resolveDecision } from '../core/models';
import { redact } from '../core/privacy';
import { captureFrames } from './capture-frames';
await mkdir('work/demo', { recursive: true });
const artifact = JSON.parse(await readFile('evidence/capability.json', 'utf8'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 3840, height: 2160 },
});
const page = await context.newPage();
const exchanges: any[] = [];
await page.exposeFunction(
  'relayModel',
  async (goal: string, observation: any, history: any[]) => {
    const request = {
      model: 'mlx-community/Qwen3-4B-Instruct-2507-4bit',
      messages: messages(goal, observation, history),
      temperature: 0,
      max_tokens: 180,
    };
    const response = await fetch('http://127.0.0.1:8766/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60000),
    });
    const data: any = await response.json();
    exchanges.push(redact({ request, response: data }));
    return resolveDecision(
      data.choices[0].message.content,
      observation,
      history,
    );
  },
);
await page.addInitScript(() => {
  (window as any).relayModelName = 'Qwen3-4B-Instruct-2507 · local MLX';
});
const base = process.env.RELAY_URL || 'http://localhost:3000/';
await page.addInitScript(() => {
  if (window === window.top)
    document.addEventListener('DOMContentLoaded', () => {
      document.body.style.zoom = '2.5';
    });
});
await page.goto(base);
await page.locator('.hero h1').waitFor();
await page.evaluate(() => document.fonts.ready);
// Recording-only framing: hide surrounding marketing and summary chrome, not target data.
await page.addStyleTag({
  content: `
  .landing { min-height:864px; }
  .landing > :not(.landing-nav):not(.hero) { display:none!important; }
  .hero > :not(.product-stage) { display:none!important; }
  .hero { padding:44px 60px 90px!important; }
  .product-stage { margin:0!important; }
  .workspace .title-row, .workspace .metrics, .workspace .options-row, .workspace footer { display:none!important; }
  .workspace header { height:44px; }
  .workspace article { padding:18px 24px 85px; }
  .workspace .run-heading { padding:10px 20px; }
  .workspace .goal-field { padding:12px 20px 0; }
  .workspace .goal-field textarea { height:54px; min-height:54px; }
  .workspace .goal-field p { display:none; }
  .workspace .form { padding:14px 20px; }
  .workspace section > h2 { height:44px; }
  .workspace .frame-wrap { height:340px; }
  .workspace .timeline { height:413px; }
  html { scroll-behavior: auto!important; }
`,
});
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
const capture = await captureFrames(page, 'work/demo');
const started = capture.started;
const at = async (seconds: number) => {
  const delay = seconds * 1000 - (Date.now() - started);
  if (delay > 0) await page.waitForTimeout(delay);
};
async function chapter(number: string, title: string) {
  await page.evaluate(
    ({ number, title }) => {
      document.getElementById('recording-caption')?.remove();
      const el = document.createElement('div');
      el.id = 'recording-caption';
      el.style.cssText =
        'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:15px;align-items:center;padding:12px 21px;border-radius:8px;background:color-mix(in srgb,var(--relay-ink) 94%,transparent);color:var(--relay-on-dark);font:13px DM Sans, sans-serif;box-shadow:0 8px 35px #0e1b0c30;pointer-events:none';
      const n = document.createElement('span');
      n.textContent = number;
      n.style.cssText = 'color:var(--relay-mint);font:11px monospace';
      const t = document.createElement('span');
      t.textContent = title;
      el.appendChild(n);
      el.appendChild(t);
      document.body.appendChild(el);
    },
    { number, title },
  );
}
try {
  await chapter('RELAY', 'Discover a workflow. Make it repeatable.');
  await at(9.1);
  await page
    .getByRole('button', { name: 'Try a real run', exact: true })
    .click();
  await page.waitForFunction(() => !!(window as any).relay);
  await page.evaluate(() => {
    document.body.style.zoom = '2.5';
  });
  await chapter('01 / DISCOVERY', 'A real local model operates the live UI');
  await page.getByRole('tab', { name: 'Discover', exact: true }).click();
  await at(13);
  const discovery = await page.evaluate(() =>
    (window as any).relay.discover({ member_id: '12345' }, { noHuman: true }),
  );
  if (discovery.result.status !== 'success')
    throw Error('Recorded discovery must succeed');
  await writeFile(
    'work/demo/discovery.json',
    JSON.stringify(redact(discovery), null, 2),
  );
  await at(34);
  await page.getByRole('button', { name: 'Capabilities', exact: true }).click();
  await chapter(
    '02 / ARTIFACT',
    'Typed inputs, declared outputs, reviewable steps',
  );
  await at(45.5);
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('tab', { name: 'Replay', exact: true }).click();
  await page.getByLabel('Member ID', { exact: true }).fill('67890');
  await chapter(
    '03 / REPLAY',
    'New member. Same capability. No model decisions.',
  );
  const replay = await page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '67890' },
        { noHuman: true },
      ),
    artifact,
  );
  if (replay.result.status !== 'success') throw Error('Replay failed');
  await at(57);
  await page.getByLabel('Member ID', { exact: true }).fill('99999');
  await chapter('04 / OUTCOMES', 'Member not found is a business outcome');
  await page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '99999' },
        { noHuman: true },
      ),
    artifact,
  );
  await at(65.5);
  await page.getByLabel('Member ID', { exact: true }).fill('12345');
  await page
    .getByLabel('Runtime condition', { exact: true })
    .selectOption('handoff');
  await chapter(
    '05 / HANDOFF',
    'Pause automation. Keep the same live session.',
  );
  const takeover = page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '12345' },
        { scenario: 'handoff' },
      ),
    artifact,
  );
  await page.locator('.intervention').waitFor({ timeout: 15000 });
  await at(75.2);
  await page
    .frameLocator('iframe[title="Live banking session"]')
    .frameLocator('iframe')
    .getByRole('button', { name: 'Restore session' })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await at(78.6);
  await page
    .getByRole('button', { name: 'Return control', exact: true })
    .click();
  const handed = await takeover;
  if (handed.result.status !== 'success') throw Error('Handoff failed');
  await at(84);
  await page.getByLabel('Institution', { exact: true }).selectOption('harbor');
  await page
    .getByLabel('Runtime condition', { exact: true })
    .selectOption('normal');
  await chapter('06 / REUSE', 'The same artifact, a second institution');
  await page.evaluate(
    async (artifact) =>
      (window as any).relay.invoke(
        artifact,
        { member_id: '24680' },
        { tenant: 'harbor', noHuman: true },
      ),
    artifact,
  );
  await at(93.7);
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await chapter(
    'RELAY',
    'Every action. Every outcome. Evidence you can inspect.',
  );
  await at(105);
  await writeFile(
    'work/demo/model-exchanges.json',
    JSON.stringify(exchanges, null, 2),
  );
  const captureInfo = await capture.stop(105);
  await writeFile(
    'work/demo/timing.json',
    JSON.stringify(
      {
        duration_ms: 105000,
        capture: 'lossless PNG compositor frames',
        ...captureInfo,
        discovery_model_calls: discovery.result.model_calls,
        replay_model_calls: replay.result.model_calls,
        handoff_status: handed.result.status,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
