// Markdown → sanitized HTML (spec FR-61…FR-64). Loaded as a lazy chunk.
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export interface RenderContext {
  repoUrl: string;
  repoSlug: string;
  commit: string;
  /** Repo-relative directory the markdown file lives in, for relative links. */
  baseDir: string;
}

let current: RenderContext | null = null;

function slug(text: string): string {
  return (
    'md-' +
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
  );
}

/** Resolves "./a/../b.md" against a repo directory. */
function resolvePath(baseDir: string, rel: string): string {
  const out = baseDir ? baseDir.split('/') : [];
  for (const part of rel.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const ctx = current;
  if (!ctx) return;
  const el = node as Element;
  if (/^H[1-6]$/.test(el.tagName)) {
    el.setAttribute('id', slug(el.textContent ?? ''));
  }
  if (el.tagName === 'A') {
    const href = el.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) {
      // The hash belongs to the router: scroll on click instead (see Markdown.tsx).
      el.setAttribute('data-anchor', slug(decodeURIComponent(href.slice(1)).replace(/-/g, ' ')));
      return;
    }
    if (!SCHEME.test(href) && !href.startsWith('//')) {
      const [path, hash] = href.split('#');
      el.setAttribute('href', `${ctx.repoUrl}/blob/${ctx.commit}/${resolvePath(ctx.baseDir, path)}${hash ? `#${hash}` : ''}`);
    }
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }
  if (el.tagName === 'IMG') {
    const src = el.getAttribute('src');
    if (src && !SCHEME.test(src) && !src.startsWith('//')) {
      el.setAttribute('src', `https://raw.githubusercontent.com/${ctx.repoSlug}/${ctx.commit}/${resolvePath(ctx.baseDir, src)}`);
    }
    el.setAttribute('loading', 'lazy');
  }
});

export function renderMarkdown(source: string, ctx: RenderContext): string {
  const html = marked.parse(source, { gfm: true, async: false }) as string;
  current = ctx;
  try {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'textarea', 'select'],
      FORBID_ATTR: ['style'],
    });
  } finally {
    current = null;
  }
}
