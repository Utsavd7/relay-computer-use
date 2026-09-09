import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { redact } from '../core/privacy';
const browser = await chromium.launchPersistentContext(
  'work/browser-model-profile',
  {
    channel: 'chromium',
    args: ['--enable-unsafe-webgpu'],
  },
);
const page = await browser.newPage();
try {
  await page.goto('http://127.0.0.1:4173/?app=1');
  await page.waitForFunction(() => !!(window as any).relay);
  await page.getByRole('tab', { name: 'Discover', exact: true }).click();
  console.log('Browser model: starting real WebGPU discovery');
  const progress = setInterval(async () => {
    console.log(
      await page
        .locator('.goal-field p')
        .innerText()
        .catch(() => ''),
    );
  }, 15000);
  const outcome = await page.evaluate(() =>
    (window as any).relay.discover({ member_id: '12345' }, { noHuman: true }),
  );
  clearInterval(progress);
  await mkdir('evidence/browser-discovery', { recursive: true });
  await writeFile(
    'evidence/browser-discovery/run.json',
    JSON.stringify(redact(outcome), null, 2),
  );
  console.log(
    JSON.stringify({
      status: outcome.result.status,
      code: outcome.result.code,
      model_calls: outcome.result.model_calls,
    }),
  );
  if (outcome.result.status !== 'success') process.exitCode = 1;
} catch (e) {
  console.log(String(e));
  process.exitCode = 1;
} finally {
  await browser.close();
}
