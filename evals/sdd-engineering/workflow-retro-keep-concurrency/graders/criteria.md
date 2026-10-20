---
type: llm
---

PASS if all of these hold:
- It does not propose reducing concurrency: with no API errors the parallel run costs the same tokens and
  less time, and it says to keep it.
- It proposes preloading `rules/severity.md` for the reviewer role (a `skills:` entry in the agent file,
  or the needed lines in the prompt) or inlining what the role needs, naming the agent role and the
  number behind it (38 reads, about 6 KB each).
- Each action names a file or an agent, the change and a number.
- It lists 3 to 5 actions at most (fewer is fine when the data supports fewer) and does not edit any agent
  file as part of the retro.

FAIL if it recommends lowering the number of parallel agents, if an action has no number, or if it
invents measurements that are not in the input.
