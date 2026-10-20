import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));

test('renders Markdown, escapes profile fields, and rebuilds ordered content edits', { timeout: 180_000 }, async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resume-site-'));
  let browser;
  try {
    for (const name of ['src', 'eleventy.config.js', 'package.json', 'styles.css', 'assets']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
    const summary = join(fixture, 'src/content/summary.md');
    writeFileSync(summary, '---\ntitle: Summary regression title\n---\n\nSummary **bold marker** and a [profile link](https://example.com/profile).\n');
    const profile = join(fixture, 'src/content/profile.md');
    const name = '<img src=x onerror="window.resumeInjected=true"> & co';
    writeFileSync(profile, readFileSync(profile, 'utf8').replace(/^name:.*$/m, `name: '${name}'`));
    const experience = join(fixture, 'src/content/experience');
    rmSync(experience, { recursive: true });
    mkdirSync(experience);
    writeFileSync(join(experience, 'a-later.md'), '---\norder: 20\nperiod: "Later period"\n---\n\nLater job.\n');
    const earlier = join(experience, 'z-earlier.md');
    writeFileSync(earlier, '---\norder: 10\nperiod: "Earlier period"\n---\n\nEarlier job.\n');

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
    const failed = [];
    page.on('requestfailed', request => failed.push(request.url()));
    const open = () => page.goto(pathToFileURL(join(fixture, '_site/index.html')).href, { waitUntil: 'networkidle0' });
    const periods = () => page.$$eval('#professional-experiences .content-title', entries => entries.map(el => el.textContent.trim()));
    await open();
    assert.equal(await page.$eval('#professional-summary .header', el => el.textContent), 'Summary regression title');
    assert.equal(await page.$eval('#professional-summary p', el => el.textContent), 'Summary bold marker and a profile link.');
    assert.equal(await page.$eval('#professional-summary strong', el => el.textContent), 'bold marker');
    assert.equal(await page.$eval('#professional-summary a', el => el.href), 'https://example.com/profile');
    assert.deepEqual(await periods(), ['Earlier period', 'Later period']);
    assert.equal(await page.$eval('#name', el => el.textContent.trim()), name);
    assert.equal(await page.evaluate(() => document.querySelector('#name img') === null && window.resumeInjected === undefined), true);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('a')].every(link =>
      (link.target || document.querySelector('base')?.target) === '_blank')), true, 'links must keep opening in a new tab');
    assert.equal(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), true);
    assert.equal(await page.$$eval('#languages thead, #skills thead', headers => headers.every(header => {
      const box = header.getBoundingClientRect();
      return box.width <= 1.01 && box.height <= 1.01 && getComputedStyle(header).clipPath !== 'none';
    })), true, 'table headers must stay visually clipped');

    writeFileSync(earlier, readFileSync(earlier, 'utf8').replace('order: 10', 'order: 30'));
    writeFileSync(summary, readFileSync(summary, 'utf8').replace('bold marker', 'updated marker'));
    build();
    await open();
    assert.deepEqual(await periods(), ['Later period', 'Earlier period']);
    assert.equal(await page.$eval('#professional-summary strong', el => el.textContent), 'updated marker');
    assert.deepEqual(failed, []);
  } finally {
    if (browser) await browser.close();
    rmSync(fixture, { recursive: true, force: true });
  }
});
