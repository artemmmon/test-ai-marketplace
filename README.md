# test-ai-marketplace

Personal [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace):
engineering skills and agents for spec-driven development.

## Plugins

| Plugin | Role | What it provides | Depends on | Version |
|---|---|---|---|---|
| [`sdd-engineering`](plugins/sdd-engineering/README.md) | Spec Driven Development workflow | `/sdd-engineering:run-plan` (spec, brainstorm, plan, build, review loop, verification), 5 agents (`spec-creator`, `brainstorm`, `implementation-planner`, `implementer`, `implementation-verifier`), skills `spec-authoring` and `workflow-retro`, guard hooks | `engineering-paved-path`, `research-tools`, `architecture-review` | 1.0.0 |
| [`engineering-paved-path`](plugins/engineering-paved-path/README.md) | Engineering rules for TypeScript web projects | 7 skills: Fastify, React, Next.js, React Testing Library, onion architecture, frontend architecture, security | none | 1.0.0 |
| [`research-tools`](plugins/research-tools/README.md) | Evidence-backed research | Read-only `researcher` agent: one question, from the repository or from external sources, with a "Not found" list | none | 1.0.0 |
| [`architecture-review`](plugins/architecture-review/README.md) | Architecture audit | Read-only `architecture-reviewer` agent: a module, a package or a branch diff checked against the architecture rules, findings with evidence as JSON | `engineering-paved-path` | 1.0.0 |

```
sdd-engineering ──┬──> engineering-paved-path
                  ├──> research-tools
                  └──> architecture-review ──> engineering-paved-path
```

All ranges are `^1.0.0`; `engineering-paved-path` and `research-tools` have no dependencies.

**Start here:** `claude plugin install sdd-engineering@test-ai-marketplace` installs the other three
automatically. The other plugins can be installed on their own.

The design and the reasons behind it are in [docs/specs/sdd-plugins.md](docs/specs/sdd-plugins.md). Tests of the
plugins' behaviour (`claude plugin eval`) and how to run them are in [evals/README.md](evals/README.md).

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install <plugin>@test-ai-marketplace
```

Claude Code 2.1.269 or newer is required (see each plugin's `COMPATIBILITY.md`).

## Update

Auto-update is off by default for third-party marketplaces and is unreliable anyway. Update by hand:

```
/plugin marketplace update test-ai-marketplace
/reload-plugins
```

If a plugin still looks stale: `claude plugin uninstall <plugin>` then `claude plugin install <plugin>@test-ai-marketplace`.

## Layout

```
.claude-plugin/marketplace.json     the catalog
plugins/<kebab-name>/               one isolated folder per plugin
  .claude-plugin/plugin.json        manifest only — nothing else goes in .claude-plugin/
  skills/<name>/SKILL.md
  agents/  commands/  hooks/hooks.json  .mcp.json
  README.md  CHANGELOG.md  COMPATIBILITY.md
  evals/                            cases for plugins without dependencies
evals/                              cases for plugins with dependencies (see evals/README.md)
docs/specs/                         design specs
scripts/check-marketplace.mjs       invariants beyond `claude plugin validate`
```

## Add or release a plugin

1. Put real files in `plugins/<name>/`. No symlinks and no `../` paths:
   each plugin is copied into the cache on its own, so anything outside its folder is lost.
2. Add an entry to `plugins[]` in `marketplace.json`, kept sorted by name, with
   `"source": "./plugins/<name>"`. The entry `name` must equal the `plugin.json` `name`.
   Names are kebab-case and must not start with `claude-`, `anthropic-` or `cc-plugin-`.
3. Put `version` in `plugin.json` only and bump it on every change — without a bump users
   never receive the new files. Add the release to the plugin's `CHANGELOG.md`.
4. Check:
   ```sh
   claude plugin validate .
   node scripts/check-marketplace.mjs
   ```
5. Test locally: `claude plugin marketplace add ./`, install the plugin, try it, then
   `claude plugin marketplace remove test-ai-marketplace`.
6. Commit, push, and tag.

### Release order and tags

Release the dependencies first: `engineering-paved-path` and `research-tools`, then `architecture-review`,
then `sdd-engineering`. Tag each one after its commit and push the tag:

```sh
claude plugin tag plugins/<name> --push      # creates <name>--v<version>, e.g. engineering-paved-path--v1.0.0
```

The tag `<plugin>--v1.0.0` of every dependency must exist on the remote before a dependent plugin's
version range (`^1.0.0`) can resolve against it, so push the tags before the `marketplace.json` that lists
the plugins reaches `main`. `node scripts/check-marketplace.mjs` warns about a missing tag.

External plugins (`github`, `git-subdir`, `url` sources) must be pinned by `sha` or `ref`.

## Security

A plugin runs with your privileges: hooks, MCP servers and `bin/` executables run outside
Claude's permission rules. Read `hooks/hooks.json`, `.mcp.json` and `bin/` of any plugin
before installing it. `sdd-engineering` registers hooks and runs scripts from its `scripts/` folder; its
README lists the files worth reading first.

## License

[MIT](LICENSE). Third-party skills inside `plugins/engineering-paved-path` keep their own licenses and
notices (see that plugin's README).
