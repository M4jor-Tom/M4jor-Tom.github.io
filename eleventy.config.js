export default function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true, throwOnUndefined: true });
  eleventyConfig.addPassthroughCopy('styles.css');
  eleventyConfig.addPassthroughCopy('assets');
  for (const name of ['profile', 'summary', 'languages', 'skills', 'interests']) {
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(`src/content/${name}.md`));
  }
  for (const name of ['experience', 'projects', 'education']) {
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(`src/content/${name}/*.md`)
      .sort((a, b) => a.data.order - b.data.order));
  }
  return {
    dir: { input: 'src', output: '_site' },
    templateFormats: ['md', 'njk'],
    markdownTemplateEngine: false,
  };
}
