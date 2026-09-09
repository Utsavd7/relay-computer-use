import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const modelOrigins =
  'https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com';
for (const filename of ['index.html', 'bank.html', 'bank-frame.html']) {
  const path = `dist/${filename}`;
  let html = await readFile(path, 'utf8');
  const hashes = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ].map(
    (match) =>
      `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`,
  );
  const isApp = filename === 'index.html';
  const policy = [
    `default-src 'self'`,
    `script-src 'self' ${isApp ? "'wasm-unsafe-eval'" : ''} ${hashes.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `media-src 'self'`,
    `connect-src 'self' ${isApp ? modelOrigins : ''}`,
    `worker-src 'self' blob:`,
    `frame-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ].join('; ');
  html = html.replace(
    /<head>/i,
    `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`,
  );
  await writeFile(path, html);
}
await writeFile(
  'dist/_headers',
  `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n`,
);
console.log('Static HTML security policies generated.');
