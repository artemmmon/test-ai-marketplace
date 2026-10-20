# Compatibility

Minimum Claude Code version: 2.1.269 (first release that supports `claude plugin eval`, which the plugin set uses)

## Dependencies

| Plugin | Range |
|---|---|
| `engineering-paved-path` | `^1.0.0` |
| `research-tools` | `^1.0.0` |
| `architecture-review` | `^1.0.0` |

`architecture-review` itself depends on `engineering-paved-path`; the dependencies are installed automatically.

## Notes

- Agents are addressed by scoped name, for example `sdd-engineering:spec-creator`. Agents of this plugin also
  start `research-tools:researcher` and `architecture-review:architecture-reviewer` by scoped name.
- Plugin agents ignore `hooks`, `mcpServers` and `permissionMode` in their frontmatter, so the guards are
  registered in `hooks/hooks.json` for the whole session. Each script acts only when the hook payload's
  `agent_type` is its own agent (`sdd-engineering:spec-creator`, `sdd-engineering:implementation-planner`,
  `sdd-engineering:brainstorm`) and does nothing for every other caller, including the main session.
- Agent frontmatter `skills:` preloads skills from dependency plugins by scoped name
  (`engineering-paved-path:onion-architecture`).
- Since 1.1.0 the `implementer` loads `sdd-engineering:engineering-insights` with the Skill tool when it has a finding
  to record; the skill needs no option and no dependency, and it is not preloaded, so it costs no context otherwise.
- Since 1.1.1 the `implementer` writes new tests in `multi-agent` plans too when its prompt says `tests: on`, sets the
  spec to `implemented` with the plan's last group, and fills a `Baseline:` line in the plan's Verification section
  when the planner left it "to be recorded"; no option or dependency changed.
- `userConfig` keys: `specs_dir`, `plans_dir`, `retro_ledger`, `check_commands`, `architecture_checks`. A `default`
  is not applied when no value was saved (the `${user_config.KEY}` text stays literal and no
  `CLAUDE_PLUGIN_OPTION_<KEY>` variable is exported), so every agent and script carries the same built-in default
  (`specs`, `docs/plans`, `docs/retros/ledger.md`, no commands) and treats a missing or placeholder value as unset.
- Scripts are Node ESM without dependencies and run on Node 16 or newer.
