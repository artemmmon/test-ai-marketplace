import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy is injected only into the production build:
// the dev server needs inline styles and HMR sockets (spec NFR-41).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https://raw.githubusercontent.com data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site from https://<owner>.github.io/test-ai-marketplace/
  base: '/test-ai-marketplace/',
  plugins: [react(), cspMeta()],
  build: {
    // Never inline fonts or images as data: URIs, so font-src 'self' holds.
    assetsInlineLimit: 0,
  },
});
