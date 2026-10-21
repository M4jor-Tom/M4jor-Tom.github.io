import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { discoverResumes } from './resumes.mjs';

const root = new URL('../', import.meta.url);
const slugs = discoverResumes(fileURLToPath(root));
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--font-render-hinting=none'],
});

try {
  // Render the complete set before changing any existing PDFs.
  const pdfs = new Map();
  for (const slug of slugs) {
    const page = await browser.newPage();
    try {
      const failed = [];
      page.on('requestfailed', request => failed.push(request.url()));
      await page.goto(new URL(`_site/${slug}/index.html`, root).href, { waitUntil: 'networkidle0' });
      if (failed.length) throw new Error(`Failed to load: ${failed.join(', ')}`);
      await page.evaluate(async publicURL => {
        await document.fonts.ready;
        const broken = [...document.images].filter(image => !image.complete || !image.naturalWidth);
        if (broken.length) throw new Error(`Failed to load: ${broken.map(image => image.src).join(', ')}`);
        // Local HTML renders offline, but links in the PDF must work for its readers.
        for (const link of document.querySelectorAll('a[href]')) {
          if (link.protocol === 'file:') link.href = new URL(link.getAttribute('href'), publicURL).href;
        }
      }, `https://m4jor-tom.github.io/${slug}/`);
      pdfs.set(`${slug}.pdf`, await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      }));
    } finally {
      await page.close();
    }
  }

  for (const path of ['generated/', '_site/generated/']) {
    const directory = new URL(path, root);
    await mkdir(directory, { recursive: true });
    for (const [filename, pdf] of pdfs) {
      const output = new URL(filename, directory);
      await writeFile(output, pdf);
      console.log(fileURLToPath(output));
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.pdf') && !pdfs.has(entry.name)) {
        await rm(new URL(entry.name, directory));
      }
    }
  }
} finally {
  await browser.close();
}
