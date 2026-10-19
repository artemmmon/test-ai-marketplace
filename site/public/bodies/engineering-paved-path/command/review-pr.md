Review PR $ARGUMENTS with the `code-reviewer` agent.

1. Fetch the pull request diff with `gh pr diff $ARGUMENTS`.
2. Hand the diff to the `code-reviewer` agent.
3. Print the blocking issues first, then the notes.
