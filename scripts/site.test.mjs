import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = JSON.parse(readFileSync(new URL('./fixtures/resume-content.json', import.meta.url), 'utf8'));

test('builds one resume, preserves its content, and reflects Markdown edits and explicit ordering', { timeout: 180_000 }, async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resume-site-'));
  let browser;
  try {
    const available = new Set(readdirSync(root));
    for (const name of ['src', 'eleventy.config.js', 'package.json', 'styles.css', 'assets']) {
      if (available.has(name)) cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
    const build = () => {
      const result = spawnSync('npm', ['run', 'build'], { cwd: fixture, encoding: 'utf8', timeout: 60_000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    build();
    assert.deepEqual(readdirSync(join(fixture, '_site')).sort(), ['assets', 'index.html', 'styles.css']);
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--font-render-hinting=none'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 960, deviceScaleFactor: 1 });
    const failed = [];
    page.on('requestfailed', request => failed.push(request.url()));
    const open = async () => {
      await page.goto(pathToFileURL(join(fixture, '_site/index.html')).href, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
    };
    await open();
    const actual = await page.evaluate(() => {
      const normalize = value => value.replace(/\s+/gu, ' ').trim();
      let text = normalize(document.body.innerText);
      for (const header of document.querySelectorAll('#languages thead, #skills thead')) {
        const box = header.getBoundingClientRect();
        if (box.width > 1.01 || box.height > 1.01 || getComputedStyle(header).clipPath === 'none') {
          throw new Error('Table labels must remain visually clipped');
        }
        text = text.replace(normalize(header.innerText), '');
      }
      return {
        title: document.title,
        text: normalize(text),
        emphasis: [...document.querySelectorAll('b, strong')].map(el => normalize(el.textContent)),
        links: [...document.querySelectorAll('a')].map(el => [normalize(el.textContent), el.getAttribute('href')]),
        images: [...document.images].map(el => el.getAttribute('src')),
      };
    });
    assert.deepEqual(actual, expected);
    assert.equal(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), true);
    assert.deepEqual(failed, []);

    const thales = join(fixture, 'src/content/experience/thales.md');
    writeFileSync(thales, readFileSync(thales, 'utf8').replace('order: 1', 'order: 99') + '\n\n**Markdown regression marker**\n');
    const profile = join(fixture, 'src/content/profile.md');
    writeFileSync(profile, readFileSync(profile, 'utf8').replace('name: Tom VAUTRAY', 'name: \'<img src=x onerror="window.resumeInjected=true"> & co\''));
    build();
    await open();
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#professional-experiences strong')].some(el => el.textContent === 'Markdown regression marker')), true);
    assert.equal(await page.evaluate(() => document.querySelector('#professional-experiences .list-element:last-child .content-title').textContent.trim()), '2022 - now');
    assert.equal(await page.evaluate(() => document.querySelector('#name').textContent.trim()), '<img src=x onerror="window.resumeInjected=true"> & co');
    assert.equal(await page.evaluate(() => document.querySelector('#name img') === null && window.resumeInjected === undefined), true);
    assert.deepEqual(failed, []);
  } finally {
    if (browser) await browser.close();
    rmSync(fixture, { recursive: true, force: true });
  }
});
