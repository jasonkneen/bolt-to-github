# Bolt Extension Performance Backlog

## Purpose

Reduce avoidable browser and backend work without weakening GitHub synchronization,
authentication, premium gating, or visible degraded states.

## Performance Contract

- Direct GitHub actions must still perform a fresh live-connection check.
- Cached state must never cross Supabase users or GitHub App installations.
- Disconnected, unavailable, malformed, and near-expiry results must not be reused.
- MV3 suspension and restart must not turn stale metadata into authorization.

## Baselines Captured

- Current popup path: every `App.svelte` construction calls `checkGitHubConnection()`.
- Current GitHub App path: every popup check sends `SYNC_GITHUB_APP`, which reaches
  `get-github-token` even when the same user reopened the popup seconds earlier.
- Current action path: push and file-change entry points independently call
  `checkGitHubConnection()`. This fresh behavior is required and will remain unchanged.
- Production build baseline: popup bundle is approximately 511 kB before gzip and
  132 kB after gzip; existing Vite chunk warnings are unrelated to this optimization.

## Confirmed Hot Paths

### Repeated popup GitHub verification

- Reproduction: open and close the extension popup repeatedly while authenticated with
  a connected GitHub App.
- Current request count: N popup openings produce N live GitHub App synchronizations.
- User impact: repeated visible checking state and avoidable Edge Function invocations.
- Planned closure: reuse only a successful verification for 60 seconds when the current
  Supabase user, installation ID, and non-near-expiry token metadata still match.
- Required invariant: `checkGitHubConnection()` remains force-fresh for push, file
  changes, reminders, and other protected actions.

## Speculative Ideas

- Measure whether popup-only code can be split from the current 500 kB JavaScript chunk.
- Profile repeated store initialization after the connection-cache change lands.
- Consider `chrome.storage.session` only if a future design moves cache ownership fully
  into the background authority; content-script access must not be broadened casually.

## Suggested Draft Manifests

- `cache-recent-popup-github-verification`: one-minute success-only popup cache plus an
  accessible animated checking state.

## Verification Notes

Required gates: focused Vitest request-count and component tests, `pnpm lint`,
`pnpm check`, `pnpm build`, `pnpm test:ci`, MAID behavioral/implementation validation,
and independent implementation review.
