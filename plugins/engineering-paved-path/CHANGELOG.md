# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.1] - 2026-10-20

### Fixed

- Skill `security`: the `description` now names the cases where it must trigger on a review of a change that
  renders LLM-generated or other untrusted text as markdown or HTML (`rehype-raw`, `dangerouslySetInnerHTML`,
  `innerHTML`, a markdown renderer with raw HTML enabled) and prompt injection that turns into XSS. Before,
  the skill was not called for "review this React change" and the finding was rated below CRITICAL.
- Skill `security`: rule 8 and the rating table now say that raw HTML on LLM-influenced or user-written text is
  CRITICAL stored XSS, that "High" in the table is a confidence level and not a severity, and that each finding
  names the rule it breaks (number, name and OWASP id).

## [1.0.0] - 2026-10-20

### Added

- `fastify-best-practices` skill, vendored from `mcollina/skills` (MIT) with its `LICENSE`.
- `onion-architecture` skill with an example `dependency-cruiser.cjs` config and references.
- `frontend-architecture` skill (React + Next.js App Router) with six topic references.
- `security` skill: stack-independent security rules and a finding-rating scale.
- `react-best-practices` skill: React component, hook and state rules with severity levels.
- `next-best-practices` skill: Next.js App Router conventions, with 19 reference files.
- `react-testing-library` skill: React Testing Library + Vitest guide.

### Licensing

- `next-best-practices`, `react-best-practices` and `react-testing-library` are included without a confirmed
  upstream license, for test and lab use only. They are not covered by the plugin's MIT license, each has a
  `LICENSE-NOTICE.md`, and they will be removed on request of the rights holder (see README, Licensing notice).

### Documentation

- README with the skill table, usage examples, the example architecture check and the licensing notice.
