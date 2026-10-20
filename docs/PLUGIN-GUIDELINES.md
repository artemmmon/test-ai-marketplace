# Plugin guidelines

Rules for writing plugin content in this marketplace. The checks that enforce a rule are named; the others are review
rules. The background is in [docs/specs/sdd-plugins.md](specs/sdd-plugins.md) (§4 platform facts, §7 placement rules,
§8 inputs); how to create, check and release a plugin is in [CONTRIBUTING.md](../CONTRIBUTING.md) and
[RELEASES.md](RELEASES.md); what plugin code may and may not do is in [SECURITY.md](SECURITY.md).

## What belongs in which plugin

| Plugin | Holds | Does not hold |
|---|---|---|
| `engineering-paved-path` | Knowledge skills about the stack, architecture, tests and security that several plugins' agents need, or a person needs without the SDD workflow | Agents, hooks, MCP servers, or scripts that run on their own. Scripts are allowed only as examples a skill asks you to run. |
| `research-tools` | The read-only `researcher` agent | Skills, hooks, userConfig, dependencies |
| `architecture-review` | The read-only `architecture-reviewer` agent, which uses the architecture skills of `engineering-paved-path` | Its own copies of those skills |
| `sdd-engineering` | The SDD workflow: its agents, the `spec-authoring`, `run-plan` and `workflow-retro` skills, the guard hooks and their scripts | Stack knowledge that other plugins need |

Placement rules (R-1 to R-4 in the spec):

1. A skill lives in the plugin whose agents or route use it and that other plugins do not need.
2. Stack, architecture, test and security knowledge that more than one plugin needs goes in `engineering-paved-path`.
3. A skill lives in exactly one plugin. No duplicates between plugins; use a dependency.
4. Dependencies point from consumer to provider only. A provider never mentions its consumers.

A plugin is self-contained: no symlinks, no `..` in any path, nothing read from outside its folder (checked).

## Skills

- Layout: `skills/<name>/SKILL.md`; long material in `references/`, scripts and templates in `assets/`. Keep a
  `SKILL.md` short (about 100 to 150 lines for our own skills) and link to `references/` for depth.
- Frontmatter `name` must equal the folder name and match `^[a-z0-9][a-z0-9-]{0,63}$`; `description` is required
  (both checked). The description decides when the skill is loaded, so state what it does and the situations that should
  trigger it ("Use when ..."), and what it is not for.
- A skill that the user starts and that has side effects (launches agents, writes files) sets
  `disable-model-invocation: true` (`run-plan`, `workflow-retro`). **Such a skill cannot be preloaded into an agent**, so
  do not set the flag on a skill that an agent lists in `skills:` (`spec-authoring` does not set it).
- `user-invocable: false` hides a skill from the `/` menu (used by `next-best-practices`); `argument-hint` documents
  the arguments of a user-started skill.
- Users see skills as `/<plugin>:<skill>`, for example `/sdd-engineering:run-plan`.
- Vendored third-party skills keep their upstream structure and `LICENSE`, and the plugin README names the source and the
  license. A skill without a confirmed license does not go into a new release; the three existing ones are a documented
  exception (see [SECURITY.md](SECURITY.md#license-notice-for-three-skills)).

## Agents

- One file per agent: `agents/<name>.md` with `name`, `description`, `tools`, `disallowedTools` where useful, and
  `model`. Allow only the tools the job needs and list denied tools explicitly. A read-only agent gets no `Write` or
  `Edit`; if it needs `Bash`, restrict it in the agent's text to read-only commands and say so.
- **Plugin agents ignore `hooks`, `mcpServers` and `permissionMode` in their frontmatter.** Do not set them
  (`check-marketplace.mjs` fails on them). Put hooks in the plugin's `hooks/hooks.json` and MCP servers in `.mcp.json`.
- **Agent names are scoped**: `plugin:name`, for example `research-tools:researcher`. This is how an agent is started from
  another agent or from a skill (`subagent_type: research-tools:researcher`) and what `agent_type` is in a hook payload.
  Always write the scoped form when referring to a component, including your own (`sdd-engineering:spec-creator`).
  A scoped reference to another plugin is allowed only if that plugin is in `dependencies` (checked); a declared
  dependency that is never referenced as `dependency:component` gives a warning.
- **Preloading skills.** `skills:` in an agent's frontmatter loads the full text of the listed skills at start. Skills from
  a dependency are listed by scoped name:
  `skills: [engineering-paved-path:onion-architecture, engineering-paved-path:frontend-architecture]`. Preloading costs
  context on every run, so preload only what the agent always needs; for the rest, tell the agent to read the skill when a
  condition holds.
- **Limits of `tools`.** `Agent(type)` entries restrict which agents may be started only for the main thread; in a subagent
  the list is ignored. A restriction such as "this agent may start only the researcher" therefore needs a hook (see the
  spec-creator guard) and a sentence in the agent's text. Likewise a `tools` allowlist cannot narrow an MCP server to
  its read tools.
- A hook that guards an agent must act only for that agent: read `agent_type` from the payload and exit 0 for every
  other caller, so it does nothing in the user's own session.
- Pass paths, not file contents, between agents: the plan or spec path is the handoff.
- Read optional project files (`CLAUDE.md`, `AGENTS.md`, `INSIGHTS.md`) only "if they exist". Requiring them is a
  checked error.

## userConfig

`userConfig` in `plugin.json` declares values Claude Code asks for when the plugin is enabled. Non-sensitive values are
substituted as `${user_config.KEY}` in skill and agent content and exported to hooks and scripts as
`CLAUDE_PLUGIN_OPTION_<KEY>`.

- **The `default` is not applied when no value was saved.** In that case the text `${user_config.KEY}` stays literal and
  no `CLAUDE_PLUGIN_OPTION_<KEY>` variable exists. Every agent and script must therefore carry the same built-in default
  as the manifest, and treat an empty value or one that still starts with `${` as unset. The shared helper for scripts
  is `option()` in `plugins/sdd-engineering/scripts/guard-lib.mjs`; agents state the rule in their "Inputs and defaults"
  section.
- Precedence: values in the prompt (`specs_dir:`, `plans_dir:`, `checks:`), then the saved option, then the built-in
  default.
- List options (`"multiple": true`) reach agents as one comma-joined string, so a single command that contains a comma
  breaks. Tell users to keep each entry free of commas.
- Non-sensitive values only; never a secret or a credential, never a default that contains one.
- Keep keys stable. Renaming or removing a key is a major release (see [RELEASES.md](RELEASES.md)).
- Document every key in the plugin README (type, default, what it affects) and in `COMPATIBILITY.md`.
- Treat values that become commands (`check_commands`, `architecture_checks`) as the user's own input and see
  [SECURITY.md](SECURITY.md).

## Paths

- `${CLAUDE_PLUGIN_ROOT}` is the plugin's installed folder. It is available in skills, agents and hooks. Hooks use it:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/<script>.mjs"`. The folder changes with every version, so do not store durable
  data in it.
- `${CLAUDE_SKILL_DIR}` is the folder of the skill's `SKILL.md` (the skill's own subdirectory, not the plugin root). Use it
  in `SKILL.md` bodies to point at the skill's `references/` and `assets/`:
  `node "${CLAUDE_SKILL_DIR}/assets/check-spec.mjs"`.
- Both are substituted in the Markdown text, not in the environment of Bash commands. Write them where Claude reads them
  as text (a code block in `SKILL.md`), and do not expect `$CLAUDE_SKILL_DIR` to exist as a shell variable.
- Project paths (specs, plans, ledger) come from `userConfig` or from arguments, never from constants.
- Forbidden in plugin files, because the plugins are public and generic (checked): `.claude/skills/`, `.claude/hooks/`,
  `$CLAUDE_PROJECT_DIR/.claude/`, `server/` and `client/` paths, `pnpm ...` commands, and names of the project the
  content was extracted from.

## Generic content

- No project-specific paths, package names, ticket ids, people or company names. Examples use neutral names.
- No absolute paths to a developer's machine. No secrets, tokens or real credentials, even in examples
  (see [SECURITY.md](SECURITY.md)).
- English only: skills, agents, scripts, README, CHANGELOG, COMPATIBILITY and comments.
- Scripts are self-contained Node ESM without dependencies (Node 16 or newer for the sdd-engineering scripts), with their
  tests (`*.test.mjs`) beside them; `npm test` at the repository root runs them too, so CI covers them.

## Required documents

Every plugin has all three (checked: a missing file is an error):

| File | Contents |
|---|---|
| `README.md` | What the plugin does and who it is for, install command, what is in it (skills, agents, hooks), inputs (`userConfig`), dependencies and why, what it runs on the user's machine and which files to read before installing. The site shows it as the plugin page. |
| `CHANGELOG.md` | Keep a Changelog. `## [Unreleased]` on top, then `## [x.y.z] - YYYY-MM-DD` per release, newest first. The newest version must equal `plugin.json` `version`. |
| `COMPATIBILITY.md` | A line `Minimum Claude Code version: <x.y.z>`, a Dependencies table with ranges, and notes on scoped names, hooks, `userConfig` and the runtime the scripts need. The site shows it under "Details". |

A change to behaviour, inputs, dependencies or the minimum Claude Code version updates the documents in the same pull
request.

## Evals

Behaviour is tested with `claude plugin eval`; see [evals/README.md](../evals/README.md) for commands.

- Add or update a case when you add or change a skill, an agent, a hook or an output format. Each case checks one
  behaviour, for example "a vague request comes back as questions", "a missing subject is reported as not found".
- A case is a directory with `prompt.md` (front matter: `description`, `tags`, `max_turns`, `allowed_tools`, and
  `plugins:` for cases outside the plugin folder), `graders/*.md` (one check each, `type: llm` with PASS and FAIL
  criteria, or `type: tool_used` to check that the right agent or skill was called) and, if files are needed,
  `case.yaml` plus `fixture.sh`.
- Location: plugins without dependencies keep cases in `plugins/<name>/evals/`; plugins with dependencies keep them in
  `evals/<name>/`, because the eval sandbox loads only the plugins a case names.
- Do not grant `Bash`, `Write` or `Edit` to a case. Inline diffs and samples in the prompt or build them in `fixture.sh`.
- Prompts and fixtures must be generic too (the content rules above apply).
- The initial gate is that every case passes (score 1.0 over 3 runs). Cases are tested with `--model sonnet`; a smaller
  model may not trigger a skill at all.
- Evals are not run in CI. Run the relevant ones before a release that changes behaviour and say so in the pull request.
