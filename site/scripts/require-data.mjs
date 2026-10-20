// Runs before `npm run dev` and `npm run build`: the generated catalog data must exist in public/.
// The files are not committed; the repo root script scripts/build-index.mjs writes them (spec FR-73).
import { existsSync } from 'node:fs';

const DATA_FILES = ['index.json', 'catalog.json', 'releases.json', 'stats.json', 'llms.txt', 'feed.xml'];

const publicDir = new URL('../public/', import.meta.url);
const missing = DATA_FILES.filter((file) => !existsSync(new URL(file, publicDir)));

if (missing.length > 0) {
  console.error(`site/public is missing generated catalog data: ${missing.join(', ')}`);
  console.error('Generate it from the repository root first, then run this command again:');
  console.error('  npm run build:index            # the real catalog (marketplace.json and plugins/)');
  console.error('  npm run build:index:fixtures   # fictitious demo data, never deployed');
  process.exit(1);
}
