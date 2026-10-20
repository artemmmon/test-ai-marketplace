---
name: security
description: Stack-independent application security rules - where attacker-controlled data enters, how to handle it, and how to rate a finding. Covers request input and access control, outbound HTTP (SSRF), SQL, child processes and file paths, secrets and logs, error responses, CI workflows and dependencies, and handling of LLM prompts and LLM output. Use whenever writing or reviewing code that handles request input, outbound HTTP calls, filesystem paths, shell or child processes, SQL, LLM prompts or LLM output, markdown/HTML rendering, secrets, logs, error responses, CI workflows or third-party dependencies, or when asked to review a change for vulnerabilities - even if the word "security" is never used. Not for general code quality or for architecture (see onion-architecture, frontend-architecture).
---

# Security

Decisions about **what an attacker can control and where it must be stopped**. Rules are
distilled from the sources listed at the end; `[S4]` marks source #4 there.

Read the project's own security notes first (`CLAUDE.md`, `AGENTS.md`, a `SECURITY.md`, if they
exist) and reuse the guards it already has (a safe-fetch helper, an input-validation layer, a
secrets provider) instead of writing a second one.

## The one question

**Can an attacker control this value, and which boundary does it cross next?** Trace it from where
it enters to where it is used before rating anything. `fetch(config.apiBase)` is safe;
`fetch(body.url)` is SSRF unless it goes through a guard.

## Where attacker-controlled data enters

| Source | Why it is untrusted | Reaches |
|---|---|---|
| HTTP requests: body, query, headers, cookies, path params, uploaded files | Anyone who can reach the port, or any web page in a user's browser | every route, SQL, fs, outbound calls |
| User-supplied URLs, webhooks, import links | Can point at internal hosts or cloud metadata | outbound HTTP |
| Third-party content: cloned repos, uploaded or downloaded files, scraped pages, issue/PR text | The author is the attacker | fs reads, command args, parsers, LLM prompts |
| LLM output | Steerable by any untrusted text in the prompt (prompt injection) [S3] | DB, UI markdown, links, commands, CI comments |
| Message-queue payloads, JSON columns, env set by users | Shape and origin not guaranteed | handlers, parsers |

Trusted: server config, constants, committed workflow files, secrets-manager values.

## Rules

1. **Validate input at the edge.** Parse every request with a schema (type, length, range, enum);
   reject unknown shapes; use the parsed value, not the raw one. *Why:* A05 Injection and A06
   Insecure Design start with unvalidated input [S1][S2].
2. **Every route resolves the caller and scopes by owner or tenant.** No object is returned or changed
   by id alone; check ownership or tenant before the read. *Why:* A01 Broken Access Control [S1].
3. **Outbound HTTP to a user-supplied URL goes through one guard.** Require https, resolve DNS and
   block private, loopback, link-local and metadata ranges at connect time, re-check every redirect,
   cap size and time. Never a bare `fetch` or SDK `baseURL` built from input. *Why:* SSRF and DNS
   rebinding [S4].
4. **SQL only through parameters.** Query builders and parameterised queries bind values; string
   concatenation, or raw-SQL helpers (`sql.raw`, `.unsafe()`, a template string passed to `query`) with input, are a finding.
   Identifiers (columns, sort order) come from an allowlist. *Why:* A05 [S6].
5. **Paths from outside stay inside their base directory after `realpath`.** Reject `..`, absolute
   paths and symlinks that resolve outside. *Why:* path traversal turns a file read into key theft [S10].
6. **No shell; end options before input.** Use `spawn`/`execFile` with argument arrays, never
   `exec` or `shell: true` with input. Put `--` before any value an attacker can start with `-`
   (some tools execute commands through options such as `--pre` or `--upload-pack`). *Why:* OS
   command injection [S8][S9][S11].
7. **Untrusted text enters an LLM prompt fenced and labelled as data**, and the system prompt states
   that fenced text is data, not instructions. Do not rely on keyword denylists. *Why:* fencing plus
   an explicit rule is the documented mitigation; filters are bypassable [S3][S5].
8. **LLM output is data, not instructions or markup.** Validate it with a schema, render it through a
   markdown renderer that does not allow raw HTML, never `innerHTML`/`dangerouslySetInnerHTML`, sanitise
   link schemes, and never let it choose a command, path, URL or SQL. Give agents the least privilege
   they need. *Why:* LLM05 Improper Output Handling, LLM06 Excessive Agency [S3][S20].
9. **Secrets come from a secrets manager or the environment**, never from source, the database, a
   response, a log line, or a variable inlined into the browser bundle (`NEXT_PUBLIC_*`, `VITE_*`).
   Map provider errors before they reach the client. *Why:* A04, secrets management [S13][S19].
10. **Error responses and logs don't leak internals.** Return a generic message for unexpected errors
    outside development; no stack traces, SQL, tokens, passwords, or full request bodies in logs.
    *Why:* A09 Logging failures, A10 Mishandling of Exceptional Conditions [S1][S14].
11. **Keep the network surface small.** Bind to localhost unless the service must be public; set an
    explicit CORS origin (never `*` with credentials or a reflected origin); keep security headers
    and rate limits on routes that mutate state or spend money (LLM calls). Trust proxy headers only
    behind a known proxy. *Why:* A02 Security Misconfiguration [S15][S16][S17][S18].
12. **CI stays read-only:** no `pull_request_target` with a checkout of the PR head, no secrets for PR
    jobs from forks, minimal `permissions`, third-party actions pinned to a commit SHA. *Why:* A03
    supply chain [S12].
13. **Dependencies:** commit lockfiles; review new packages and their install scripts; keep install
    scripts blocked unless the package cannot work without them. *Why:* A03 Software Supply Chain
    Failures [S1].

## Rating a finding

Report only what you traced.

| Confidence | You have | Report as |
|---|---|---|
| **High** | Vulnerable pattern + attacker-controlled input + a reachable path you can state | CRITICAL `security-vuln: <detail>`, naming the input that triggers it |
| **Medium** | Vulnerable pattern with an unclear input source, or a hardening rule above broken without a proven path | WARNING, "verify manually" |
| **Low** | Theoretical, or best practice with no path | Don't report |

**Don't flag:** test files and fixtures; server-controlled values (config, constants, committed
files); patterns the framework already mitigates (JSX escaping, parameter binding, markdown
renderer defaults); lines the change didn't touch.

## Workflow: reviewing a change (copy and tick off)

```
- [ ] 1. List what the diff touches: route, outbound call, fs/process, SQL, prompt, LLM output, rendering, secrets/logs, CI, deps
- [ ] 2. For each, find where its inputs come from (table above) - trusted or attacker-controlled?
- [ ] 3. Check the matching rule(s); reuse a guard the project already has
- [ ] 4. Rate with the table; a CRITICAL states the triggering input
- [ ] 5. Scan added lines for secrets (patterns below)
```

## Secret patterns (added lines)

| Type | Pattern |
|---|---|
| OpenAI / OpenRouter / Anthropic key | `sk-[A-Za-z0-9_-]{20,}` / `sk-or-[A-Za-z0-9_-]{20,}` / `sk-ant-[A-Za-z0-9_-]{20,}` |
| GitHub token | `gh[pousr]_[A-Za-z0-9]{36,}` / `github_pat_[A-Za-z0-9_]{50,}` |
| AWS key | `AKIA[0-9A-Z]{16}` |
| Private key | `-----BEGIN [A-Z ]*PRIVATE KEY-----` |
| Generic assignment | `(secret\|token\|password\|api_?key)\s*[:=]\s*['"][^'"]{8,}` |
| Database URL with password | `postgres(ql)?://[^:]+:[^@]+@`, `mysql://[^:]+:[^@]+@`, `mongodb(\+srv)?://[^:]+:[^@]+@` |

## Sources

[S1] OWASP Top 10:2025 https://top10.owasp.org/2025/ - [S2] OWASP ASVS https://owasp.org/www-project-application-security-verification-standard/ -
[S3] OWASP Top 10 for LLM Applications 2025 https://genai.owasp.org/llm-top-10/ - [S4] OWASP SSRF Prevention Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html - [S5] The Dual LLM pattern (S. Willison)
https://simonwillison.net/2023/Apr/25/dual-llm-pattern/ - [S6] OWASP SQL Injection Prevention Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html - [S8] OWASP OS Command Injection Defense Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html - [S9] Node.js child_process https://nodejs.org/api/child_process.html -
[S10] OWASP Path Traversal https://owasp.org/www-community/attacks/Path_Traversal - [S11] git(1) https://git-scm.com/docs/git -
[S12] GitHub Actions security hardening https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions -
[S13] OWASP Secrets Management Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html -
[S14] Fastify Errors https://fastify.dev/docs/latest/Reference/Errors/ - [S15] @fastify/helmet https://github.com/fastify/fastify-helmet -
[S16] @fastify/rate-limit https://github.com/fastify/fastify-rate-limit - [S17] @fastify/cors https://github.com/fastify/fastify-cors -
[S18] Fastify trustProxy https://fastify.dev/docs/latest/Reference/Server/#trustproxy - [S19] Next.js environment variables
https://nextjs.org/docs/app/guides/environment-variables - [S20] react-markdown security https://github.com/remarkjs/react-markdown#security

## Out of scope

- Where code lives and which way imports point: `onion-architecture`, `frontend-architecture`.
- Framework mechanics (plugins, hooks, performance) and query design: use the framework's or ORM's own skill.
- Logic bugs with no attacker: a correctness review.
