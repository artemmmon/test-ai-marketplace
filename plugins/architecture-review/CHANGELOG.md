# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-20

### Added

- `architecture-reviewer` agent: read-only audit of a module, a package or a branch diff against the
  `onion-architecture` and `frontend-architecture` skills of `engineering-paved-path`. Mechanical checks come
  from the optional `checks` input (empty by default); the result is one JSON object, with a `recheck:` mode for
  verifying fixes.
