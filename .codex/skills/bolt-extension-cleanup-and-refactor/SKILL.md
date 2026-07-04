---
name: bolt-extension-cleanup-and-refactor
description: Use in bolt-to-github when asked to clean up, simplify, or refactor this deployed Chrome MV3 extension without changing behavior. Audits dead code, duplication, long services/components, weak test seams, stale TODOs, oversized fixtures, and brownfield MAID gaps; produces a confirmed cleanup backlog and optional draft MAID manifests for safe-refactor work. Specialized for Svelte, TypeScript, Chrome extension service workers/content scripts, GitHub sync/auth flows, and bolt.new DOM integration.
---

# Bolt Extension Cleanup And Refactor

Use this skill in `/home/atomrem/projects/codefrost-dev/bolt-to-github` for a
planning-grade cleanup pass. This extension is deployed and used by real users,
so cleanup must preserve behavior, storage contracts, permissions, auth flows,
sync semantics, and bolt.new integration.

This skill plans cleanup work. It does not implement code changes unless the
user explicitly asks to implement a selected item afterward.

## Coordination

- Use `safe-refactor` for behavior-preserving implementation.
- Use `maid-planner` for new cleanup manifests and `maid-evolver` when a file
  already has an active manifest contract.
- Use `maid-implementation-review` after MAID-backed implementation.
- Use `fix-bolt-selectors` instead when the user specifically reports broken
  bolt.new selectors or missing Push to GitHub / Download behavior.

## Production Safety Contract

Every proposed cleanup must keep these invariants:

- MV3 service worker lifecycle remains resilient to suspend/reload.
- Chrome storage keys, project IDs, premium state, and migration behavior stay
  backward compatible.
- GitHub PAT and GitHub App auth behavior does not regress.
- Supabase/session handling does not silently share or lose sessions.
- Network, sync, and degraded auth states remain visible in UI or logs.
- Extension permissions in `manifest.json` are not expanded during cleanup.
- Existing bolt.new selector fallbacks are not removed.
- Tests characterize behavior before restructuring touched files.

## Start

1. Check branch and dirty worktree:

```bash
git status --short --branch --untracked-files=all
```

Work around unrelated changes. Do not revert user work.

2. Read current guidance and test rules:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/unit-testing-rules.md`
- `docs/component-testing-rules.md`
- `docs/integration-testing-gaps.md`
- `manifests/README.md`

3. Inventory high-leverage cleanup surfaces:

```bash
find src -name '*.ts' -o -name '*.svelte' | xargs wc -l | sort -n | tail -30
rg -n "TODO|FIXME|XXX|HACK|eslint-disable|@ts-ignore|@ts-expect-error|\\bany\\b" src docs
rg -n "setTimeout|setInterval|addEventListener|chrome\\.runtime\\.on|chrome\\.storage" src
pnpm maid:files
```

Expect `pnpm maid:files` to report brownfield undeclared files. Use that output
to prioritize incremental MAID coverage, not as a failure by itself.

## Audit Targets

Prefer confirmed evidence over broad impressions. Good cleanup categories:

- long classes or components that mix UI, policy, storage, and network work;
- duplicated Chrome mock setup, GitHub API response fixtures, or auth setup;
- repeated error mapping or retry/rate-limit handling;
- content-script managers that create listeners or timers without clear cleanup;
- service-worker state split across multiple modules without obvious ownership;
- stores or components that can be characterized before extraction;
- stale comments or debug-only tests such as noisy zip debugging;
- overly broad mocks where project-owned fakes would be clearer;
- files touched by current work that lack active MAID coverage.

For each confirmed target, record:

- file path and symbol/component;
- observed smell, using refactoring vocabulary where useful;
- current tests that protect behavior, or characterization tests needed first;
- user-visible or extension-lifecycle risk;
- suggested implementation owner: `safe-refactor`, `maid-planner`, or
  `maid-evolver`;
- validation commands required after implementation.

## Output

Create or update:

```text
docs/plans/bolt-extension-cleanup-refactor-backlog.md
```

Use these sections:

- Purpose
- Production Safety Contract
- Evidence Reviewed
- Confirmed Cleanup Targets
- Brownfield MAID Coverage Targets
- Speculative Ideas
- Suggested Draft Manifests
- Verification Notes

Keep findings concrete. Do not create cleanup tasks without file evidence.

If the user asks for draft manifests, create bounded drafts under
`manifests/drafts/` with one cleanup per child draft. Validate drafts with:

```bash
./scripts/maid validate --manifest-dir manifests/drafts --mode schema
./scripts/maid validate --manifest-dir manifests --mode schema
```

## Handoff

Report the highest-priority cleanup targets, which ones are safe first, and
which ones need characterization before any code movement. Do not commit or push
unless the user explicitly asks.
