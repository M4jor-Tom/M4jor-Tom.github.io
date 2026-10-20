import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const input = new URL('../_site/index.html', import.meta.url);
const output = fileURLToPath(new URL('../generated/Tom_Vautray_Software_Engineer_Resume.pdf', import.meta.url));
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', request => failed.push(request.url()));
  await page.goto(input.href, { waitUntil: 'networkidle0' });
  if (failed.length) throw new Error(`Failed to load: ${failed.join(', ')}`);

  await mkdir(dirname(output), { recursive: true });
  await page.pdf({
    path: output,
    format: 'A4',
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  });
  console.log(output);
} finally {
  await browser.close();
}
