---
name: bolt-extension-bug-hunt-and-hardening
description: Use in bolt-to-github when asked to bug hunt, harden, or improve reliability for this deployed Chrome MV3 extension. Synthesizes evidence from tests, insights, release notes, logs, TODOs, e2e gaps, Chrome MV3 lifecycle risks, bolt.new DOM drift, GitHub API failures, Supabase auth/session issues, storage migrations, permissions, privacy, and user-visible degraded states; produces a prioritized hardening backlog and optional draft MAID manifests.
---

# Bolt Extension Bug Hunt And Hardening

Use this skill in `/home/atomrem/projects/codefrost-dev/bolt-to-github` when the
user wants to find likely bugs or reliability gaps before users hit them. This
is the repository-specific replacement for a generic tooling self-improvement
skill: focus on production extension risk, not MAID runner internals.

This skill plans hardening work. It does not implement code changes unless the
user explicitly asks to implement a selected item afterward.

## Risk Lanes

Classify each confirmed issue into one primary lane:

- **User-visible correctness:** wrong files, wrong repo/branch, bad diff, failed
  push, or misleading success state.
- **Auth and privacy:** PAT/GitHub App token handling, Supabase sessions,
  premium state, storage of sensitive data, or accidental leakage in logs.
- **MV3 lifecycle:** service worker suspend/restart, alarms, ports, message
  listeners, retries, and cleanup.
- **bolt.new integration:** DOM selector drift, button injection, download flow,
  cached old tabs, or competing native Bolt controls.
- **GitHub API resilience:** rate limits, 403/401 handling, branch conflicts,
  retries, and malformed responses.
- **Storage and migration:** Chrome storage schema, project settings migration,
  per-project state, cache invalidation, and rollback safety.
- **UI degraded states:** missing visible errors, stuck spinners, native dialogs,
  hidden fallbacks, or inaccessible controls.
- **Release and CI:** build warnings, e2e gaps, branch strategy drift, packaged
  extension issues, and insufficient release validation.

## Start

1. Check branch and dirty worktree:

```bash
git status --short --branch --untracked-files=all
```

2. Read current risk context selectively:

- `.claude/insights/` and `.claude/insights/review/`
- `CHANGELOG.md`
- `docs/integration-testing-gaps.md`
- `docs/e2e-testing-rules.md`
- `manifest.json`
- `src/background/`
- `src/content/`
- `src/services/`
- `src/lib/services/chromeStorage.ts`
- `src/lib/constants/supabase.ts`
- `e2e/`

Do not bulk-load every file. Sample enough to confirm themes, then inspect the
best evidence for each candidate.

3. Run or inspect health signals as appropriate:

```bash
pnpm lint
pnpm check
pnpm test:ci
pnpm build
pnpm maid:behavioral
pnpm maid:implementation
rg -n "alert\\(|confirm\\(|prompt\\(|console\\.log|TODO|FIXME|throw new Error|catch \\(" src e2e docs
rg -n "chrome\\.runtime\\.lastError|onDisconnect|onMessage|setTimeout|setInterval|AbortController" src
```

If full commands are too expensive for the current request, state which ones
were skipped and why.

## Evidence Triage

Evidence tiers:

1. Current failing command, failing test, build warning, or reproducible user
   flow.
2. Repeated insight/review finding that still appears in current code.
3. Stale but plausible risk with current code evidence.
4. Speculative idea with no current evidence.

Only put tiers 1-3 in confirmed findings. Put tier 4 in speculative ideas.

Good bug-hunt probes:

- message handlers that do not answer all paths or leak listeners;
- timers/intervals that are not cleared on destroy, disconnect, or service
  worker lifecycle events;
- catches that swallow failures or return placeholder success;
- storage migrations that do not handle missing or malformed old values;
- UI flows that can show success before GitHub confirms the operation;
- rate-limit and auth errors that are not distinguished for the user;
- native dialogs in Svelte/UI code;
- `console.log` or debug tests leaking noisy output into CI;
- content-script selectors with only one brittle strategy;
- e2e tests that rely on comments instead of mocked GitHub behavior.

## Output

Create or update:

```text
docs/plans/bolt-extension-bug-hunt-hardening-backlog.md
```

Use these sections:

- Purpose
- Evidence Reviewed
- Prioritized Confirmed Risks
- Risk Lane Backlog
- Suggested Draft Manifests
- Speculative Ideas
- Verification Notes

For each confirmed risk, include:

- title and primary risk lane;
- evidence source with file/line or command;
- current symptom;
- why it matters for deployed users;
- suggested fix shape;
- tests or reproduction needed before implementation;
- validation gates.

If the user asks for draft manifests, create one implementation-sized child
draft per bounded risk under `manifests/drafts/`. Validate drafts with:

```bash
./scripts/maid validate --manifest-dir manifests/drafts --mode schema
./scripts/maid validate --manifest-dir manifests --mode schema
```

## Handoff

Lead with high-risk findings affecting deployed users. Separate confirmed risks
from speculative ideas. Do not commit or push unless the user explicitly asks.
