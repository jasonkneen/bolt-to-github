---
name: bolt-extension-performance-optimization
description: Use in bolt-to-github when asked to improve performance, latency, bundle size, memory use, battery impact, or efficiency for this deployed Chrome MV3 extension. Profiles popup rendering, content-script injection, bolt.new DOM observation, ZIP/download processing, GitHub sync, Chrome storage, service-worker wakeups, build chunks, and test/runtime bottlenecks; produces measured findings and optional draft MAID manifests without weakening correctness.
---

# Bolt Extension Performance Optimization

Use this skill in `/home/atomrem/projects/codefrost-dev/bolt-to-github` for a
measured performance pass. This extension runs inside users' browsers and on
bolt.new pages, so speedups must not increase permissions, hide failures, or
drop correctness checks.

This skill plans performance work. It does not implement code changes unless
the user explicitly asks to implement a selected item afterward.

## Performance Contract

Every proposed optimization must preserve:

- GitHub sync correctness, branch/repo selection, and conflict behavior.
- ZIP extraction and file diff accuracy.
- Auth/session isolation and premium gating.
- Visible errors for degraded auth, network, rate-limit, and sync states.
- MV3 service worker reliability after suspend/restart.
- Deterministic tests and MAID validation.

No silent fallback data, stale cache reads presented as fresh data, or permission
expansion is allowed in the name of speed.

## Start

1. Check branch and dirty worktree:

```bash
git status --short --branch --untracked-files=all
```

2. Read likely performance surfaces before assuming hot paths:

- `vite.config.ts`
- `manifest.json`
- `src/background/BackgroundService.ts`
- `src/content/ContentManager.ts`
- `src/content/infrastructure/DOMObserver.ts`
- `src/content/managers/GitHubButtonManager.ts`
- `src/services/DownloadService.ts`
- `src/services/UnifiedGitHubService.ts`
- `src/services/GitHubApiClient.ts`
- `src/services/GitHubComparisonService.ts`
- `src/services/FileService.ts`
- `src/services/zipHandler.ts`
- `src/lib/services/chromeStorage.ts`
- `src/lib/stores/`
- `src/popup/App.svelte`

3. Collect baseline signals:

```bash
pnpm build
pnpm test:ci
find dist -type f -name '*.js' -o -name '*.css' | xargs ls -lh | sort -k5 -h
rg -n "setTimeout|setInterval|MutationObserver|addEventListener|chrome\\.storage|fetch\\(" src
```

For UI or runtime changes, start the relevant dev/watch flow and use Playwright
only when the change is browser-visible.

## Measurement Workflow

Prefer measured wins over intuition. Useful probes:

- build output chunk sizes and Vite warnings;
- popup first render and tab-switch responsiveness;
- content-script startup cost on bolt.new and listener/timer cleanup;
- DOM observer mutation volume and debounce/throttle behavior;
- GitHub API request count for common push/sync paths;
- Chrome storage read/write count and payload size;
- ZIP extraction and file comparison time on large Bolt exports;
- service-worker wakeups, alarms, and long-running async work.

For each confirmed hot path, capture:

- command or reproduction path;
- current timing, size, or call-count baseline;
- user impact;
- code path and tests that must remain equivalent;
- proposed closure and validation command.

Good optimization categories:

- avoid repeated Chrome storage reads when a store already owns fresh state;
- batch GitHub API calls only when errors remain attributable and visible;
- debounce DOM observers without missing toolbar/download UI changes;
- split or lazy-load popup-only code out of content/background bundles;
- remove debug-only output or heavy test fixtures from runtime paths;
- reduce redundant ZIP/file comparison work without changing diff semantics;
- clean up timers/listeners to prevent memory and battery drain.

## Output

Create or update:

```text
docs/plans/bolt-extension-performance-backlog.md
```

Use these sections:

- Purpose
- Performance Contract
- Baselines Captured
- Confirmed Hot Paths
- Speculative Ideas
- Suggested Draft Manifests
- Verification Notes

For draft manifests under `manifests/drafts/`, require one measurable hot path
per child draft and tests that prove both equivalent behavior and reduced work
where practical. Validate drafts with:

```bash
./scripts/maid validate --manifest-dir manifests/drafts --mode schema
./scripts/maid validate --manifest-dir manifests --mode schema
```

## Handoff

Report measured findings first, then speculative ideas. Include the exact
validation gates a future implementation must run: focused Vitest, `pnpm lint`,
`pnpm check`, `pnpm build`, `pnpm test:ci`, and MAID validation when manifests
are involved. Do not commit or push unless explicitly asked.
