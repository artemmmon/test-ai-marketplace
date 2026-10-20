// The single source of UI text (spec NFR-31). Components never hardcode copy:
// they call t(key) / plural(key, count) from './index'.
//
// Rules:
// - values are plain strings; `{name}` is an interpolation placeholder;
// - plurals are `{ one, other }` objects, read with plural(key, count);
// - rich text (inline code, links) is split into keyed fragments that the
//   component stitches together around the element, so there is no JSX or
//   HTML here;
// - technical tokens (commands, flags, file names, routes) stay in code.
export const en = {
  common: {
    copy: 'Copy',
    copied: 'Copied',
    retry: 'Retry',
    version: 'v{version}',
    and: 'and',
    github: 'GitHub',
    source: 'Source',
    reportIssue: 'Report an issue',
    notSpecified: 'Not specified',
    notInCatalog: 'Not in catalog',
    allPlugins: 'All plugins',
    searchLink: 'Search',
    breadcrumb: 'Breadcrumb',
    gettingStarted: 'Getting started',
    couldntLoadCatalog: 'Couldn’t load the catalog',
    couldntLoad: 'Couldn’t load {what}.',
    runsOutsidePermissions: 'This code runs on your machine outside Claude’s permission rules. Read it before installing.',
    installsWholePlugin: 'Installs the whole plugin {plugin}',
  },

  page: {
    // {site} is the brand name, which stays in code.
    title: '{page} — {site}',
  },

  layout: {
    skipToContent: 'Skip to content',
  },

  types: {
    label: {
      plugin: 'Plugin',
      skill: 'Skill',
      agent: 'Agent',
      command: 'Command',
      hook: 'Hook',
      mcp: 'MCP',
    },
    plural: {
      plugin: 'Plugins',
      skill: 'Skills',
      agent: 'Agents',
      command: 'Commands',
      hook: 'Hooks',
      mcp: 'MCP',
    },
  },

  header: {
    nav: {
      search: 'Search',
      whatsNew: 'What’s new',
      gettingStarted: 'Getting started',
    },
    mainNavLabel: 'Main',
    mobileNavLabel: 'Mobile',
    switchTo: {
      dark: 'Switch to dark theme',
      light: 'Switch to light theme',
    },
    githubRepository: 'GitHub repository',
    closeMenu: 'Close menu',
    openMenu: 'Open menu',
  },

  footer: {
    catalogGenerated: 'Catalog generated {date} from',
    reportIssue: 'Report an issue',
  },

  demoBanner: {
    text: 'Demo data — the real catalog is not indexed yet',
  },

  badges: {
    executesCode: 'Executes code',
    executesCodeTitle:
      "Contains hooks, MCP servers or bin/ executables that run outside Claude's permission rules. Review before installing.",
    external: 'External',
    externalTitle: 'Metadata only — source code is not indexed',
  },

  copy: {
    install: 'Copy install',
    installLabel: 'Copy install command for plugin {plugin}',
    copiesCommand: 'Copies {command}',
    code: 'Copy code',
    file: 'Copy {file}',
  },

  toast: {
    copied: 'Copied',
    copyFailed: "Couldn't copy — press Ctrl/Cmd+C",
    commandToCopy: 'Command to copy',
  },

  search: {
    placeholder: 'Search plugins, skills, agents…',
    fieldLabel: 'Search plugins, skills, agents',
    headerFieldLabel: 'Search the catalog',
    clear: 'Clear search',
    heading: 'Search the catalog',
    loading: 'Loading catalog…',
    sort: {
      label: 'Sort',
      relevance: 'Relevance',
      name: 'Name (A–Z)',
      updated: 'Recently updated',
    },
    error: {
      body: 'Check your connection and try again. If the problem persists, the deploy may be broken.',
      openRepository: 'Open the repository',
    },
    empty: {
      title: 'The catalog is empty',
      body: 'No plugins have been published yet. Once a plugin is added to the marketplace, it appears here with its skills, agents and commands.',
      howToAdd: 'How to add a plugin',
    },
    filters: {
      title: 'Filters',
      close: 'Close filters',
      type: 'Type',
      plugin: 'Plugin',
      tag: 'Tag',
      showFewerTags: 'Show fewer tags',
      showAllTags: 'Show all tags',
      toggle: 'Filters',
      toggleWithCount: 'Filters ({count})',
      active: 'Active filters',
      clearAll: 'Clear all',
      removeType: 'Remove filter type {type}',
      removePlugin: 'Remove filter plugin {plugin}',
      removeTag: 'Remove filter tag {tag}',
    },
    results: {
      label: 'Results',
      count: { one: '{count} result', other: '{count} results' },
      forQuery: 'for “{query}”',
      showCount: { one: 'Show {count} result', other: 'Show {count} results' },
      partial: 'Showing partial matches',
      showMore: 'Show more',
    },
    only: {
      plugin: 'Only plugins',
      skill: 'Only skills',
      agent: 'Only agents',
      command: 'Only commands',
      hook: 'Only hooks',
      mcp: 'Only MCP',
    },
    noResults: {
      forQuery: 'No results for “{query}”',
      title: 'No results',
      resetFilters: 'Reset the filters',
      tryEnglish: 'Try the same words in English: descriptions are written in English.',
      tryTag: 'Try a popular tag:',
      cantFind: 'Can’t find it?',
      requestPlugin: 'Request a plugin',
    },
  },

  card: {
    filterByTag: 'Filter by tag {tag}',
    inPlugin: 'in',
    matchedIn: 'Matched in {file}:',
    pluginMeta: '{composition} · {dependencies}',
    view: 'View',
    viewLabel: 'View {name}',
    viewSource: 'View source on GitHub',
  },

  plugin: {
    notFoundTitle: 'Plugin not found',
    notFoundNamed: 'Plugin “{name}” not found',
    composition: {
      notIndexed: 'not indexed',
      noComponents: 'no components',
      hooks: 'hooks',
      skills: { one: '{count} skill', other: '{count} skills' },
      agents: { one: '{count} agent', other: '{count} agents' },
      commands: { one: '{count} command', other: '{count} commands' },
      mcpServers: { one: '{count} MCP server', other: '{count} MCP servers' },
      binFiles: { one: '{count} bin file', other: '{count} bin files' },
    },
    dependencySummary: {
      none: 'no dependencies',
      dependsOn: { one: 'depends on {count} plugin', other: 'depends on {count} plugins' },
    },
    install: {
      title: 'Install',
      addMarketplace: 'Add the marketplace (once)',
      addMarketplaceLabel: 'Copy the add marketplace command',
      installPlugin: 'Install the plugin',
      installLabel: 'Copy the install command for {plugin}',
      scope: 'Scope',
      scopeTitle: {
        project: 'Only for the current project',
        user: 'For all your projects',
      },
      wholePlugin: 'Installs the whole plugin with all its components.',
      dependenciesAuto: 'Dependencies are installed automatically:',
      executesTitle: 'This plugin executes code.',
      executesIt: 'It {reasons}, outside Claude’s permission rules.',
      dependenciesExecuteTitle: 'Dependencies execute code.',
      dependenciesOutside: 'outside Claude’s permission rules.',
      readBefore: 'Read them before installing.',
      reason: {
        hooks: 'runs hooks',
        mcp: 'starts an MCP server',
        bin: 'ships bin/ executables',
        generic: 'executes code',
      },
    },
    modeSwitch: {
      label: 'Where to run the commands',
      chat: 'In chat',
      terminal: 'In terminal',
    },
    dependencies: {
      title: 'Dependencies',
      none: 'No dependencies.',
      name: 'Name',
      required: 'Required',
      resolved: 'Resolved',
      status: 'Status',
      satisfied: 'Satisfied',
      tree: 'Dependency tree',
      treeNotInCatalog: 'not in catalog',
      usedBy: 'Used by:',
      usedByNone: 'no other plugins in the catalog.',
    },
    contents: {
      title: 'Contents',
      externalNotIndexed: 'Contents are not indexed for external plugins.',
      viewSource: 'View the source →',
      tabsLabel: 'Components by type',
      tabCount: '{label} ({count})',
      tabBin: 'bin/ ({count})',
      openPage: 'Open page',
      noContent: 'No content provided.',
    },
    readme: {
      title: 'README',
      none: 'No README provided.',
    },
    changelog: {
      title: 'Changelog',
      allReleases: 'All releases in What’s new',
      couldntLoad: 'Couldn’t load the changelog.',
      none: 'No changelog provided.',
      untagged: 'untagged',
      noNotes: 'No release notes.',
      showFewer: 'Show fewer releases',
      showAll: 'Show all releases ({count})',
    },
    aside: {
      label: 'Plugin details',
      title: 'Details',
      version: 'Version',
      owner: 'Owner',
      unknownOwner: 'Unknown',
      license: 'License',
      compatibility: 'Compatibility',
      claudeCode: 'Claude Code',
      compatibilityDetails: 'Details',
      source: 'Source',
      latestRelease: 'Latest release',
      noRelease: 'None',
      contents: 'Contents',
      keywords: 'Keywords',
    },
  },

  artifact: {
    notFoundTitle: 'Artifact not found',
    ambiguousTitle: 'Several artifacts are called “{id}”',
    ambiguousPick: 'Pick one:',
    notFoundBody: 'Nothing in the catalog has the id “{id}”.',
    searchFor: 'Search for “{term}”',
    partOf: 'Part of',
    pluginExecutesCode: 'the plugin executes code',
    installsWholePluginHint: 'Installs the whole plugin',
    otherFiles: 'Other files',
    moreFrom: 'More from',
    events: 'Events',
    servers: 'Servers',
    serverName: 'Name',
    transport: 'Transport',
    commandOrUrl: 'Command / URL',
    frontmatter: 'Frontmatter',
    key: 'Key',
    value: 'Value',
  },

  whatsNew: {
    title: 'What’s new',
    lede: 'Releases of plugins in the catalog, newest first.',
    pluginFilter: 'Plugin',
    couldntLoad: 'Couldn’t load releases.',
    none: 'No releases yet.',
    undated: 'Undated',
    untagged: 'untagged',
    noNotes: 'No release notes.',
  },

  gettingStarted: {
    title: 'Getting started',
    lede: 'Add the marketplace to Claude Code, install a plugin and keep it up to date.',
    add: {
      title: 'Add the marketplace',
      body: 'Run this once. Claude Code remembers the marketplace afterwards.',
      label: 'Copy the add marketplace command',
    },
    find: {
      title: 'Find a plugin',
      body: 'Skills, agents and commands come inside plugins. You always install the whole plugin, not a single skill. Components have namespaced names like',
      search: 'Search the catalog',
    },
    install: {
      title: 'Install',
      replace: 'Replace',
      withPluginName: 'with the plugin name. In the terminal,',
      installsForProject: 'installs for the current project and',
      forAllProjects: 'for all your projects.',
      label: 'Copy the install command',
    },
    installed: {
      title: 'Check what’s installed',
      body: 'Runs in the terminal.',
      label: 'Copy the list command',
    },
    update: {
      title: 'Update',
      beforeVersion:
        'Auto-update is off by default for third-party marketplaces and is unreliable, so update by hand. A new version arrives only after the plugin’s',
      afterVersion: 'is bumped.',
      updateLabel: 'Copy the update command',
      reloadLabel: 'Copy the reload command',
    },
    security: {
      title: 'Security',
      beforeBin: 'Hooks, MCP servers and',
      afterBin:
        'run with your privileges, outside Claude’s permission rules. Read them on the plugin page before installing.',
    },
  },

  notFound: {
    title: 'Page not found',
    message: 'The address may be mistyped, or the item was removed from the catalog.',
    goToSearch: 'Go to search',
  },

  issue: {
    page: 'Page: {url}',
    commit: 'Catalog commit: {commit}',
    unknownCommit: 'unknown',
    whatHappened: '## What happened',
    expected: '## Expected',
  },
} as const;
