---
type: llm
---

PASS if the reply answers the git question directly (`git reset --soft HEAD~1`, or `git reset HEAD~1`
which keeps the changes unstaged) in a few lines, and contains no architecture, security, framework or
testing advice.
FAIL if the reply wanders into code review, layering, security rules or framework guidance, or does not
answer the question.
