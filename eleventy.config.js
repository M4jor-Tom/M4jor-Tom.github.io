import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { discoverResumes } from './scripts/resumes.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));

export default function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true, throwOnUndefined: true });
  eleventyConfig.on('eleventy.before', () => rmSync(new URL('./_site/', import.meta.url), { recursive: true, force: true }));
  eleventyConfig.addPassthroughCopy('styles.css');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addCollection('resumes', api => discoverResumes(root).map(slug => {
    const resume = { slug };
    for (const name of ['profile', 'summary', 'languages', 'skills', 'interests']) {
      const path = `src/content_${slug}/${name}.md`;
      [resume[name]] = api.getFilteredByGlob(path);
      if (!resume[name]) throw new Error(`Missing ${path}`);
    }
    for (const name of ['experience', 'projects', 'education']) {
      resume[name] = api.getFilteredByGlob(`src/content_${slug}/${name}/*.md`)
        .sort((a, b) => a.data.order - b.data.order);
    }
    return resume;
  }));
  return {
    dir: { input: 'src', output: '_site' },
    templateFormats: ['md', 'njk'],
    markdownTemplateEngine: false,
  };
}
