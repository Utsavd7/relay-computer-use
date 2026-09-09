import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const checks = [];
await mkdir('work/ui', { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/bank-frame.html*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await page.goto(process.env.RELAY_URL || 'http://127.0.0.1:4173/');
    await page.locator('.hero h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.fonts.check('16px "DM Sans"')),
      true,
    );
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(750);
    await page.screenshot({
      path: `work/ui/landing-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Open the workbench', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Replay capability', exact: true })
      .click();
    await page.locator('.result.success').waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `work/ui/workbench-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    checks.push({
      width,
      landing: true,
      replay: true,
      no_horizontal_overflow: true,
      font_loaded: true,
      no_page_errors: true,
    });
    await page.close();
  }
  await writeFile(
    'evidence/ui-verification.json',
    JSON.stringify(checks, null, 2),
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
}
