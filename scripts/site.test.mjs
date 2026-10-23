import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));

test('discovers independent resumes, links their PDFs, and rebuilds Markdown edits and removals', { timeout: 180_000 }, async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resume-site-'));
  let browser;
  try {
    for (const name of ['src', 'scripts', 'eleventy.config.js', 'package.json', 'styles.css', 'assets']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
    cpSync(join(fixture, 'src/content_internationnal'), join(fixture, 'src/content_test_copy'), { recursive: true });
    const summary = join(fixture, 'src/content_test_copy/summary.md');
    writeFileSync(summary, '---\ntitle: Summary regression title\n---\n\nSummary **bold marker** and a [profile link](https://example.com/profile).\n');
    const profile = join(fixture, 'src/content_test_copy/profile.md');
    const name = '<img src=x onerror="window.resumeInjected=true"> & co';
    writeFileSync(profile, readFileSync(profile, 'utf8').replace(/^name:.*$/m, `name: '${name}'`));
    const experience = join(fixture, 'src/content_test_copy/experience');
    rmSync(experience, { recursive: true });
    mkdirSync(experience);
    writeFileSync(join(experience, 'a-later.md'), '---\norder: 20\nperiod: "Later period"\n---\n\nLater job.\n');
    const earlier = join(experience, 'z-earlier.md');
    writeFileSync(earlier, '---\norder: 10\nperiod: "Earlier period"\n---\n\nEarlier job.\n');

    const build = () => spawnSync('npm', ['run', 'build'], { cwd: fixture, encoding: 'utf8', timeout: 60_000 });
    const buildOK = () => {
      const result = build();
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    buildOK();
    for (const slug of ['internationnal', 'full_stack_france_dev', 'test_copy']) {
      assert.equal(existsSync(join(fixture, `_site/${slug}/index.html`)), true, `missing page for ${slug}`);
      assert.deepEqual(readdirSync(join(fixture, `_site/${slug}`)), ['index.html']);
      assert.equal(existsSync(join(fixture, `_site/content_${slug}`)), false, 'Markdown inputs must not be published');
    }
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--font-render-hinting=none'],
    });
    const page = await browser.newPage();
    const failed = [];
    page.on('requestfailed', request => failed.push(request.url()));
    const open = (path = 'test_copy/index.html') => page.goto(pathToFileURL(join(fixture, '_site', path)).href, { waitUntil: 'networkidle0' });
    const periods = () => page.$$eval('#professional-experiences .content-title', entries => entries.map(el => el.textContent.trim()));
    await open('index.html');
    const links = await page.$$eval('a', links => links.map(link => link.getAttribute('href')));
    for (const slug of ['internationnal', 'full_stack_france_dev', 'test_copy']) {
      assert.ok(links.includes(`${slug}/`));
      assert.ok(links.includes(`generated/${slug}.pdf`));
    }
    await page.setViewport({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'index fits a phone');
    await page.setViewport({ width: 800, height: 600 });
    await open();
    assert.equal(await page.$eval('#professional-summary .header', el => el.textContent), 'Summary regression title');
    assert.equal(await page.$eval('#professional-summary p', el => el.textContent), 'Summary bold marker and a profile link.');
    assert.equal(await page.$eval('#professional-summary strong', el => el.textContent), 'bold marker');
    assert.equal(await page.$eval('#professional-summary a', el => el.href), 'https://example.com/profile');
    assert.equal(await page.$eval('#resume-files a.link', el => el.getAttribute('href')), '../generated/test_copy.pdf');
    assert.deepEqual(await periods(), ['Earlier period', 'Later period']);
    assert.equal(await page.$eval('#name', el => el.textContent.trim()), name);
    assert.equal(await page.evaluate(() => document.querySelector('#name img') === null && window.resumeInjected === undefined), true);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('a')].every(link =>
      (link.target || document.querySelector('base')?.target) === '_blank')), true, 'resume links must keep opening in a new tab');
    assert.equal(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), true);
    assert.equal(await page.$$eval('#languages thead, #skills thead', headers => headers.every(header => {
      const box = header.getBoundingClientRect();
      return box.width <= 1.01 && box.height <= 1.01 && getComputedStyle(header).clipPath !== 'none';
    })), true, 'table headers must stay visually clipped');

    for (const slug of ['internationnal', 'full_stack_france_dev']) {
      await open(`${slug}/index.html`);
      assert.notEqual(await page.$eval('#name', el => el.textContent.trim()), name);
      assert.doesNotMatch(await page.$eval('#professional-summary', el => el.textContent), /bold marker/);
      assert.ok(!(await periods()).includes('Earlier period'), 'experience must not leak between resumes');
      assert.equal(await page.$eval('#resume-files a.link', el => el.getAttribute('href')), `../generated/${slug}.pdf`);
    }

    writeFileSync(earlier, readFileSync(earlier, 'utf8').replace('order: 10', 'order: 30'));
    writeFileSync(summary, readFileSync(summary, 'utf8').replace('bold marker', 'updated marker'));
    buildOK();
    await open();
    assert.deepEqual(await periods(), ['Later period', 'Earlier period']);
    assert.equal(await page.$eval('#professional-summary strong', el => el.textContent), 'updated marker');
    assert.deepEqual(failed, []);

    // Optional fields drive the rows; new scalar fields need no template changes.
    writeFileSync(profile, `---
name: Optional fields fixture
nationality: '   '
work_permit: Permit only
location: Lyon
portfolio_url: https://example.com/portfolio
custom_note: '<img src=x onerror="window.resumeInjected=true">'
age:
phone: ''
linkedin_label: Orphan label
empty_note:
---
`);
    writeFileSync(summary, 'Summary without a title.\n');
    writeFileSync(join(fixture, 'src/content_test_copy/languages.md'), '---\ntitle: Languages\n---\n');
    writeFileSync(join(fixture, 'src/content_test_copy/skills.md'), '**Skills without a title.**\n');
    writeFileSync(join(fixture, 'src/content_test_copy/interests.md'), '');
    writeFileSync(earlier, '---\norder: 30\n---\n\nJob without a period.\n');
    rmSync(join(fixture, 'src/content_test_copy/projects'), { recursive: true });
    buildOK();
    await open();
    assert.equal(await page.title(), 'Optional fields fixture');
    assert.deepEqual(await page.$$eval('#personal-data > div', rows => rows.map(row => row.id)),
      ['civility', 'location', 'portfolio', 'custom_note']);
    assert.equal(await page.$eval('#civility', el => el.textContent.trim()), 'Permit only');
    assert.match(await page.$eval('#location', el => el.textContent), /Location:\s*Lyon/);
    assert.equal(await page.$eval('#portfolio a.link', el => el.href), 'https://example.com/portfolio');
    assert.equal(await page.$eval('#portfolio a.link', el => el.textContent), 'Portfolio');
    assert.match(await page.$eval('#custom_note', el => el.textContent), /<img src=x/);
    assert.equal(await page.evaluate(() => window.resumeInjected === undefined), true);
    for (const selector of ['#photo', '#title', '#languages', '#projects', '#centers-of-interest',
      'meta[name="description"]', 'meta[name="keywords"]', '#custom_note img', '#civility br']) {
      assert.equal(await page.$(selector), null, `${selector} must not leave an empty element`);
    }
    assert.equal(await page.$$eval('#left-panel > .h-line', lines => lines.length), 1);
    assert.equal(await page.$eval('#skills .header', el => el.textContent), 'Skills');
    assert.equal(await page.$eval('#professional-summary .header', el => el.textContent), 'Professional summary');
    assert.equal(await page.$eval('#professional-experiences .header', el => el.textContent), 'Professional experiences');
    assert.deepEqual(await periods(), ['Later period']);
    assert.match(await page.$eval('#professional-experiences', el => el.textContent), /Job without a period/);
    assert.doesNotMatch(await page.$eval('#personal-data', el => el.textContent), /permalink|collections|page|Orphan label|undefined|null/);

    writeFileSync(profile, '---\n---\n');
    buildOK();
    await open();
    assert.equal(await page.title(), 'test_copy');
    assert.equal(await page.$('#personal-data'), null);
    assert.equal(await page.$('#right-panel > .header'), null);

    rmSync(join(fixture, 'src/content_test_copy'), { recursive: true });
    buildOK();
    assert.equal(existsSync(join(fixture, '_site/test_copy')), false, 'removed resumes must not remain published');
    await open('index.html');
    assert.equal(await page.$('a[href="test_copy/"]'), null);

    for (const slug of ['', 'Bad Name', 'assets', 'generated']) {
      const invalid = join(fixture, `src/content_${slug}`);
      mkdirSync(invalid);
      const result = build();
      assert.notEqual(result.status, 0, `must reject content_${slug}`);
      assert.match(result.stdout + result.stderr, /Invalid resume directory/);
      rmSync(invalid, { recursive: true });
    }
    for (const filename of ['profile.md', 'summary.md']) {
      const source = join(fixture, 'src/content_full_stack_france_dev', filename);
      const original = readFileSync(source);
      rmSync(source);
      const result = build();
      assert.notEqual(result.status, 0);
      assert.ok((result.stdout + result.stderr).includes(`Missing src/content_full_stack_france_dev/${filename}`));
      writeFileSync(source, original);
    }
    for (const entry of readdirSync(join(fixture, 'src'), { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('content_')) rmSync(join(fixture, 'src', entry.name), { recursive: true });
    }
    const empty = build();
    assert.notEqual(empty.status, 0);
    assert.match(empty.stdout + empty.stderr, /No resume directories found/);
  } finally {
    if (browser) await browser.close();
    rmSync(fixture, { recursive: true, force: true });
  }
});
