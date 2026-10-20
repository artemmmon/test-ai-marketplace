# Compatibility

Minimum Claude Code version: 2.1.269 (first release that supports `claude plugin eval`, which the plugin set uses)

## Dependencies

None.

## Notes

- Skills only: no agents, hooks, MCP servers or `userConfig`.
- Skills are invoked as `/engineering-paved-path:<skill>` by users and as
  `engineering-paved-path:<skill>` by agents and other skills.
