# Résumés

Edit Markdown in `src/content_*/`, not HTML. Eleventy discovers each résumé
folder and combines it with the shared `src/resume.njk` layout. One GitHub Pages
site serves independent résumé URLs and a small link index at `/`.

| Content directory | Web résumé | PDF |
| --- | --- | --- |
| [`src/content_internationnal/`](src/content_internationnal/) | [/internationnal/](https://m4jor-tom.github.io/internationnal/) | [/generated/internationnal.pdf](https://m4jor-tom.github.io/generated/internationnal.pdf) |
| [`src/content_senior_dev/`](src/content_senior_dev/) | [/senior_dev/](https://m4jor-tom.github.io/senior_dev/) | [/generated/senior_dev.pdf](https://m4jor-tom.github.io/generated/senior_dev.pdf) |

Both initially contain the same résumé; edit either independently.

## Adding a résumé

Copy a complete existing directory and edit its Markdown:

```sh
cp -r src/content_internationnal src/content_my_resume
```

The next build adds `/my_resume/` and its index link. PDF generation adds
`generated/my_resume.pdf`, served at `/generated/my_resume.pdf`. No registration,
template edit, or workflow change is needed. Renaming/removing a source directory
removes the old page on the next build and the old PDFs after a successful export.

Names after `content_` must be lowercase letters/digits with `_` or `-` between
words. `assets` and `generated` are reserved. The spelling is preserved in URLs.
Keep the five top-level Markdown files; a missing file fails the build with its
path. Experience, project, and education entries remain in their subdirectories.

## Editing from your phone

Open a content file on GitHub, choose **Edit**, change the text, and commit it.
Commits to `master` automatically rebuild and publish every résumé and PDF once
Pages is configured below. These paths are relative to each résumé directory:

| Content | File |
| --- | --- |
| Name, title, contact details, photo and page metadata | `profile.md` |
| Professional summary | `summary.md` |
| Skills and durations | `skills.md` |
| Languages and proficiency | `languages.md` |
| Interests | `interests.md` |
| Work experience | One file per job in `experience/` |
| Projects | One file per project in `projects/` |
| Education | One file per qualification in `education/` |

Use `**bold text**`, `[link label](https://example.com)`, normal paragraphs,
and `- ` for bullet points. No HTML tags or trailing spaces are needed.
Section titles are in front matter (between `---` lines);
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

The existing `&nbsp;` entities keep phrases together. Keep them unless you intend
to change wrapping. Content is trusted, repository-authored Markdown, not
untrusted user submissions. Photos use root-relative source paths such as
`assets/PhotoLMGCouleursCrop.jpg`; assets and résumé styles are shared. PDF links
are generated from the directory name; there is no `pdf_url` to maintain.

## Local preview and PDFs

Requires Nix with flakes enabled on x86_64 Linux. Node.js, Chromium and Liberation
Sans remain pinned by `flake.lock`; no system Node or separate browser download
is needed.

```sh
# First checkout (or after package-lock.json changes):
nix develop -c npm ci

# Rebuilding browser preview at http://localhost:8080:
nix develop -c npm run dev

# Generate all pages in _site/:
nix develop -c npm run build

# Build and run site/PDF regression checks:
nix develop -c npm test

# Rebuild the website and export ALL PDFs:
nix develop -c npm run pdf
xdg-open generated/internationnal.pdf
xdg-open generated/senior_dev.pdf
```

Alternatively, enter `nix develop` once and run npm commands inside that shell.
`_site/`, `generated/` and `node_modules/` are generated and stay out of Git.
The résumé layout is in `src/resume.njk` and `styles.css`; the minimal index is
`src/index.njk`. Routine content edits do not require opening these files.

A site build clears `_site/`, including previously exported download copies.
The dev server rebuilds HTML, not PDFs on every edit: run `npm run pdf` through
Nix after content changes to prepare current downloads. After deleting a résumé
folder, restart the dev server or run a build: Eleventy 3.1.7 does not rebuild on
deletions alone. Local exports remain in
`generated/`, and identical copies are placed in `_site/generated/` for Pages.
The exporter can also process an already-built site from another working directory
by invoking `scripts/generate-pdf.mjs` through Nix using its absolute path.

PDF export keeps A4, 10 mm margins, print colors and the original layout. It waits
for local images/fonts and rejects missing assets. Every résumé is rendered before
any previous PDF is overwritten or removed; a render failure preserves the last
good local PDF set and fails publication. Host fonts are excluded so local and CI
output use the same metrics. PDF hyperlinks use public site URLs, not build-machine
file paths.

Content growth can overflow a one-page résumé. Inspect PDFs before publishing;
the tests enforce one page rather than silently shrinking text. Tests cover every
current résumé, a third copied directory, isolated content, Markdown rendering,
links, edits/ordering, escaped profile fields, invalid directories, embedded
images/fonts, removals, and export failure handling. Ordinary content changes do
not require updating a frozen snapshot.

## Publishing

One-time setup: in GitHub repository **Settings → Pages → Build and deployment**,
set **Source** to **GitHub Actions**. This is a user site (`M4jor-tom.github.io`),
so no repository-name URL prefix is needed.

On pushes to `master`, `.github/workflows/generate-pdf.yml` builds and checks all
résumés inside Nix, then exports their PDFs from the verified site. Separate jobs
publish `_site/` (including its PDFs) to GitHub Pages and all named PDFs to the
existing `pdf-cv-releasing` branch under `generated/`.

The old `Tom_Vautray_Software_Engineer_Resume.pdf` filename is replaced by the
named PDFs. Pull requests run checks only; they cannot deploy or push the PDF
branch. Local checks do not change the Pages setting or deploy the site.
