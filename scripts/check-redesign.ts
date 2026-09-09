import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const b = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const p = await b.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(process.env.RELAY_URL || 'http://127.0.0.1:4173/');
    await p.locator('.hero h1').waitFor();
    await p.evaluate(() => document.fonts.ready);
    for (const stage of ['Discover', 'Record', 'Replay']) {
      await p.getByRole('tab', { name: new RegExp(stage) }).click();
      assert.ok(await p.getByRole('tabpanel').isVisible());
    }
    await p.locator('.landing-cta').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(100);
    await p.screenshot({
      path: `work/ui/landing-${width}.png`,
      fullPage: true,
    });
    await p
      .getByRole('button', { name: 'Open the workbench', exact: true })
      .click();
    await p.waitForFunction(() => !!(window as any).relay);
    for (const view of ['Capabilities', 'Evidence', 'Policy', 'Workbench']) {
      await p.getByRole('button', { name: view, exact: true }).click();
      await p.waitForTimeout(400);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: `work/ui/${view.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    }
    await p.getByRole('tab', { name: 'Discover', exact: true }).click();
    await p.screenshot({
      path: `work/ui/discover-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    results.push({
      width,
      views: 4,
      preview_tabs: 3,
      no_overflow: true,
      no_page_errors: true,
    });
    await p.close();
  }
  const p = await b.newPage({ reducedMotion: 'reduce' });
  await p.goto(process.env.RELAY_URL || 'http://127.0.0.1:4173/');
  await p.locator('.hero h1').waitFor();
  assert.equal(
    await p
      .locator('.hero-heading')
      .evaluate((e) => getComputedStyle(e).animationName),
    'none',
  );
  await writeFile(
    'evidence/redesign-verification.json',
    JSON.stringify({ results, reduced_motion: true }, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await b.close();
}
