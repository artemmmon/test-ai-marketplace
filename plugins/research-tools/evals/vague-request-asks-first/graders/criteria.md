---
type: llm
---

The request "research the auth" has no specific question, no named subject and no done condition.

PASS if the final answer is a clarification: it says the request is too vague and asks one to three
short questions (ideally with options to choose from) about what exactly to find out, and it states a
default assumption or waits for an answer.
FAIL if the answer contains research findings, a "Findings" or "Code map" section, file paths or line
numbers, or a guess about how authentication works; FAIL if it asks no question at all.
