import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { messages, resolveDecision } from '../core/models';
import { redact } from '../core/privacy';
const command = process.argv[2] || 'replay';
const arg = (key: string, fallback: string) => {
  const i = process.argv.indexOf('--' + key);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', process.env.RELAY_URL || 'http://localhost:3000/?app=1');
const member_id = arg('member', '67890');
const output = arg('out', `evidence/${command}`);
const endpoint =
  process.env.MODEL_URL || 'http://127.0.0.1:8766/v1/chat/completions';
const modelName =
  process.env.MODEL_NAME || 'mlx-community/Qwen3-4B-Instruct-2507-4bit';
// Paid providers are deliberately unsupported by the bundled CLI.
const modelURL = new URL(endpoint);
const host = modelURL.hostname;
if (
  !['http:', 'https:'].includes(modelURL.protocol) ||
  modelURL.username ||
  modelURL.password
)
  throw Error('MODEL_URL must be an HTTP loopback URL without credentials.');
if (!['localhost', '127.0.0.1', '[::1]'].includes(host))
  throw Error('MODEL_URL must point to a local model server.');
const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const modelRecords: unknown[] = [];
try {
  if (command === 'discover' || process.argv.includes('--assisted'))
    await page.exposeBinding(
      'relayModel',
      async (source, goal: string, observation: any, history: unknown[]) => {
        const expected = new URL(url),
          current = new URL(source.frame.url());
        if (
          source.frame !== page.mainFrame() ||
          current.origin !== expected.origin ||
          current.pathname !== expected.pathname
        )
          throw Error('MODEL_BRIDGE_FRAME_DENIED');
        const request = {
          model: modelName,
          messages: messages(goal, observation, history),
          temperature: 0,
          max_tokens: 220,
          stream: false,
        };
        const start = Date.now();
        const response = await fetch(endpoint, {
          redirect: 'error',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) throw Error(`LOCAL_MODEL_HTTP_${response.status}`);
        const data: any = await response.json();
        const content = data.choices[0].message.content;
        modelRecords.push(
          redact({
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - start,
            request,
            response: { model: data.model, content, usage: data.usage },
          }),
        );
        return resolveDecision(content, observation, history);
      },
    );
  await page.addInitScript((name) => {
    (window as any).relayModelName = name;
  }, modelName);
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).relay, { timeout: 30000 });
  let artifact =
    command === 'discover'
      ? null
      : JSON.parse(
          await readFile(arg('artifact', 'evidence/capability.json'), 'utf8'),
        );
  const opts = {
    noHuman: !process.argv.includes('--headed'),
    scenario: arg('scenario', 'normal'),
    tenant: arg('tenant', 'northstar'),
    assisted: process.argv.includes('--assisted'),
    goal: arg(
      'goal',
      'Look up this member and read their current savings balance.',
    ),
  };
  const run = await page.evaluate(
    async ({ command, artifact, member_id, opts }) =>
      command === 'discover'
        ? (window as any).relay.discover({ member_id }, opts)
        : (window as any).relay.invoke(artifact, { member_id }, opts),
    { command, artifact, member_id, opts },
  );
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/run.json`,
    JSON.stringify(redact({ ...run, artifact: undefined }), null, 2),
  );
  if (command === 'discover') {
    await writeFile(
      `${output}/model-exchanges.json`,
      JSON.stringify(modelRecords, null, 2),
    );
  }
  if (command === 'discover' && run.result.status === 'success') {
    await mkdir('evidence', { recursive: true });
    await writeFile(
      'evidence/capability.json',
      JSON.stringify(run.artifact, null, 2),
    );
    await writeFile(
      `${output}/model-exchanges.json`,
      JSON.stringify(modelRecords, null, 2),
    );
  }
  // Only synthetic target; screenshot is explicitly redacted at capture.
  const frames = page.frames();
  for (const f of frames) {
    await f
      .locator('[data-sensitive]')
      .evaluateAll((es) => es.forEach((e) => (e.textContent = '[REDACTED]')))
      .catch(() => {});
    await f
      .locator('input')
      .evaluateAll((es) =>
        es.forEach((e) => ((e as HTMLInputElement).value = '')),
      )
      .catch(() => {});
  }
  await page
    .locator('.result p')
    .evaluateAll((es) =>
      es.forEach((e) => (e.textContent = '[OUTPUT REDACTED]')),
    );
  await page.screenshot({ path: `${output}/screen.png`, fullPage: true });
  console.log(
    JSON.stringify(
      {
        status: run.result.status,
        code: run.result.code,
        model_calls: run.result.model_calls,
        assisted: run.result.assisted,
        output,
      },
      null,
      2,
    ),
  );
  if (run.result.status === 'failure') process.exitCode = 1;
} finally {
  await browser.close();
}
