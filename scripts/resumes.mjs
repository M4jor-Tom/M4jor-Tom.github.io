import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function discoverResumes(root) {
  const slugs = readdirSync(join(root, 'src'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('content_'))
    .map(entry => {
      const slug = entry.name.slice('content_'.length);
      if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(slug) || ['assets', 'generated'].includes(slug)) {
        throw new Error(`Invalid resume directory: src/${entry.name}; use lowercase words separated by _ or -, excluding assets and generated`);
      }
      return slug;
    }).sort();
  if (!slugs.length) throw new Error('No resume directories found in src/content_*');
  return slugs;
}
