---
type: llm
---

The reply must be the reviewer's JSON report (one JSON object with a `findings` array).

PASS if all of these hold:
- A finding reports the discount arithmetic written inline in `DiscountService.applyDiscount`
  (`src/modules/discounts/service.ts`) instead of in a domain file or a pure helper beside the service.
- That finding's `rule` names the onion-architecture placement rule for a business rule or calculation
  (domain file or a pure helper beside the service).
- That finding has severity WARNING, not CRITICAL.
- There is no separate finding about the boolean flag parameters or the magic numbers as such: they are
  code style, not a violation of a documented rule.

FAIL if the placement finding is missing, rated CRITICAL, has no documented rule, or if style-only
findings are reported.
