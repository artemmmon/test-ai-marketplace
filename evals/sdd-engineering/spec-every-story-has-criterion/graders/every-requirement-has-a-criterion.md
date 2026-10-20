---
type: llm
focus: { source: file, path: specs/01-team-invites.md }
---

The brief states three requirements: (1) an admin invites a colleague by e-mail address, the colleague
gets an invitation with a link that stops working after 7 days; (2) when the address already belongs to a
member, the message "This person is already a member" is shown and no invitation is sent; (3) regular
members (non-admins) cannot invite anyone.

PASS if all of these hold:
- Each of the three requirements is the subject of at least one acceptance criterion (`AC-n`) whose text
  says it: requirement 2 with the message and the fact that nothing is sent, requirement 3 with who may
  not invite. A criterion that only mentions the topic in passing does not count.
- Every such criterion names a user story that exists in the User stories section, for example
  `AC-4 (US-2)`.
- No criterion has a number that the brief does not contain (the 7 days is the only number).

FAIL if any of the three requirements has no acceptance criterion of its own, if a criterion names no
story or a story that does not exist, or if the spec invents a number.
