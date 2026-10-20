---
type: llm
---

PASS if the reply is a discovery report (questions and proposals, not a finished spec) and all of these
hold:
- Questions are numbered and each has numbered options (1/2/3, not A/B/C), with the recommended option
  first and marked as recommended.
- It asks about the vague words in the brief ("quick", "handle errors properly") by asking for a concrete
  value, instead of accepting them.
- Because the feature has a screen and no design source was given, it asks for a design (a link, a file or
  a screenshot) or says that screens will be inferred and lists what is undefined.
- It separates facts (seen in a source, or "user brief") from inferences or proposals, and says what it
  proposes but has not added to any spec.
- It does not claim to have written or approved a spec, and it does not set any status other than draft.

FAIL if the reply is a complete spec, if it claims a file was written, if it silently picks numbers for
"quick", or if it gives questions without options.
