import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Lossless compositor frames avoid compressing the recording twice. */
export async function captureFrames(page: Page, directory: string) {
  const folder = resolve(directory, `frames-${Date.now()}`);
  await mkdir(folder, { recursive: true });
  const first = await page.screenshot({ type: 'png' });
  await writeFile(`${folder}/000000.png`, first);
  const started = Date.now();
  const frames = [{ path: `${folder}/000000.png`, time: 0 }];
  const pending: Promise<unknown>[] = [];
  const client = await page.context().newCDPSession(page);
  let accepting = true;
  client.on('Page.screencastFrame', (event) => {
    if (accepting) {
      const time = (Date.now() - started) / 1000;
      const path = `${folder}/${String(frames.length).padStart(6, '0')}.png`;
      frames.push({ path, time });
      pending.push(writeFile(path, Buffer.from(event.data, 'base64')));
    }
    void client
      .send('Page.screencastFrameAck', { sessionId: event.sessionId })
      .catch(() => {});
  });
  await client.send('Page.startScreencast', {
    format: 'png',
    maxWidth: 3840,
    maxHeight: 2160,
    everyNthFrame: 1,
  });
  return {
    started,
    async stop(duration = 105) {
      accepting = false;
      await client.send('Page.stopScreencast');
      await Promise.all(pending);
      await client.detach();
      const kept = frames.filter((frame) => frame.time < duration);
      const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
      const lines = ['ffconcat version 1.0'];
      for (let i = 0; i < kept.length; i++) {
        lines.push(`file ${quote(kept[i].path)}`);
        lines.push(
          `duration ${Math.max(0.001, (kept[i + 1]?.time ?? duration) - kept[i].time).toFixed(6)}`,
        );
      }
      lines.push(`file ${quote(kept.at(-1)!.path)}`);
      await writeFile(
        resolve(directory, 'capture.ffconcat'),
        lines.join('\n') + '\n',
      );
      const header = new DataView(
        first.buffer,
        first.byteOffset,
        first.byteLength,
      );
      return {
        frames: kept.length,
        width: header.getUint32(16),
        height: header.getUint32(20),
      };
    },
  };
}
