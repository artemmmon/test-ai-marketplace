// Marketplace-level metadata shared by the emitters (spec §4.3 MarketplaceInfo, A-1, A-11).
import { addCommands } from './ids.mjs';

export const DEFAULT_BRANCH = 'main';

const pick = (o) => {
  if (typeof o === 'string') return o.trim() ? { name: o.trim() } : null;
  if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.name !== 'string') return null;
  const out = { name: o.name };
  if (typeof o.email === 'string') out.email = o.email;
  if (typeof o.url === 'string') out.url = o.url;
  return out;
};

/** `{name, email?, url?}` from a plugin.json `author` / marketplace `owner` (object or "Name" string), or null. */
export const normalizePerson = pick;

/**
 * @param {object} marketplace parsed marketplace.json
 * @param {string} slug `owner/repo` of the GitHub repository
 */
export function buildMarketplaceInfo(marketplace, slug) {
  const [owner, repo] = slug.split('/');
  return {
    name: marketplace.name,
    description: typeof marketplace.description === 'string' ? marketplace.description : '',
    owner: pick(marketplace.owner) ?? { name: owner },
    repo: { slug, url: `https://github.com/${slug}`, defaultBranch: DEFAULT_BRANCH },
    siteUrl: `https://${owner.toLowerCase()}.github.io/${repo}/`,
    addCommands: addCommands(slug),
  };
}
