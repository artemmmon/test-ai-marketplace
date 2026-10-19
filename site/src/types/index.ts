// TypeScript types for the generated site data (spec §4.3–4.5).
// This file is the source of truth for the frontend.

export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type ComponentType = Exclude<ArtifactType, 'plugin'>;

export interface IndexFile {
  schemaVersion: '1.0';
  generatedAt: string;
  commit: string;
  fixture: boolean;
  marketplace: MarketplaceInfo;
  items: IndexItem[];
}

export interface MarketplaceInfo {
  name: string;
  description: string;
  owner: { name: string; email?: string; url?: string };
  repo: { slug: string; url: string; defaultBranch: string };
  siteUrl: string;
  addCommands: { chat: string; cli: string };
}

export interface InstallCommands {
  chat: string;
  cliProject: string;
  cliUser: string;
}

interface BaseItem {
  id: string;
  type: ArtifactType;
  name: string;
  qualifiedName: string;
  plugin: string;
  version: string | null;
  description: string;
  keywords: string[];
  path: string | null;
  bodyRef: string | null;
  bodyFormat: 'markdown' | 'json' | null;
  searchText: string;
  source: 'local' | 'external';
  executesCode: boolean;
  installCommands: InstallCommands;
  updatedAt: string | null;
}

export interface PluginItem extends BaseItem {
  type: 'plugin';
  owner: { name: string; email?: string; url?: string } | null;
  license: string | null;
  homepage: string | null;
  repository: string | null;
  compatibility: Compatibility | null;
  dependencies: Dependency[];
  usedBy: string[];
  components: Record<ComponentType, string[]>;
  bin: string[];
  readmeRef: string | null;
  changelogRef: string | null;
  latestRelease: { version: string; date: string | null; tag: string | null } | null;
  external: ExternalSource | null;
}

export interface ExternalSource {
  kind: 'github' | 'git-subdir' | 'url';
  url: string;
  ref: string | null;
  sha: string | null;
  path: string | null;
}

export interface Compatibility {
  claudeCode: string | null;
  bodyRef: string | null;
}

export interface Dependency {
  name: string;
  range: string;
  resolvedVersion: string | null;
  status: 'satisfied' | 'not-in-catalog';
}

export interface SkillItem extends BaseItem {
  type: 'skill';
  frontmatter: Record<string, unknown>;
  files: string[];
}

export interface AgentItem extends BaseItem {
  type: 'agent';
  tools: string[] | null;
  model: string | null;
  frontmatter: Record<string, unknown>;
}

export interface CommandItem extends BaseItem {
  type: 'command';
  argumentHint: string | null;
  frontmatter: Record<string, unknown>;
}

export interface HookItem extends BaseItem {
  type: 'hook';
  events: string[];
  executesCode: true;
}

export interface McpItem extends BaseItem {
  type: 'mcp';
  servers: Array<{
    name: string;
    transport: 'stdio' | 'http' | 'sse' | 'unknown';
    command: string | null;
    url: string | null;
  }>;
  executesCode: true;
}

export type IndexItem = PluginItem | SkillItem | AgentItem | CommandItem | HookItem | McpItem;

export interface ReleasesFile {
  schemaVersion: '1.0';
  generatedAt: string;
  commit: string;
  releases: Release[];
}

export interface Release {
  id: string;
  plugin: string;
  version: string;
  date: string | null;
  tag: string | null;
  commit: string | null;
  notesMarkdown: string;
  origin: 'changelog+tag' | 'changelog' | 'tag';
}

export interface StatsFile {
  schemaVersion: '1.0';
  generatedAt: string;
  commit: string;
  counts: {
    plugins: number;
    pluginsLocal: number;
    pluginsExternal: number;
    skills: number;
    agents: number;
    commands: number;
    hooks: number;
    hookEvents: number;
    mcp: number;
    releases: number;
  };
}
