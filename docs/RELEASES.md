# Releases

How a plugin version is chosen, released and, if needed, rolled back. Contributors should read
[CONTRIBUTING.md](../CONTRIBUTING.md) first; this document covers only releases.

## How versions work here

- The version of a plugin lives in `plugins/<name>/.claude-plugin/plugin.json` (`version`) and nowhere else. The
  `marketplace.json` entry does not repeat it; Claude Code uses the `plugin.json` value first, and
  `claude plugin validate` reports a mismatch if both are set.
- Claude Code gives a user a new copy of a plugin only when its version changes. Pushing changes without bumping `version`
  means installed users never receive them. Every change to plugin content therefore needs a bump, including a README fix.
- A release is a commit on `main` plus a git tag `<plugin>--v<version>` (for example `research-tools--v1.0.0`) on the
  repository. Other plugins' dependency ranges (`^1.0.0`) resolve against these tags, and the catalog site builds its
  release list from the tags and the `CHANGELOG.md` files.
- `CHANGELOG.md` follows Keep a Changelog. Release headings are `## [x.y.z] - YYYY-MM-DD`; unfinished work sits under
  `## [Unreleased]` on top. The newest version in the changelog must equal `plugin.json` `version`
  (`check-marketplace.mjs` fails otherwise).

All four plugins are at `1.0.0` and each has its `--v1.0.0` tag on the remote.

## Semver rules for plugins

The spec fixes one rule (FR-37 in [docs/specs/sdd-plugins.md](specs/sdd-plugins.md)): a change that breaks scoped names,
`userConfig` keys, the agents' output JSON, or the spec or plan format is **major**. The list below applies that rule to
each kind of component; the rows marked "judgement" are guidance, not enforced by any check.

| Change | Bump |
|---|---|
| Remove or rename a skill, agent or command (its scoped name `plugin:name` changes) | major |
| Remove, rename or retype a `userConfig` key, or change what an existing value means | major |
| Change an agent's output JSON or the spec or plan format incompatibly (consumers such as `run-plan` read them) | major |
| Hook change that blocks something that was allowed, or removes a check, so a previously working run can fail or lose protection (judgement) | major |
| Add a skill, an agent, or a command | minor |
| Add an optional `userConfig` key with a built-in default, or an optional agent input | minor |
| Add a hook, or widen what one allows (judgement) | minor |
| Add fields to an agent's output JSON without changing existing ones (judgement) | minor |
| Raise the minimum Claude Code version in `COMPATIBILITY.md` (judgement) | minor |
| Fix wording, a bug in a script or a hook, a rule that was wrong; improve a skill's text without changing its contract | patch |
| Documentation-only change inside the plugin folder (README, COMPATIBILITY, CHANGELOG) | patch |
| Tighten or relax an agent's `tools` list | follow the effect: removing a tool an agent relied on is major, adding one is minor, and it is a security change either way (see [SECURITY.md](SECURITY.md)) |

Dependency ranges:

- A plugin declares `^<major>.<minor>.<patch>` of the version it was tested against. Minor and patch releases of a
  dependency are picked up automatically, so test them (evals) before tagging, but the dependent plugin does not need a
  release.
- A new major of a dependency is not matched by `^1.0.0`. Releasing it requires a new release of every dependent plugin
  with an extended range, after its evals pass (FR-38). The range edit is a minor release of the dependent when its own
  behaviour is unchanged, and a major when it is not.
- Raising the lower bound of a range (for example `^1.0.0` to `^1.2.0`) because the plugin needs a feature of the
  dependency is a minor release of the dependent (judgement).
- Do not release a plugin that depends on a changed dependency before that dependency's tag exists.

## Dependency order

```
sdd-engineering ──┬──> engineering-paved-path
                  ├──> research-tools
                  └──> architecture-review ──> engineering-paved-path
```

In words: `engineering-paved-path` and `research-tools` first (neither depends on anything), then
`architecture-review` (depends on `engineering-paved-path`), then `sdd-engineering` (depends on all three). Release and
tag only the plugins that changed, but always in this order.

## Release procedure

Example for one plugin; repeat the commit steps for each plugin in the order above (several plugins can share one pull
request or use one each).

1. **Branch from an up-to-date `main`**: `git switch main && git pull && git switch -c release/<plugin>-<version>`.
   Never commit to `main`.
2. **Bump the version** in `plugins/<name>/.claude-plugin/plugin.json`.
3. **Update the changelog** of that plugin: rename the content of `## [Unreleased]` to
   `## [<version>] - <today, YYYY-MM-DD>` and leave an empty `## [Unreleased]` on top. Group entries as `Added`,
   `Changed`, `Fixed`, `Removed`, `Security`. Write what a user notices, not the commit list.
4. **Update the other documents** of the plugin where they are affected: `README.md` (components, inputs, usage),
   `COMPATIBILITY.md` (minimum Claude Code version, dependency ranges, notes). Update the version in the plugin table of
   the root `README.md`, and the ranges in a dependent plugin's `plugin.json`, `COMPATIBILITY.md` and README if a range
   changes.
5. **Run the checks**: `npm test`, `node scripts/check-marketplace.mjs .`, `claude plugin validate .` and
   `claude plugin validate plugins/<name>`; run `node scripts/build-index.mjs` to confirm the release appears in the
   generated data. Run the plugin's evals if its behaviour changed (see [evals/README.md](../evals/README.md)).
6. **Commit and open a pull request into `main`**, for example `chore(<name>): release <version>`. CI runs the Validate
   and Pages workflows. Merge only when the maintainer asks for it.
7. **Tag after the merge**, from `main` at the merge commit, with a clean working tree. For each released plugin, in
   dependency order:
   ```sh
   git switch main && git pull
   claude plugin tag plugins/<name> --dry-run     # shows the tag name and what would happen
   claude plugin tag plugins/<name> --push        # creates <name>--v<version> and pushes it to origin
   ```
   `claude plugin tag` validates the plugin, checks that `plugin.json` and the marketplace entry agree, requires a clean
   tree under the plugin directory, and refuses if the tag already exists. Do not use `--force` on a tag that was already
   pushed; publish a new patch version instead.
8. **Check the tags**: `git ls-remote --tags origin` lists every `<plugin>--v<version>`, and
   `node scripts/check-marketplace.mjs . --require-tags` turns a missing dependency tag into an error.
9. **Run the Pages workflow by hand.** A tag push does not start any workflow (the tag trigger was removed from
   `pages.yml`), and the run that the merge started finished before the tag existed, so the catalog still lacks the
   release. Start it on `main`: Actions, Pages, Run workflow, or
   ```sh
   gh workflow run pages.yml --ref main
   ```
   The build job checks out the full history, generates `releases.json` from the changelogs and the tags, and the deploy
   job publishes the site. Open the site and confirm the release is listed.

Tag soon after the merge. Until the new tag exists, a range such as `^1.0.0` resolves to the highest tag that satisfies it,
which is still the previous release (resolution rule from the Claude Code dependency documentation; not tested here).

## Rollback

### Facts verified for this document

Checked with Claude Code 2.1.304, using a throw-away `CLAUDE_CONFIG_DIR` so that no real configuration was touched:

- `claude plugin install --help` lists no option to select a version or a tag. `claude plugin update --help` takes only a
  plugin name and updates it to the latest version. The install and update commands cannot pin a plugin by themselves.
- `claude plugin marketplace add artemmmon/test-ai-marketplace#research-tools--v1.0.0` clones the repository at that ref
  (`marketplace list` shows `artemmmon/test-ai-marketplace@research-tools--v1.0.0`), and
  `claude plugin install sdd-engineering@test-ai-marketplace` then installs `sdd-engineering` and its three dependencies at
  `1.0.0`.
- Adding the marketplace again with a different ref while it is registered is refused ("its source doesn't match its
  extraKnownMarketplaces entry"). `claude plugin marketplace remove test-ai-marketplace` removes the marketplace and
  uninstalls its plugins, including their saved options.

The `#<ref>` syntax (a branch or tag appended to a GitHub or git-URL marketplace) is also described in the Claude Code
documentation, "Hold users on one version".

### Pin a user to a previous release

Because every plugin in this marketplace has a relative-path source, its files come from the marketplace checkout, so
pinning the marketplace to a tag pins all plugins to the state of the repository at that tag.

```sh
claude plugin marketplace remove test-ai-marketplace      # also uninstalls its plugins and deletes their saved options
claude plugin marketplace add artemmmon/test-ai-marketplace#<plugin>--v<version>
claude plugin install <plugin>@test-ai-marketplace
```

Then set the `userConfig` values again if the plugin has any (`/plugin configure <plugin>@test-ai-marketplace`). To leave
the pin, remove the marketplace and add it again without `#<ref>`.

Not verified:

- Only `1.0.0` exists so far, so no real downgrade (for example from `1.1.0` to `1.0.0`) has been run.
- How dependencies resolve while the marketplace is pinned. By the Claude Code documentation a range resolves to the
  highest tag that satisfies it, so a pinned `sdd-engineering` may still receive a newer `1.x` of its dependencies.
- Loading a tagged checkout for one session (`git worktree add ../rollback <tag>` and `claude --plugin-dir ../rollback/plugins/<name>`)
  is documented by Claude Code for `--plugin-dir`, but was not run here.

### Roll back a bad release as the maintainer

- Do not delete or move a tag that users may have resolved. Claude Code decides what to install from the version, so the fix
  must be a new version.
- Revert the faulty change on a branch, bump to the next patch version (for example `1.0.1`), add a `### Fixed` or
  `### Security` entry to the changelog that says what was reverted, and release it with the procedure above.
- Releasing a fix to a dependency does not need a release of its dependents while the fix stays inside their range.
