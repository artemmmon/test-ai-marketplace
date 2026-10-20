# Security

A Claude Code plugin runs with the privileges of the person who installs it. Hooks, scripts and MCP servers run
outside Claude's permission rules, and an agent can use every tool in its `tools` list. For this reason the content of
the plugins in this marketplace is treated as code, not as documentation.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

1. Open the **Security** tab of the repository on GitHub
   (https://github.com/artemmmon/test-ai-marketplace/security) and choose **Report a vulnerability**. This uses GitHub
   private vulnerability reporting: only you and the maintainer can see the report.
2. Describe what is affected (plugin, file, version or tag), how to reproduce it, and what an attacker gains.
3. If the Security tab does not offer **Report a vulnerability**, open a public issue that says only that you need a
   private channel for a security report. Do not put details in it. The maintainer will reply with a way to continue.

For the maintainer: private vulnerability reporting is a repository setting (Settings, Code security). It must be
switched on for step 1 to work.

This is a personal marketplace made for a course lab and has no service-level commitment. Reports are handled on a
best-effort basis.

## What is in scope

Everything in this repository that a user installs or runs:

- **Hooks and scripts that run automatically**: `plugins/sdd-engineering/hooks/hooks.json` and
  `plugins/sdd-engineering/scripts/`.
- **Scripts that skills ask an agent or the user to run**: `skills/*/assets/*.mjs` (for example `check-spec.mjs`,
  `check-plan.mjs`, `retro.mjs`) and the example `assets/dependency-cruiser.cjs`.
- **Agent definitions**: the `tools` and `disallowedTools` lists and the instructions in `agents/*.md`. A tool list that
  is wider than the agent needs, or an instruction that lets an agent write or run something it should not, is a
  vulnerability.
- **`userConfig`**: how values from `plugin.json` `userConfig` are used. A value must not become executable code
  anywhere except the documented check commands (below).
- **MCP servers and `bin/` executables**: none exist today; any added later are in scope.
- **The catalog tooling and CI** (`scripts/`, `.github/workflows/`) when it could leak secrets or let a pull request
  run untrusted code with write access.

Out of scope: vulnerabilities in Claude Code itself (report them to Anthropic), in GitHub, or in the third-party
projects the vendored skills came from, and content that is only advice (a skill's text recommending a practice).

## What `sdd-engineering` runs

Read these files before installing the plugin: `hooks/hooks.json`, `scripts/guard-lib.mjs`,
`scripts/spec-creator-guard.mjs`, `scripts/plans-guard.mjs`, `scripts/run-check-hook.mjs`. All scripts are plain Node
ESM without dependencies. Every hook has a 10 second timeout.

### Hooks

`hooks/hooks.json` registers five commands for the whole session, because plugin agents cannot declare hooks in their
frontmatter. Each script reads the hook payload from stdin and acts only when the payload's `agent_type` is its own
agent; for any other caller, including your main session, it exits 0 and does nothing.

| Script | When | Agent | What it does |
|---|---|---|---|
| `spec-creator-guard.mjs` | before `Write`, `Edit`, `Agent`, `Task` and MCP tools | `sdd-engineering:spec-creator` | Allows writing only `<specs_dir>/*.md`, and only while the spec is `Status: draft` before and after the change (an approved spec may be edited only when the edit turns it back into `draft`); allows starting only `research-tools:researcher`; allows MCP calls only to Figma read tools (`get_*`). Otherwise exits 2 and returns the reason to the agent. |
| `plans-guard.mjs --kind plan` | before `Write`, `Edit` | `sdd-engineering:implementation-planner` | Allows writing only `<plans_dir>/NN-short-name.md`, never a `.brainstorm.md`, only while `Status: draft`. |
| `plans-guard.mjs --kind brainstorm` | before `Write`, `Edit` | `sdd-engineering:brainstorm` | Allows writing only `<plans_dir>/NN-short-name.brainstorm.md`, only as `Status: awaiting choice`. |
| `run-check-hook.mjs ... check-spec.mjs --hook` | after `Write`, `Edit` | `sdd-engineering:spec-creator` | Runs the spec form check and returns its errors to the agent. |
| `run-check-hook.mjs ... check-plan.mjs --hook` | after `Write`, `Edit` | `sdd-engineering:implementation-planner` | Runs the plan form check and returns its errors to the agent. |

What they never do:

- **They never write, move or delete files.** The guards only read the payload and project files and decide allow or
  block by exit code. The check scripts only read.
- **They never use the network.**
- **They never run anything built from `userConfig` or from the payload.** `run-check-hook.mjs` runs only a script named
  in `hooks.json`, resolved inside the plugin folder, with `node`, and only for the agent named in `hooks.json`; a
  missing script is skipped.
- **They never act for other agents or for your main session.**
- **Folder checks resolve symlinks** (`realpath` on the deepest existing ancestor), so a link inside `specs_dir` or
  `plans_dir` cannot lead a write outside it.

A guard limits what it checks: it constrains the agent's `Write` and `Edit` calls and agent and MCP starts. It does not
constrain `Bash`. `spec-creator` has no `Bash` in its tools (`disallowedTools: Bash`); the planner and `brainstorm` do
have it, and their read-only behaviour there comes from their instructions, not from a hook.

### Scripts run by skills

| Script | Reads | Writes | Other |
|---|---|---|---|
| `skills/spec-authoring/assets/check-spec.mjs` | spec files | nothing | |
| `skills/run-plan/assets/check-plan.mjs` | plan and spec files | nothing | runs read-only `git` commands (`symbolic-ref`, `merge-base`, `diff --name-only`, `ls-files`) |
| `skills/workflow-retro/assets/retro.mjs` | your Claude Code transcripts under `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR/projects`) | the retro report and the ledger (`retro_ledger`) | run only by `/sdd-engineering:workflow-retro`, which only the user can start |

### Check commands from `userConfig`

`check_commands` and `architecture_checks` hold shell commands that you type in. No hook runs them. The implementer and the
verifier receive `check_commands`, and the architecture reviewer receives `architecture_checks` as its `checks:` list,
as text; they run the commands with the `Bash` tool, under your normal Claude Code permission rules. The reviewer is told
to refuse commands that would edit files and to report them as not checked; that is an instruction, not a technical block. Because a command is whatever you configured, treat these two options like any other command you
would put in your own scripts: set them yourself, and review a project's `.claude/settings.json` before accepting
values another person configured for you. When they are empty, the agents run the commands in the plan's Verification
section, or none.

### Other plugins

- `engineering-paved-path`: skills only. No agents, hooks, MCP servers or scripts that run on their own. It ships
  `assets/dependency-cruiser.cjs` as an example for you to copy; nothing runs it.
- `research-tools` and `architecture-review`: one agent each, no hooks. Both have `Bash` in `tools` and are told to use it
  only for read-only commands (git history and diff, `ls`, `cat`, `rg`, `grep`; the reviewer also runs the configured
  mechanical checks). That limit is an instruction, not a technical block. `research-tools:researcher` can also use
  `WebSearch` and `WebFetch`.

## Rules for contributors

- **No secrets in plugins.** No API keys, tokens, passwords, private keys, credentials files or `.env` content, in any
  file, example or test fixture. `userConfig` options are for non-sensitive values only; a secret must never be a
  `userConfig` default. Use obviously fake values in examples.
- No absolute paths to a developer's machine, no hard-coded project paths or names.
- A plugin must not read or write outside the project and the plugin's own folder without the user asking, except where
  this document lists it (`retro.mjs` reading transcripts).
- Keep agent `tools` lists as small as the job allows and list denied tools in `disallowedTools`. Read-only agents get no
  `Write` or `Edit`.
- Hooks must be fast, offline, and do nothing for callers they are not meant for. Do not build commands from untrusted
  input.
- A change to a hook, a script or an agent's tool list is reviewed as a security change; say so in the pull request.

## Supported versions

Only the newest released version of each plugin is supported. Fixes are released as a patch version of the affected plugin (and of dependent plugins whose range or behaviour
needs it) with a `### Security` entry in its `CHANGELOG.md`; see [RELEASES.md](RELEASES.md). Older versions do not get
backports: update to the latest release (`/plugin marketplace update test-ai-marketplace`, then `/reload-plugins`).

| Plugin | Supported |
|---|---|
| `engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering` | latest `1.x` release |

## License notice for three skills

`engineering-paved-path` contains three skills whose upstream license could not be established:
`react-best-practices`, `next-best-practices` and `react-testing-library`. They are included for test and lab use only,
are not covered by the MIT license of the plugin, and each has a `LICENSE-NOTICE.md` in its folder with what is known
about its origin. They will be removed on request of the rights holder. Do not rely on them in production or
redistribute them. Claims by a rights holder are handled as described in
[Reporting a vulnerability](#reporting-a-vulnerability): use the same private channel and name the skill. The skill
`fastify-best-practices` keeps its own MIT `LICENSE`. See the plugin's
[README](../plugins/engineering-paved-path/README.md#licensing-notice) for the table of origins.
