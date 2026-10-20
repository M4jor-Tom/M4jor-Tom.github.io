import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('exports a complete one-page A4 PDF from any cwd and rejects missing assets', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resume-pdf-'));
  try {
    for (const path of ['index.html', 'styles.css', 'assets', 'scripts']) {
      cpSync(join(root, path), join(fixture, path), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
    const generate = () => spawnSync(process.execPath, [join(fixture, 'scripts/generate-pdf.mjs')], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 60_000,
    });
    const result = generate();
    assert.equal(result.status, 0, result.stderr);
    const output = join(fixture, 'generated/Tom_Vautray_Software_Engineer_Resume.pdf');
    const pdf = readFileSync(output);
    const contents = pdf.toString('latin1');
    assert.ok(contents.startsWith('%PDF-'));
    assert.match(contents, /%%EOF\s*$/);
    assert.equal([...contents.matchAll(/\/Type\s*\/Page\b/g)].length, 1, 'must remain one page');
    const box = contents.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
    assert.ok(box, 'must have a page size');
    assert.ok(Math.abs(Number(box[1]) - 595.28) < 1 && Math.abs(Number(box[2]) - 841.89) < 1, 'must be A4');
    assert.ok([...contents.matchAll(/\/Subtype\s*\/Image\b/g)].length >= 10, 'must embed the photo and nine icons');
    assert.match(contents, /LiberationSans/, 'must embed the original metric-compatible font');

    for (const asset of ['styles.css', 'assets/PhotoLMGCouleursCrop.jpg']) {
      renameSync(join(fixture, asset), join(fixture, `${asset}.missing`));
      const failed = generate();
      assert.notEqual(failed.status, 0, `must reject missing ${asset}`);
      assert.match(failed.stderr, /Failed to load/);
      assert.deepEqual(readFileSync(output), pdf, 'failure must preserve the last good PDF');
      renameSync(join(fixture, `${asset}.missing`), join(fixture, asset));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
