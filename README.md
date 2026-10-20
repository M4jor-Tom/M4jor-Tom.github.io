# Resume

Edit the Markdown files in [`src/content/`](src/content/), not HTML. Eleventy
combines them with `src/index.njk` to generate the website and PDF.

## Editing from your phone

Open a content file on GitHub, choose **Edit**, change the text, and commit it.
After the feature is merged and Pages is configured below, commits to `master`
automatically rebuild and publish the website and PDF.

| Content | File |
| --- | --- |
| Name, title, contact details, photo and page metadata | `src/content/profile.md` |
| Professional summary | `src/content/summary.md` |
| Skills and durations | `src/content/skills.md` |
| Languages and proficiency | `src/content/languages.md` |
| Interests | `src/content/interests.md` |
| Work experience | One file per job in `src/content/experience/` |
| Projects | One file per project in `src/content/projects/` |
| Education | One file per qualification in `src/content/education/` |

Use `**bold text**`, `[link label](https://example.com)`, normal paragraphs,
and `- ` for bullet points. No HTML tags or trailing spaces are needed.
Section titles are in each file's front matter (between `---` lines);
experience/project/education section titles are in `profile.md`.

To add a job, copy an existing experience file and edit its metadata and body:

```markdown
---
order: 1
period: "2022 - now"
---

**Software Engineer** at **Company**

- Built and deployed an application.
- Worked with an Agile team.
```

Give entries unique numeric `order` values: lower numbers appear first, regardless
of filenames or timestamps. Quote periods as shown. Education uses the same
format; projects use `title` instead of `period`.

Skills and languages use Markdown tables. Keep the header/separator rows and
add or edit data rows:

```markdown
| Duration | Skill |
| --- | --- |
| 9 mo | TypeScript **Angular** |
```

The existing `&nbsp;` entities in a few skill names keep those phrases together,
matching the original layout. Keep them unless you intend to change wrapping.
Content is trusted, repository-authored Markdown, not untrusted user submissions.

## Local preview and PDF

Requires Nix with flakes enabled on x86_64 Linux. Node.js, Chromium and Liberation
Sans fonts remain pinned by `flake.lock`; no system Node installation or separate
browser download is needed.

```sh
# First checkout (or after package-lock.json changes):
nix develop -c npm ci

# Rebuilding browser preview at http://localhost:8080:
nix develop -c npm run dev

# Generate the static website in _site/:
nix develop -c npm run build

# Build and run the site/PDF regression checks:
nix develop -c npm test

# Rebuild the website and export the current PDF:
nix develop -c npm run pdf
xdg-open generated/Tom_Vautray_Software_Engineer_Resume.pdf
```

Alternatively, enter `nix develop` once and run the npm commands inside that shell.
`_site/`, `generated/` and `node_modules/` are generated and stay out of Git.
The layout is maintained in `src/index.njk` and `styles.css`; routine content
editing does not require opening either file.

PDF export keeps A4, 10 mm margins, print colors and the original layout. It waits
for local images and fonts and rejects missing assets without overwriting the
last good PDF. Host fonts are excluded so local and CI output use the same metrics.
The exporter can also process an already-built site from any working directory
by invoking `scripts/generate-pdf.mjs` through Nix using its absolute path.

Content growth can overflow the one-page resume. Inspect the PDF before publishing;
the tests enforce one page, rather than silently shrinking text. Tests also check
Markdown rendering, links, edits and ordering, escaped profile fields, embedded
images/fonts and export failure handling. Ordinary content changes do not require
updating a frozen resume snapshot.

## Publishing

One-time setup: in GitHub repository **Settings → Pages → Build and deployment**,
set **Source** to **GitHub Actions**. This is a user site (`M4jor-tom.github.io`),
so no repository-name URL prefix is needed.

The feature includes the prerequisite Nix/PDF-tooling history. Merge the complete
feature, not just the template changes, before expecting the workflow on `master`.
Local implementation and checks do not change the Pages setting or deploy the site.

On pushes to `master`, `.github/workflows/generate-pdf.yml` builds and checks the
resume inside Nix, then exports the PDF from the verified site. Separate jobs
publish `_site/` to GitHub Pages and retain the existing PDF destination:

- Branch: `pdf-cv-releasing`
- File: `generated/Tom_Vautray_Software_Engineer_Resume.pdf`

Pull requests run checks only; they cannot deploy or push the PDF branch.
