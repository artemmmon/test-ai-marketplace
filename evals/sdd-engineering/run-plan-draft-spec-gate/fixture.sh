#!/usr/bin/env bash
# A project with one draft spec that still has an unanswered open question.
set -euo pipefail
mkdir -p specs
cat > specs/10-report-rerun.md <<'MD'
# Spec: Report Re-run

Spec ID: SPEC-10
Status: draft
Supersedes: None.
Sources: user brief

## Problem and user

A user who sees a failed report has to start it again from the beginning.

## Goals / Non-goals

- Goal: a failed report can be started again from the report page.
- Non-goal: scheduling reports.

## User stories

- US-1: As a user, I want to re-generate a failed report from its page, so that I do not repeat the setup.

## Acceptance criteria (EARS)

- AC-1 (US-1): WHEN the user activates "Re-generate" on a failed report, the system shall start a new run of that report.
- AC-2 (US-1): WHILE a new run is in progress, the system shall keep showing the previous result.

## Edge cases

- EC-1: the previous result was deleted -> show an empty state (AC-2)

## Non-functional requirements

None.

## Inputs and provenance

| Input | Provenance | Notes |
|---|---|---|
| Report settings | [reused: stored report settings] | |

## Untrusted inputs

None.

## Open questions

- OQ-1: Should a failed run count against the daily report quota? - default if unanswered: yes
- OQ-2: How many times may a user re-generate the same report? - default if unanswered: unlimited
MD
