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

`research-tools` and `architecture-review` are at `1.0.0`, `engineering-paved-path` is at `1.0.1`,
`sdd-engineering` is at `1.2.0`, and each released version has its `<plugin>--v<version>` tag on the remote.

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

A user is rolled back by pointing the marketplace at the tag of an earlier release (a **stable channel**, see below) and
updating the plugin. The tags are listed by `git ls-remote --tags origin`. Everything in this section was run against the
public repository; what was not run is listed under "Not verified".

### Facts verified

Checked with Claude Code 2.1.304 and again with 2.1.306 (the rehearsal below), always with a throw-away
`CLAUDE_CONFIG_DIR` and project directory, so that no real configuration was touched:

- `claude plugin install --help` lists no option to select a version or a tag, and `claude plugin update` takes only a
  plugin name. Neither command can pin a plugin by itself; the pin is the marketplace's `#<ref>`.
- `claude plugin marketplace add artemmmon/test-ai-marketplace#<tag>` clones the repository at that ref (`marketplace list`
  shows `artemmmon/test-ai-marketplace@<tag>`). Because every plugin here has a relative-path source, pinning the
  marketplace pins the plugin files to the state of the repository at that tag. The `#<ref>` syntax is also described in
  the Claude Code documentation, "Hold users on one version".
- Adding the marketplace again with another ref depends on the scope that declares it (2.1.306):
  - **user scope** (no `--scope`): refused with "its source doesn't match its extraKnownMarketplaces entry in user or
    managed settings". The marketplace has to be removed first.
  - **`--scope project`**: accepted. The command prints "Marketplace 'test-ai-marketplace' was already added from
    github:artemmmon/test-ai-marketplace and now points at github:artemmmon/test-ai-marketplace@sdd-engineering--v1.0.0",
    rewrites `extraKnownMarketplaces.test-ai-marketplace.source.ref` in `.claude/settings.json`, and keeps the installed
    plugins and their settings.
- `claude plugin marketplace remove test-ai-marketplace` uninstalls the marketplace's plugins and deletes their saved
  options and their data directory (see the rehearsal for the exact effect).

### Rehearsal: floating channel, rollback to 1.0.0, back to latest

Run on 2026-10-21 with Claude Code 2.1.306 against `main` at `e8a3ea9` (`sdd-engineering` 1.2.0 is the latest). The
profile was a new `CLAUDE_CONFIG_DIR` (a temporary directory, no login) and the project was an empty directory.
Every command below was run inside that project directory. The tag `sdd-engineering--v1.0.0` is the rollback target named by the lab (`1.1.1` is the one used in "Stable channel" below).

**1. Floating channel (latest).**

```sh
claude plugin marketplace add --scope project artemmmon/test-ai-marketplace
claude plugin install sdd-engineering@test-ai-marketplace --scope project
#  ✔ Successfully installed plugin: sdd-engineering@test-ai-marketplace (scope: project) (+ 3 dependencies: engineering-paved-path, research-tools, architecture-review)
claude plugin list --json     # sdd-engineering 1.2.0, engineering-paved-path 1.0.1, research-tools 1.0.0, architecture-review 1.0.0, all scope project, enabled
```

Then user data was created, to see whether it survives (see "Does user data survive?" below):
`echo '{"specs_dir":"my-specs","plans_dir":"my-plans"}' | claude plugin configure sdd-engineering@test-ai-marketplace --values-stdin`
and a marker file `$P/plugins/data/sdd-engineering-test-ai-marketplace/marker.txt`.

**2. Roll back to 1.0.0, in place.**

```sh
claude plugin marketplace add --scope project 'artemmmon/test-ai-marketplace#sdd-engineering--v1.0.0'
#  ✔ Successfully added marketplace: test-ai-marketplace (declared in project settings)
#    Marketplace 'test-ai-marketplace' was already added from github:artemmmon/test-ai-marketplace and now points at github:artemmmon/test-ai-marketplace@sdd-engineering--v1.0.0.
claude plugin update sdd-engineering@test-ai-marketplace --scope project
#  ✔ Plugin "sdd-engineering" updated from 1.2.0 to 1.0.0 for scope project (...). Restart to apply changes.
```

Right after the `marketplace add`, and before the `update`, `plugin list` still showed `sdd-engineering` `1.2.0`: the `add`
only moves the source, the `update` is what changes the installed version. After the `update`, `claude plugin list --json`
showed `sdd-engineering` `1.0.0` (git commit `3083073`, the commit of the tag), `research-tools` `1.0.0`,
`architecture-review` `1.0.0` and `engineering-paved-path` `1.0.1`, all enabled at scope `project`. `claude plugin list`
printed "Status: ✔ enabled" for each, and the JSON output contains no "error" (the command has no
separate error field, so "no errors" here means exactly that, plus the exit code 0 of every command). `.claude/settings.json` had
`"ref": "sdd-engineering--v1.0.0"` and `marketplace list` showed `artemmmon/test-ai-marketplace@sdd-engineering--v1.0.0`.
The installed files in `$P/plugins/cache/test-ai-marketplace/sdd-engineering/1.0.0` are identical to the plugin directory of
a checkout of the tag (`diff -r` reports only the `.in_use` marker that Claude Code adds).

**3. Dependencies.** The `update` touched only `sdd-engineering`. `engineering-paved-path` stayed at `1.0.1` (the version
the floating channel had installed; `^1.0.0` is satisfied by it), so this in-place rollback gives `sdd-engineering` `1.0.0`
with a newer dependency than the tag shipped with. A fresh install on the pinned marketplace behaves differently:
after `marketplace remove`, adding `...#sdd-engineering--v1.0.0` and `plugin install sdd-engineering@test-ai-marketplace
--scope project`, all four plugins were `1.0.0`, although the tag `engineering-paved-path--v1.0.1` exists and satisfies
the range. So in this rehearsal a new install on a pinned marketplace took the dependencies from the pinned
checkout, not from the newest matching tag. Choose the in-place way to keep the project's settings and options, and the
remove way to get exactly the versions of the tag.

**4. Back to latest.**

```sh
claude plugin marketplace add --scope project artemmmon/test-ai-marketplace
#    Marketplace ... was already added from github:artemmmon/test-ai-marketplace@sdd-engineering--v1.0.0 and now points at github:artemmmon/test-ai-marketplace.
claude plugin update sdd-engineering@test-ai-marketplace --scope project
#  ✔ Plugin "sdd-engineering" updated from 1.0.0 to 1.2.0 for scope project (...)
```

`plugin list --json` showed `sdd-engineering` `1.2.0` again and `.claude/settings.json` had no `ref`.

**5. Promotion and rollback between two tags**, in place, with the same two commands each time (starting from a
fresh install pinned to 1.0.0, with all four plugins at 1.0.0): pinning to `#sdd-engineering--v1.1.1` and updating gave
`sdd-engineering` `1.0.0` to `1.1.1`; pinning back to `#sdd-engineering--v1.0.0` and updating gave `1.1.1` to `1.0.0`.
The dependencies stayed at `1.0.0` in both steps.

### Does user data survive?

The lab asks that a rollback does not make the user lose plugin data. There are two places, and they behave differently:

| What | Where (in the profile) | In-place rollback (steps 2 to 5) | `marketplace remove` + add + install |
|---|---|---|---|
| `userConfig` values of `sdd-engineering` | `settings.json`, key `pluginConfigs."sdd-engineering@test-ai-marketplace".options` (`specs_dir`, `plans_dir`, ...) | **kept**. `plugin configure ... --json` still showed `specs_dir: my-specs`, `plans_dir: my-plans` after the rollback and after returning to latest | **deleted**. The key became `"pluginConfigs": {}`, and after the reinstall `plugin configure` said "not set" for every option; the values must be entered again |
| Plugin data directory `${CLAUDE_PLUGIN_DATA}` | `plugins/data/<plugin>-<marketplace>/` | **kept** (the marker file was still there after each step) | **deleted** (the directory was empty after the remove; the output says "The removal also deletes their saved options, secrets and data where it can") |
| The project's own files (`specs/`, `docs/plans/`, ...) | the repository | not touched by any command here | not touched |

Limits of this check: `sdd-engineering` and the other three plugins do not use `${CLAUDE_PLUGIN_DATA}` (there is no
reference to it in `plugins/`), so the data directory did not exist until the marker file was written by hand, and no
real plugin data was tested. That the marker file was removed by `marketplace remove` shows that the path is the
plugin's data directory; whether a plugin that writes there loses the content in the same way was not run. To keep the
data in a remove-based rollback, write down the `userConfig` values first (`claude plugin configure <plugin> --json`), and
set them again with `--values-stdin` after the install; `claude plugin uninstall --keep-data` exists for a single plugin
but was not tried together with `marketplace remove`.

### Pin a user to a previous release

Two ways. The first is the one to prefer: it keeps the options and the data of the user.

```sh
# 1. In place, project scope (the marketplace is already declared in .claude/settings.json)
claude plugin marketplace add --scope project 'artemmmon/test-ai-marketplace#<plugin>--v<version>'
claude plugin update <plugin>@test-ai-marketplace --scope project
# restart Claude Code to apply

# 2. Clean, or when the marketplace is declared at user scope (the add of a new ref is refused there)
claude plugin marketplace remove test-ai-marketplace      # also uninstalls its plugins and deletes their saved options and data
claude plugin marketplace add artemmmon/test-ai-marketplace#<plugin>--v<version>
claude plugin install <plugin>@test-ai-marketplace
```

After the second way set the `userConfig` values again (`/plugin configure <plugin>@test-ai-marketplace`). To leave the
pin, run the same commands with the repository name and no `#<ref>`.

### Stable channel

A team that wants new releases only after it has checked them keeps its project on a **stable channel**: the marketplace
pinned to the tag of the last verified release, declared in the project's settings so that everyone who opens the
project gets the same versions. Moving the pin to a newer tag is the promotion; moving it back to an older tag is the
rollback. Rehearse both once before relying on them (done, see the rehearsal above).

The tag to pin today is `sdd-engineering--v1.1.1`. It is the best-supported choice, not a verified-green one: on the
smoke eval (two cases) its deterministic graders passed in every run and the `criteria` judge passed 3 of 3 (gate) and
6 of 8 (discovery) runs; no tag passes every run. The evidence, the reasons for 1.1.1 over 1.0.0 and 1.2.0, and what is
still weak are under "Smoke eval after the rollback" below.

```sh
# in the project, once: declare the marketplace pinned, then install
claude plugin marketplace add --scope project 'artemmmon/test-ai-marketplace#sdd-engineering--v1.1.1'
claude plugin install sdd-engineering@test-ai-marketplace --scope project
git add .claude/settings.json && git commit -m "chore: pin the marketplace to sdd-engineering--v1.1.1"
```

`--scope project` writes the pin to `.claude/settings.json` (`extraKnownMarketplaces.test-ai-marketplace.source.ref`) and
enables the plugins there, so the commit is the record of what the team runs. To promote or to roll back, run the `add` with
the other `#<tag>` and `claude plugin update <plugin>@test-ai-marketplace --scope project` (in-place way above), then commit
the changed `ref`. The rehearsal ran only one profile, so how a
second profile picks up a changed `ref` (a restart, `marketplace update`, a trust prompt) was not run.

Verified with Claude Code 2.1.304 and a throw-away `CLAUDE_CONFIG_DIR` and project directory: the command above creates
exactly that `ref` entry, `claude plugin list` then shows `sdd-engineering` `1.1.1` at scope `project` (with the
dependencies `engineering-paved-path` `1.0.1`, `research-tools` `1.0.0`, `architecture-review` `1.0.0`), and
`marketplace list` shows `artemmmon/test-ai-marketplace@sdd-engineering--v1.1.1`. The 2.1.306 rehearsal above repeated
the pin at `--v1.0.0` and `--v1.1.1` and moved between them.

Not possible, and not verified beyond that:

- **A second marketplace name for the stable channel.** `claude plugin marketplace add` has no option to choose a local
  name; the name is the `name` field of the repository's `marketplace.json` (`test-ai-marketplace`). Adding the same
  repository again, with or without a ref, replaces the earlier entry ("was already added ... and now points at ..."), so a
  pinned and a floating copy cannot be registered side by side under this name. A separate name would need a fork or a
  second repository with another `marketplace.json` `name`; this was not tried.
- Whether a teammate whose user-scope settings declare the same marketplace unpinned wins over the project's pin (the
  scopes were not compared here). Tell the team to keep only the project entry.

### Smoke eval after the rollback

The eval cases load plugins from the working tree (`plugins: ["../../../plugins/..."]` in each `prompt.md`), never from
the installed copy under `~/.claude/plugins`. So an eval started in this repository tests `main`, not the rolled-back
plugin. To run it against the rolled-back content, check the tag out into a scratch directory outside the repository and
run the eval there:

```sh
git worktree add --detach <scratch>/rollback sdd-engineering--v1.0.0
cd <scratch>/rollback
claude plugin eval . --tag sdd-engineering --scaffold --model sonnet --trust-plugin --no-publish \
  --case spec-creator-discovery-pass --runs 1 --ablation none --max-cost-usd 2
cd - && git worktree remove --force <scratch>/rollback
```

The tag contains the eval cases as they were at the release. At `sdd-engineering--v1.0.0` four `sdd-engineering` cases
exist (`spec-creator-discovery-pass`, `spec-ears-from-vague-brief`, `run-plan-draft-spec-gate`,
`workflow-retro-keep-concurrency`); the later ones (`spec-every-story-has-criterion`, the `negative-*` case) do not. The
files of the two cases run below are byte-identical to the ones on `main`. The eval ran in the normal logged-in profile
(the throw-away profile has no login), with Claude Code 2.1.306, `--model sonnet` and the default judge.
The run loaded `sdd-engineering` `1.0.0` and the other three plugins at `1.0.0` from the tag checkout (the eval output
prints "Plugin under test ... version 1.0.0").

| Plugin content | Case | Runs | Result |
|---|---|---|---|
| tag `sdd-engineering--v1.0.0` | `spec-creator-discovery-pass` | 3 (1, then 2) | **1 of 3 passed**. The two failures: the `criteria` judge voted FAIL FAIL FAIL (0.67); the pass had one FAIL vote of three. `dispatched-spec-creator` and `no-spec-written` passed every time |
| tag `sdd-engineering--v1.0.0` | `run-plan-draft-spec-gate` | 4 (1, then 3) | **2 of 4 passed**. The failures: `criteria` FAIL FAIL FAIL (0.50); `no-later-stage-started` passed every time |
| `main` (`sdd-engineering` 1.2.0) | `spec-creator-discovery-pass` | 1 | pass (1.00) |
| `main` (`sdd-engineering` 1.2.0) | `run-plan-draft-spec-gate` | 1 | pass (1.00) |

Cost: about 1.8 USD at the CLI's list-price estimate, from the subscription usage (see [evals/README.md](../evals/README.md)).
Only the `criteria` judge failed on the tag: the agent was dispatched and no spec file was written in every run.

#### Smoke tier: deterministic graders on the rolled-back 1.0.0 (2026-10-21)

The two cases above are judged by an `llm` grader (`criteria`) that fails a sound reply on one literal bullet, so they
cannot be a green/red gate (see below). The smoke tier is the part of those cases that does not depend on a judge:
two cases tagged `smoke`, with only `tool_used` and `file_exists` graders, copied from the originals without `criteria.md`.

| Case (tag `smoke`) | Graders | What a pass means |
|---|---|---|
| `smoke-discovery-dispatch` | `dispatched-spec-creator` (`tool_used`), `no-spec-written` (`file_exists`, `**/*.md` absent) | the plugin set loads, the `spec-creator` agent is dispatched for pass 1 and writes no file |
| `smoke-run-plan-draft-gate` | `no-later-stage-started` (`tool_used`, 0 calls) | `run-plan` on a draft spec starts no brainstorm, planner, implementer, verifier or reviewer |

Run against the tag, from a scratch checkout outside the repository (the cases are copied in, because the tag predates them):

```sh
git worktree add --detach <scratch>/rollback sdd-engineering--v1.0.0
cp -R evals/sdd-engineering/smoke-* <scratch>/rollback/evals/sdd-engineering/
cd <scratch>/rollback
claude plugin eval . --tag smoke --scaffold --model sonnet --trust-plugin --no-publish --ablation none --runs 3 --max-cost-usd 3
```

Result (Claude Code 2.1.306, `--model sonnet`, the eval printed all four plugins at version `1.0.0`):

| Case | Runs | Passed | Cost |
|---|---|---|---|
| `smoke-discovery-dispatch` | 3 | **3 of 3** (both graders in every run) | about 0.93 USD |
| `smoke-run-plan-draft-gate` | 3 | **3 of 3** | about 0.24 USD |
| total | 6 | **6 of 6, score 1.00** | about 1.2 USD at list price |

What this does and does not say, plainly:

- **It is a smoke result, not a quality result.** It shows that the rolled-back tag loads, dispatches its agent and
  keeps its gate. It does not show that the replies are good: that is what the `criteria` judge cases measure, and
  they stay as reported below (1 of 4 and 2 of 5 on 1.0.0; a flake rate of about one run in four on 1.1.1 and 1.2.0).
- `smoke-run-plan-draft-gate` checks that something did not happen, so on its own it would also pass without the
  plugin. The plugin-loaded evidence is `smoke-discovery-dispatch` (the agent exists only through the plugin).
- The cases were derived from the two judge cases after their judge failures were analysed; the deterministic graders
  were not changed and had passed in every earlier run of every tag.
- The run printed two load errors for files under `scripts/__fixtures__/` (test fixtures, not eval cases); the two
  smoke cases ran normally.

#### The new behaviour of 1.1.0: `engineering-insights` eval (2026-10-21)

1.1.0 added the `engineering-insights` skill and made `implementer` and `implementation-planner` follow it (CHANGELOG).
No eval covered it, so one was added: `engineering-insights-records-finding`. The agent is told about a float-rounding
quirk in `src/modules/billing/rounding.ts` and asked, without fixing the code, to record it with the skill in a project
that has no `INSIGHTS.md`. All graders are deterministic (no judge):

| Grader | Type | Passes when |
|---|---|---|
| `skill-loaded` | `tool_used` | the `Skill` tool is called with `engineering-insights` |
| `insights-file-created` | `file_exists` | `src/modules/billing/INSIGHTS.md` exists (the module folder, by the skill's "most specific wins" rule) |
| `built-from-template` | `regex` on the file | the template heading `## Open Questions` is there |
| `entry-is-dated` | `regex` on the file | an entry heading `### YYYY-MM-DD — title` is there |
| `entry-is-anchored` | `regex` on the file | the entry has `Where: ...rounding.ts:<line>` |
| `code-not-changed` | `regex` on `rounding.ts` | the code was not touched |

Run from a scratch checkout of each tag, with the case copied in (the tags predate it), `--allow-tools Write Edit`
because the case writes a file:

```sh
git worktree add --detach <scratch>/wt sdd-engineering--v1.1.0   # and again with --v1.0.0
cp -R evals/sdd-engineering/engineering-insights-records-finding <scratch>/wt/evals/sdd-engineering/
cd <scratch>/wt
claude plugin eval . --case engineering-insights-records-finding --scaffold --allow-tools Write Edit \
  --model sonnet --trust-plugin --no-publish --ablation none --runs 3 --max-cost-usd 3
```

| Tag | Runs | Passed | Cost |
|---|---|---|---|
| `sdd-engineering--v1.1.0` | 3 | **3 of 3** (score 1.00 each) | about 0.19 USD |
| `sdd-engineering--v1.0.0` | 3 | **0 of 3** (score 0.33 each) | about 0.12 USD |

- The new behaviour passes on 1.1.0, and the same case fails on 1.0.0, where the skill does not exist: the eval measures
  what 1.1.0 added.
- On 1.0.0 `skill-loaded` and `code-not-changed` still pass (the agent tried to call the missing skill and left the code
  alone); the four graders about the written file fail. A passing `skill-loaded` therefore does not mean the skill ran.
- Weak evidence, said plainly: one case, one model (`sonnet`), 3 runs per tag, written after the release and
  after reading the skill's own rules, not before. It checks the file the skill must produce, not whether a session
  finds a finding worth recording on its own (the skill says Claude loads it proactively; this case asks for it by name).
- Cost: the 1.1.0 and 1.0.0 runs together about 0.31 USD at list price.

#### Why the judge failed on 1.0.0 (analysed 2026-10-21)

The two cases were run again on a detached checkout of the tag (`--runs 1 --ablation none`, otherwise the same command)
and failed again: `spec-creator-discovery-pass` 0.67 (judge FAIL FAIL FAIL, about 0.37 USD) and
`run-plan-draft-spec-gate` 0.50 (FAIL FAIL FAIL, about 0.08 USD). With the earlier runs that is **1 of 4** and **2 of 5**
passing. The result file keeps only the votes and the agent's reply, not the judge's reasons, so the reasons were
reproduced by giving the same `criteria.md` and the same two replies to the same default judge (`haiku`), asking for a
verdict per bullet. The verdicts were FAIL, as in the run, and named these bullets:

| Case | Bullet of `criteria.md` that decided | What the reply did |
|---|---|---|
| `run-plan-draft-spec-gate` | "It names the next stage after approval: brainstorm, with the spec path" | The reply stopped correctly, asked for approval, surfaced OQ-1 and OQ-2 and the design source, and wrote nothing. But "brainstorm" appears only in "I can't go on to brainstorm or the plan yet"; it never says that brainstorm follows approval. Judge: "Brainstorm appears only as something it 'can't go on to... yet.'" |
| `spec-creator-discovery-pass` | "Questions are numbered and each has numbered options" and the FAIL line "gives questions without options" | Questions 1-8 and 10 have options with the recommended one first. Question 9 says "No options. Please name them", and questions 11 ("Which proposals do you accept?") and 12 ("Can you share a design?") have none. Judge: "Question 9 says 'No options', and Questions 11 and 12 have no numbered options." (A second bullet, a concrete value for "handle errors properly", was also marked not met by the judge in that reply.) |

So the replies are sound discovery and gate replies, and the judge fails them on one literal bullet each. The gate
replies that passed on 1.1.1 (two were read) say the same thing as the failing one, plus a clause such as "I'll set `Status:
approved` and go on to brainstorm" (the failing reply offers option 2 "Approve the spec as it is" but does not name the stage).

**Conclusion: the 1.0.0 contract does not lack what the criteria demand; it is run-to-run variation of the agent's reply
that the judge scores literally.** Evidence:

- The text that governs these two replies is the same in 1.0.0 and 1.2.0. `git diff sdd-engineering--v1.0.0
  sdd-engineering--v1.2.0` changes in `spec-creator.md` only pass 2 (criteria rules, coverage pass, the "Brief coverage"
  table) and in `run-plan/SKILL.md` only the sentence about tests after the run ends. The discovery rule ("Give each
  question numbered options (1/2/3, never A/B/C) with your recommended one first and marked") and the report template
  are identical, and nothing in `run-plan` about the draft gate changed. 1.1.1's rules (one `shall`, no invented numbers)
  and 1.2.0's coverage pass concern the written spec, not the discovery questions or the gate reply.
- The discovery case is just as unstable on the later tags, with the same text: 1.1.1 passed 3 of 3 and then 3 of 5,
  1.2.0 passed 1 of 3 and then 5 of 5 (table below). The tag with the better first batch was the worse second one.
- The judge is consistent on a given reply (it fails the replies above every time it is asked) but reply-to-reply it
  moves with small differences: single votes of FAIL appear in runs that passed (`PASS FAIL PASS`), and a 1.2.0 reply
  was failed (`FAIL PASS FAIL`) because it never said that the proposals are not in any spec yet, a different bullet.
  A criterion that asks for five things at once, with a strict judge, passes a reply only if all five appear in that run.
- Not explained: the gate case failed 3 of 5 on 1.0.0 and 0 of 6 on 1.1.1 and 1.2.0 (Fisher exact, one-sided, about
  0.06). That is suggestive but not significant at these sizes, and no change in the 1.0.0 to 1.1.1 diff addresses the
  gate reply; the added skill and files of 1.1.0 could shift how the model words it. Treat "1.0.0 is worse on the gate"
  as unproven, not as ruled out.

A fix, if the cases are to be a gate, belongs in the case or the contract, not in the tag. For discovery: tell
`spec-creator` that the closing questions (accept the proposals, share a design) also carry numbered options, or let
`criteria.md` allow a free-text question. For the gate: make `run-plan` say explicitly that brainstorm follows approval.
Neither was changed here (this change touches documentation only).

#### The same smoke eval on the later tags (2026-10-21)

Same command as above (`--tag sdd-engineering --scaffold --model sonnet --trust-plugin --no-publish --ablation none`,
Claude Code 2.1.306, default judge), run from a detached checkout of each tag; `--runs 3` first, then more runs of the
discovery case, because it differed between the tags and the two batches ordered them the other way round. A run counts as
passed when it scores 1.00 (the `criteria` judge decides by majority of three votes). In every run of every tag the
deterministic graders (`dispatched-spec-creator`, `no-spec-written`, `no-later-stage-started`) passed.

| Tag (`sdd-engineering`, with `engineering-paved-path` 1.0.1 from 1.1.1 on) | `spec-creator-discovery-pass` | `run-plan-draft-spec-gate` | Cost |
|---|---|---|---|
| `sdd-engineering--v1.0.0` | 1 of 4 (earlier 1 of 3, now 0 of 1) | 2 of 5 (earlier 2 of 4, now 0 of 1) | about 1.8 + 0.45 USD |
| `sdd-engineering--v1.1.1` | **6 of 8** (3 of 3, then 3 of 5) | **3 of 3** | about 2.8 USD |
| `sdd-engineering--v1.2.0` (the plugin files of `main` are identical to this tag) | **6 of 8** (1 of 3, then 5 of 5) | **3 of 3** | about 2.8 USD |

In the 1.1.1 and 1.2.0 runs that failed, the votes were `FAIL PASS FAIL`, `FAIL FAIL FAIL`, `PASS FAIL FAIL` and
`FAIL PASS FAIL` on the `criteria` grader; nothing else failed. The whole session cost about 6 USD at list price
(0.45 for the 1.0.0 rerun, 2.8 each for the two later tags, the haiku re-judging not counted).

**No tag gives a judged eval that is green in every run** (the deterministic smoke tier above is green on 1.0.0). Counting every run, discovery passed in 6 of 8 on both
later tags, and 1.0.0 is below them on both cases. Nobody should write "the smoke eval is green" for any pin on this
evidence; the accurate statement is "the deterministic graders pass in every run and the `criteria` judge passes
about three of four runs on 1.1.1 and 1.2.0".

#### Which tag the stable channel should pin

Pin **`sdd-engineering--v1.1.1`** (the example in "Stable channel" above). Why:

- It is the oldest tag that carries the fix of the one failure of `spec-ears-from-vague-brief` that is documented
  (`evals/README.md`: 1 of 4 on 1.0.0, then 4 of 4 and 1 of 1 on 1.1.1 and later). 1.0.0 does not have it.
- On the two cases above it is as good as 1.2.0 (3 of 3 on the gate, 6 of 8 on discovery) and not worse than anything older.
- A stable channel is meant to lag behind the latest release; 1.2.0 is the floating channel's version. Its extra
  content (the coverage pass and the "Brief coverage" table) was checked only by `spec-every-story-has-criterion`, which
  does not exist on 1.1.1 (and fails there by design), so there is no reason to prefer it on these cases.
- The pin was installed and listed in the rehearsal above (`sdd-engineering` 1.1.1 with its three dependencies).

Weak evidence, said plainly: this is two cases of the seven `sdd-engineering` has, on one model and one judge, with 3 to 8
runs per tag. The initial gate (every case, 3 runs, score 1.0) was not run for any tag. `workflow-retro-keep-concurrency`,
`spec-every-story-has-criterion`, the `negative-*` cases and the other three plugins' cases were not run on 1.1.1 in this
check. The 6 of 8 on discovery is a measured flake rate of about one run in four, not a pass; do not read 1.1.1 as
"verified green". If the team requires every run to pass, it has nothing to pin until the case or the contract is fixed
as described above and the case reruns green with enough runs.

What this smoke eval proves and what it does not:

- It proves that the files of the tag `sdd-engineering--v1.0.0` load as a plugin set in `claude plugin eval`, that the
  agent can be dispatched, and what the two cases score on them. Since the installed copy at `1.0.0` equals the tag's plugin
  directory (the `diff -r` above), the result describes the rolled-back content, but it was not read from the installed copy.
- It does not test the installed copy or the project's settings (a different path), a running session after the restart,
  the user's `userConfig`, or the dependencies as installed by the in-place rollback (`engineering-paved-path` `1.0.1`; the
  eval loaded `1.0.0` of it from the tag).
- Two to four runs of two cases are weak evidence. 1.0.0 is not a "verified release" in the sense of a clean eval: the
  initial gate of `evals/README.md` (every case, 3 runs, score 1.0) was never run for it, and these two cases are flaky on
  it. Whoever relies on a stable channel pinned to an older tag has to decide which cases must pass there, and run them
  with enough runs to see the flakiness (`--runs 3` was not enough: the discovery case went from 3 of 3 to 3 of 5 on 1.1.1).
  The same holds for 1.1.1, the recommended pin: it is the best-supported choice, not a clean one.

### Not verified

- A running session after the rollback: the check ended at `plugin list`, the settings file and the cache directory. No
  interactive Claude Code session was started after the restart, so that the session really loads the `1.0.0` skills and
  agents was not observed.
- Plugin data of a plugin that really writes to `${CLAUDE_PLUGIN_DATA}` (none of the four does), and `--keep-data`.
- Whether a second profile or a teammate picks up a changed `ref` committed in `.claude/settings.json`.
- Loading a tagged checkout for one session (`git worktree add ../rollback <tag>` and `claude --plugin-dir ../rollback/plugins/<name>`)
  is documented by Claude Code for `--plugin-dir`, but was not run here; the smoke eval above uses `claude plugin eval` on
  the checkout instead.
- The judge's own reasons for the 1.0.0 runs: the result files keep only the votes. The reasons in "Why the judge failed
  on 1.0.0" come from re-judging the saved replies with the same judge model, not from the votes of the run. Whether 1.0.0
  is really worse than 1.1.1 on the draft-spec gate (3 of 5 failed against 0 of 6) is unresolved; the discovery case is
  flaky on every tag tried, 1.2.0 included.
- Dependency resolution when a newer `1.x` of a dependency is released after the pin was set, for an install made later: the
  rehearsal saw `engineering-paved-path` `1.0.1` kept by an in-place update and `1.0.0` taken by a fresh install, with the
  tag `engineering-paved-path--v1.0.1` present in both cases. By the Claude Code documentation a range resolves to the
  highest tag that satisfies it; the fresh install did not.

### Roll back a bad release as the maintainer

- Do not delete or move a tag that users may have resolved. Claude Code decides what to install from the version, so the fix
  must be a new version.
- Revert the faulty change on a branch, bump to the next patch version (for example `1.0.1`), add a `### Fixed` or
  `### Security` entry to the changelog that says what was reverted, and release it with the procedure above.
- Releasing a fix to a dependency does not need a release of its dependents while the fix stays inside their range.
