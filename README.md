# Resume

Edit `index.html` and `styles.css`, then generate and inspect the PDF before pushing.

## Local PDF

Requires Nix with flakes enabled on x86_64 Linux. Node.js, Chromium and the
Liberation Sans fonts are pinned by `flake.lock`; no system Node installation or
separate browser download is needed.

```sh
# First checkout (or after package-lock.json changes):
nix develop -c npm ci

# Regenerate after editing the resume:
nix develop -c npm run pdf

# Open with your desktop PDF viewer:
xdg-open generated/Tom_Vautray_Software_Engineer_Resume.pdf
```

Alternatively, enter `nix develop` once and run `npm ci`, `npm run pdf` and
`npm test` inside that shell.

The exporter keeps the original A4 page, 10 mm margins, print colors and layout.
It embeds local images and waits for assets and fonts; missing assets fail the
command instead of silently producing an incomplete resume. Host fonts are
excluded so local and CI output use the same font metrics. The HTML/CSS are not
modified. Small rendering differences from the old Chromium 75 export remain;
PDF metadata also changes, so files are not byte-identical.

## Checks and publishing

```sh
nix develop -c npm test
```

The smoke test checks a single A4 page, embedded images/fonts, generation from a
different working directory, and preservation of the last PDF if assets are missing.

On pushes to `master`, `.github/workflows/generate-pdf.yml` uses the same Nix
shell and local script, then publishes the PDF at the existing path on
`pdf-cv-releasing`. `generated/` and `node_modules/` stay out of the source branch.
