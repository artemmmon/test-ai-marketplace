# Compatibility

Minimum Claude Code version: 2.1.269 (first release that supports `claude plugin eval`, which the plugin set uses)

## Dependencies

| Plugin | Range |
|---|---|
| `engineering-paved-path` | `^1.0.0` |

## Notes

- Agent only: no skills, hooks, MCP servers or `userConfig`.
- The agent is addressed as `architecture-review:architecture-reviewer`.
- Its `skills:` frontmatter preloads `engineering-paved-path:onion-architecture` and
  `engineering-paved-path:frontend-architecture` by scoped name.
