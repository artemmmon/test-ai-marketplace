// Cases for the check-marketplace regression test (FR-82): the checks that existed before the
// refactoring, each with the exact stderr the original script printed. Not a test file itself.
import { minimalFiles } from './helpers.mjs';

const manifest = (name, extra = {}) => ({ name, version: '1.0.0', description: 'x', ...extra });
const skill = (name) => `---\nname: ${name}\ndescription: Does ${name}\n---\n\nBody.\n`;

/** @type {Array<{ name: string, files: Record<string, unknown>, stderr: string | null }>} stderr null = success */
export const CASES = [
  { name: 'valid marketplace', files: minimalFiles(), stderr: null },
  {
    name: 'plugins not sorted',
    files: minimalFiles((f) => {
      f['.claude-plugin/marketplace.json'].plugins = [
        { name: 'zeta-plugin', source: './plugins/zeta-plugin' },
        { name: 'alpha-plugin', source: './plugins/alpha-plugin' },
      ];
      f['plugins/zeta-plugin/.claude-plugin/plugin.json'] = manifest('zeta-plugin');
    }),
    stderr: '✘ plugins[] must be sorted by name\n',
  },
  {
    name: 'duplicate plugin name',
    files: minimalFiles((f) => {
      const entry = f['.claude-plugin/marketplace.json'].plugins[0];
      f['.claude-plugin/marketplace.json'].plugins = [entry, { ...entry }];
    }),
    stderr: '✘ duplicate plugin name "alpha-plugin"\n',
  },
  {
    name: 'invalid name',
    files: minimalFiles((f) => {
      f['.claude-plugin/marketplace.json'].plugins = [{ name: 'Bad_Name', source: './plugins/bad-name' }];
      f['plugins/bad-name/.claude-plugin/plugin.json'] = manifest('Bad_Name');
    }),
    stderr: '✘ "Bad_Name": name must match /^[a-z0-9][a-z0-9-]{1,63}$/\n',
  },
  {
    name: 'hidden unicode in description',
    files: minimalFiles((f) => {
      f['.claude-plugin/marketplace.json'].plugins[0].description = 'Looks fine​';
    }),
    stderr: '✘ "alpha-plugin": hidden Unicode in name or description\n',
  },
  {
    name: 'external source without a pin',
    files: minimalFiles((f) => {
      f['.claude-plugin/marketplace.json'].plugins.push({ name: 'remote-plugin', source: { source: 'github', repo: 'o/r' } });
    }),
    stderr: '✘ "remote-plugin": external github source must be pinned by sha or ref\n',
  },
  {
    name: 'plugin.json missing',
    files: minimalFiles((f) => {
      delete f['plugins/alpha-plugin/.claude-plugin/plugin.json'];
    }),
    stderr: (root) => `✘ "alpha-plugin": ${root}/plugins/alpha-plugin/.claude-plugin/plugin.json is missing\n`,
  },
  {
    name: 'plugin.json name differs',
    files: minimalFiles((f) => {
      f['plugins/alpha-plugin/.claude-plugin/plugin.json'] = manifest('other-name');
    }),
    stderr: '✘ "alpha-plugin": plugin.json name is "other-name"\n',
  },
  {
    name: 'version differs between marketplace.json and plugin.json',
    files: minimalFiles((f) => {
      f['.claude-plugin/marketplace.json'].plugins[0].version = '2.0.0';
    }),
    stderr: '✘ "alpha-plugin": version 2.0.0 in marketplace.json, 1.0.0 in plugin.json\n',
  },
  {
    name: 'SKILL.md missing',
    files: minimalFiles((f) => {
      delete f['plugins/alpha-plugin/skills/do-thing/SKILL.md'];
      f['plugins/alpha-plugin/skills/do-thing/notes.md'] = 'only notes';
    }),
    stderr: (root) => `✘ "alpha-plugin": ${root}/plugins/alpha-plugin/skills/do-thing/SKILL.md is missing\n`,
  },
  {
    name: 'skill frontmatter name differs from the directory',
    files: minimalFiles((f) => {
      f['plugins/alpha-plugin/skills/do-thing/SKILL.md'] = skill('other');
    }),
    stderr: (root) => `✘ ${root}/plugins/alpha-plugin/skills/do-thing/SKILL.md: frontmatter name "other" must equal "do-thing"\n`,
  },
];
