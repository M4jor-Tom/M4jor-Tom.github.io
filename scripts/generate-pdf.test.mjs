import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('exports every resume as A4, discovers additions, preserves good PDFs on failure, and removes obsolete PDFs', { timeout: 180_000 }, () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resume-pdf-'));
  try {
    for (const path of ['src', 'scripts', 'eleventy.config.js', 'package.json', 'styles.css', 'assets']) {
      cpSync(join(root, path), join(fixture, path), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
    const build = () => {
      const result = spawnSync('npm', ['run', 'build'], { cwd: fixture, encoding: 'utf8', timeout: 60_000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    const generate = () => spawnSync(process.execPath, [join(fixture, 'scripts/generate-pdf.mjs')], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 60_000,
    });
    const generateOK = () => {
      const result = generate();
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    build();
    generateOK();
    const slugs = readdirSync(join(fixture, 'src'), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('content_'))
      .map(entry => entry.name.slice('content_'.length)).sort();
    const checkPDF = slug => {
      const output = join(fixture, `generated/${slug}.pdf`);
      assert.equal(existsSync(output), true, `missing PDF for ${slug}`);
      const pdf = readFileSync(output);
      const contents = pdf.toString('latin1');
      assert.ok(contents.startsWith('%PDF-'));
      assert.match(contents, /%%EOF\s*$/);
      assert.equal([...contents.matchAll(/\/Type\s*\/Page\b/g)].length, 1, `${slug} must remain one page`);
      const box = contents.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
      assert.ok(box, 'must have a page size');
      assert.ok(Math.abs(Number(box[1]) - 595.28) < 1 && Math.abs(Number(box[2]) - 841.89) < 1, 'must be A4');
      assert.ok([...contents.matchAll(/\/Subtype\s*\/Image\b/g)].length >= 10, 'must embed the photo and nine icons');
      assert.match(contents, /LiberationSans/, 'must embed the original metric-compatible font');
      assert.ok(contents.includes(`https://m4jor-tom.github.io/generated/${slug}.pdf`), 'PDF download link must be public, not a build-machine file URL');
      assert.deepEqual(readFileSync(join(fixture, `_site/generated/${slug}.pdf`)), pdf, 'Pages must serve the exported PDF bytes');
    };
    for (const slug of slugs) checkPDF(slug);

    cpSync(join(fixture, 'src/content_internationnal'), join(fixture, 'src/content_test_copy'), { recursive: true });
    cpSync(join(fixture, 'assets/PhotoLMGCouleursCrop.jpg'), join(fixture, 'assets/test-copy.jpg'));
    const profile = join(fixture, 'src/content_test_copy/profile.md');
    writeFileSync(profile, readFileSync(profile, 'utf8').replace('assets/PhotoLMGCouleursCrop.jpg', 'assets/test-copy.jpg'));
    build();
    generateOK();
    checkPDF('test_copy');
    const outputs = [...slugs, 'test_copy'].map(slug => `generated/${slug}.pdf`);
    const previous = new Map(outputs.flatMap(output => [output, `_site/${output}`]).map(output => [output, readFileSync(join(fixture, output))]));
    const expectFailure = () => {
      const failed = generate();
      assert.notEqual(failed.status, 0, 'must reject missing or broken assets');
      assert.match(failed.stderr, /Failed to load/);
      for (const [output, pdf] of previous) {
        assert.deepEqual(readFileSync(join(fixture, output)), pdf, 'failure must preserve the entire last good PDF set');
      }
    };
    for (const asset of ['_site/styles.css', '_site/assets/test-copy.jpg']) {
      renameSync(join(fixture, asset), join(fixture, `${asset}.missing`));
      expectFailure();
      renameSync(join(fixture, `${asset}.missing`), join(fixture, asset));
    }
    writeFileSync(join(fixture, '_site/assets/test-copy.jpg'), 'not an image');
    expectFailure();

    rmSync(join(fixture, 'src/content_test_copy'), { recursive: true });
    build();
    // A successful export must remove old PDFs in both destinations.
    writeFileSync(join(fixture, 'generated/obsolete.pdf'), 'obsolete');
    mkdirSync(join(fixture, '_site/generated'));
    writeFileSync(join(fixture, '_site/generated/obsolete.pdf'), 'obsolete');
    generateOK();
    const expected = slugs.map(slug => `${slug}.pdf`);
    assert.deepEqual(readdirSync(join(fixture, 'generated')).sort(), expected);
    assert.deepEqual(readdirSync(join(fixture, '_site/generated')).sort(), expected);
    assert.equal(existsSync(join(fixture, '_site/test_copy')), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
