import { chromium, type Frame } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { exampleArtifact } from '../core/example';
const checks: any[] = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
async function audit(name: string, surface: typeof p | Frame = p) {
  const low = await surface.evaluate(() => {
    function rgb(s: string) {
      const a = s.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
      return [...a.slice(0, 3), a[3] ?? 1];
    }
    function lum(a: number[]) {
      const s = a
        .slice(0, 3)
        .map((x) => x / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return s[0] * 0.2126 + s[1] * 0.7152 + s[2] * 0.0722;
    }
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(
        (e) =>
          e.getClientRects().length &&
          [...e.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent?.trim(),
          ) &&
          !e.closest('button:disabled'),
      )
      .map((e) => {
        const c = getComputedStyle(e);
        let bg = [255, 255, 255, 1];
        const chain = [];
        for (let n: Element | null = e; n; n = n.parentElement)
          chain.unshift(n);
        for (const n of chain) {
          const v = rgb(getComputedStyle(n).backgroundColor);
          bg = v.slice(0, 3).map((x, i) => x * v[3] + bg[i] * (1 - v[3]));
        }
        const fg = rgb(c.color);
        const l = [lum(fg), lum(bg)].sort((a, b) => b - a);
        const ratio = (l[0] + 0.05) / (l[1] + 0.05);
        return {
          selector: e.tagName + '.' + e.className,
          text: e.textContent?.trim().slice(0, 50),
          ratio: +ratio.toFixed(2),
          color: c.color,
          bg,
        };
      })
      .filter((x) => x.ratio < 4.5)
      .sort((a, b) => a.ratio - b.ratio);
  });
  checks.push({ view: name, violations: low });
  assert.equal(low.length, 0, JSON.stringify({ name, low }));
}
await p.addInitScript('window.__name = (fn) => fn');
await p.goto('http://127.0.0.1:4173/');
await p.locator('.hero h1').waitFor();
await audit('landing');
await p
  .getByRole('button', { name: 'Open the workbench', exact: true })
  .click();
await p.waitForFunction(() => !!(window as any).relay);
await audit('workbench');
await p
  .frameLocator('iframe[title="Live banking session"]')
  .frameLocator('iframe')
  .getByRole('button', { name: 'Search members' })
  .waitFor();
const bank = p.frames().find((f) => f.url().includes('bank-frame'))!;
await audit('embedded banking session', bank);
const productButton = await p
  .locator('.form .primary')
  .evaluate((e) => getComputedStyle(e).backgroundColor);
const bankButton = await bank
  .getByRole('button', { name: 'Search members' })
  .evaluate((e) => getComputedStyle(e).backgroundColor);
assert.equal(productButton, bankButton);
for (const view of ['Capabilities', 'Evidence', 'Policy']) {
  await p.getByRole('button', { name: view, exact: true }).click();
  await p.waitForTimeout(400);
  await audit(view);
}
await p.getByRole('button', { name: 'Workbench', exact: true }).click();
for (const [name, member_id, scenario] of [
  ['success', '12345', 'normal'],
  ['known outcome', '99999', 'normal'],
  ['failure', '12345', 'permission'],
]) {
  await p.evaluate(
    ({ artifact, member_id, scenario }) =>
      (window as any).relay.invoke(
        artifact,
        { member_id },
        { scenario, noHuman: true },
      ),
    { artifact: exampleArtifact, member_id, scenario },
  );
  await audit(name);
}
await p.evaluate((artifact) => {
  (window as any).pendingColorRun = (window as any).relay.invoke(
    artifact,
    { member_id: '12345' },
    { scenario: 'handoff' },
  );
}, exampleArtifact);
await p.locator('.intervention').waitFor();
await audit('human intervention');
await p.evaluate(() => (window as any).relay.cancel());
await writeFile(
  'evidence/color-verification.json',
  JSON.stringify(
    { minimum_text_contrast: 4.5, shared_button_color: productButton, checks },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(checks.map((x) => ({ view: x.view, contrast_pass: true }))),
);
await b.close();
