# Observability: which plugin version is active and what fired

How to confirm, from Claude Code's own output, which version of a plugin is loaded, whether its dependencies were
satisfied, and which skill or agent of it ran. Everything here was run on Claude Code 2.1.306 (2026-10-21) with the four
plugins of this repository; the field names can change in other versions, so re-check after an upgrade.

## What you can and cannot show

| Question | Can you show it? | Source |
|---|---|---|
| Plugin name | Yes | `plugins[].name` in the `system/init` message; `plugin.name` on telemetry events; `attributionPlugin` in the transcript |
| Plugin version | Yes | `plugins[].version` in `system/init`; `plugin.version` on the `claude_code.plugin_loaded` event; `claude plugin list --json` (installed plugins only) |
| Dependencies | Only indirectly | No source prints the dependency list or a "dependency resolved" line. Evidence: all required plugins are in `init.plugins` and `plugin_errors` is empty. The declared list is only in `plugin.json` `dependencies`. When a dependency is missing, `plugin_errors` says so (see the negative test) |
| Which skill fired | Yes | `claude_code.skill_activated` (`skill.name`, `plugin.name`, `invocation_trigger`); `attributionSkill` in the transcript |
| Which agent fired | Yes | `claude_code.subagent_completed` (`agent_type`, `plugin.name`); `attributionAgent` on sidechain entries in the transcript |
| Version of the skill or agent that fired | Only by joining | `skill_activated` and `subagent_completed` carry no version. Join on `plugin.name` with the `plugin_loaded` event of the same session |

Skills, slash commands and agents are listed in `init` by scoped name (`sdd-engineering:run-plan`) without versions.
The dependency criterion therefore cannot be met by a trace alone: show the `init` output (all four plugins loaded, no
errors) next to the `dependencies` block of `plugin.json`, and say that this is the evidence.

## Demo 1: the init message (plugin, version, dependencies by absence of errors)

Run from the repository root. `--output-format stream-json` needs `--verbose` with `-p`.

```sh
claude -p "Reply with the single word ok." --model haiku --max-turns 1 \
  --output-format stream-json --verbose \
  --plugin-dir plugins/engineering-paved-path --plugin-dir plugins/research-tools \
  --plugin-dir plugins/architecture-review --plugin-dir plugins/sdd-engineering > init.jsonl

# plugins, versions, errors, and the scoped agents of our plugins
jq -c 'select(.type=="system" and .subtype=="init")
  | { plugins: [.plugins[] | select(.source | endswith("@inline")) | {name, version, source}],
      plugin_errors,
      agents: [.agents[] | select(test("^(sdd-engineering|research-tools|architecture-review):"))] }' init.jsonl

# skills of our plugins
jq -r 'select(.type=="system" and .subtype=="init") | .skills[]
  | select(test("^(engineering-paved-path|sdd-engineering):"))' init.jsonl
```

Expected: four entries with `source` `<plugin>@inline` and the versions from each `plugin.json` (at the time of writing
`engineering-paved-path` 1.0.1, `research-tools` 1.0.0, `architecture-review` 1.0.0, `sdd-engineering` 1.2.0), and
`plugin_errors` `null`. The `init` message also lists every other plugin of your profile; the `select` keeps only the ones
loaded with `--plugin-dir`. Built-in plugins (`@builtin`) have no version. For an installed plugin the source is
`<plugin>@<marketplace>`. The official documentation lists only `name` and `path` for `plugins`; `source` and `version`
appear in real output.

## Demo 2: the dependency negative test

Load only the plugin that has dependencies:

```sh
claude -p "Reply with the single word ok." --model haiku --max-turns 1 \
  --output-format stream-json --verbose --plugin-dir plugins/sdd-engineering > init-neg.jsonl

jq -c 'select(.type=="system" and .subtype=="init") | {plugin_errors, agents: [.agents[] | select(startswith("sdd-engineering:"))]}' init-neg.jsonl
```

Expected: `plugin_errors` holds one `dependency-unsatisfied` entry with the message `Dependency "engineering-paved-path" is
not installed ...`, and `agents` is empty because the agents of `sdd-engineering` are not loaded (the plugin does not
appear in `plugins` either). Only the first missing dependency is reported. Together with Demo 1 this shows that the
dependencies are enforced: with them the plugin loads, without them it does not.

## Demo 3: telemetry events (what fired, with the version)

Export the variables first; the inline `VAR=x claude ...` form once produced no exporter.

```sh
export CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_LOGS_EXPORTER=console OTEL_METRICS_EXPORTER=console \
  OTEL_TRACES_EXPORTER=console CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 OTEL_LOG_TOOL_DETAILS=1

claude -p "Load the skill engineering-paved-path:security with the Skill tool, then start the research-tools:researcher agent with the task: list the top-level files of the current directory. Then reply done." \
  --model haiku --max-turns 5 \
  --plugin-dir plugins/engineering-paved-path --plugin-dir plugins/research-tools \
  --plugin-dir plugins/architecture-review --plugin-dir plugins/sdd-engineering > telemetry.txt

grep -E -A24 'body: "claude_code\.(plugin_loaded|skill_activated|subagent_completed)"' telemetry.txt \
  | grep -E 'body:|"plugin\.(name|version)"|"skill\.name"|agent_type'
```

The console exporter prints JavaScript-style objects (not JSON) to stdout, mixed with the answer, so the output is
filtered with `grep`. I saw it with the default text output; the same prompt with `--output-format stream-json` printed
no exporter records. Expected, for our plugins:

```
body: "claude_code.plugin_loaded",     "plugin.name": "sdd-engineering",  "plugin.version": "1.2.0"   (one per enabled plugin)
body: "claude_code.skill_activated",    "skill.name": "engineering-paved-path:security", "plugin.name": "engineering-paved-path"
body: "claude_code.subagent_completed", agent_type: "research-tools:researcher", "plugin.name": "research-tools"
```

- `plugin_loaded` is emitted once per enabled plugin at session start. Besides `plugin.name` and `plugin.version` it has
  `marketplace.name` (`inline` for `--plugin-dir`), `plugin.scope` and `has_hooks`.
- `skill_activated` has `skill.name`, `plugin.name` and `invocation_trigger` (`claude-proactive` when the model chose the
  skill); `subagent_completed` has `agent_type`, `plugin.name`, token and duration figures. Neither has a version: join
  on `plugin.name` with `plugin_loaded` of the same `session.id`.
- Trace spans (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, beta) carry `subagent_type` and `skill_name` in tool spans but no
  plugin version.
- By the documentation, without `OTEL_LOG_TOOL_DETAILS=1` the names of non-official plugins are redacted. This was not
  checked.

### Redact before sharing

The console exporter output contains your email (`user.email`), `user.id`, `user.account_uuid`, `user.account_id` and
`organization.id` on every event. Do not paste raw output into an issue, a pull request or a recording. Show the
filtered lines above, or mask the identity attributes first.

## Other sources

- Transcript JSONL (`~/.claude/projects/...`): entries carry `attributionSkill`, `attributionPlugin` and, on sidechain
  (subagent) entries, `attributionAgent`. There is no plugin version; the `version` field there is the Claude Code version.
- `claude plugin list --json`: installed plugins only (not `--plugin-dir` ones) with `id`, `version`, `scope`, `enabled`
  and `installPath`. No dependencies field.

## Not verified

- The interactive views `/plugin`, `/status` and `/context`.
- Exporting traces to a viewer such as Perfetto.
- The `claude_code.plugin_installed` event.
- Redaction of plugin names when `OTEL_LOG_TOOL_DETAILS` is unset (documented, not run).
- Other Claude Code versions. Field names and event names were read from 2.1.306 output.
