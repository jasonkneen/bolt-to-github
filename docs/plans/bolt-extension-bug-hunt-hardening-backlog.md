# Bolt Extension Bug Hunt Hardening Backlog

## Purpose

Capture confirmed reliability, release, and user-visible hardening risks found during the
2026-05-30 bug hunt for the Bolt to GitHub Chrome MV3 extension. This is a planning
artifact only; it does not implement runtime changes.

## Evidence Reviewed

- Current branch/worktree: `git status --short --branch --untracked-files=all` reported a
  clean `dev-v1.3.19` worktree before these planning files were added.
- Health commands:
  - `pnpm lint`: passed.
  - `pnpm check`: passed with 0 Svelte/TypeScript diagnostics.
  - `pnpm test:ci`: passed, 172 files / 4202 tests, but emitted ZIP debug stdout.
  - `pnpm build`: passed, but emitted Vite import/chunk warnings.
  - `pnpm maid:behavioral`: passed, 1 active manifest.
  - `pnpm maid:implementation`: passed, 1 active manifest.
  - `pnpm exec playwright test --project=chromium --reporter=list`: failed, 18 failed,
    56 passed, 3 skipped.
- Existing risk docs:
  - `docs/integration-testing-gaps.md` still lists 0% integration coverage for 8 complex
    component workflows, including `LogViewer.svelte`.
  - `docs/e2e-testing-rules.md` requires realistic user journeys, stable selectors,
    visible error states, and Chrome extension lifecycle coverage.
- Recent insights:
  - `.claude/insights/2026/05/30/2026-05-30_10-28_bolt-dom-restructure-patterns_c89fda6c98f5.md`
  - `.claude/insights/2026/05/30/2026-05-30_10-31_bolt-dom-selector-fix-and-capture-script-correction_6ecdcb136097.md`
- Targeted code probes:
  - `rg -n "alert\\(|confirm\\(|prompt\\(|console\\.log|TODO|FIXME|throw new Error|catch \\(" src e2e docs`
  - `rg -n "chrome\\.runtime\\.lastError|onDisconnect|onMessage|setTimeout|setInterval|AbortController" src`

## Prioritized Confirmed Risks

### 1. Runtime message listener can drop async responses

- Primary lane: MV3 lifecycle.
- Evidence source: `src/background/BackgroundService.ts:280` declares the runtime
  listener as `async`; branches at `src/background/BackgroundService.ts:303`,
  `src/background/BackgroundService.ts:307`, `src/background/BackgroundService.ts:320`,
  and `src/background/BackgroundService.ts:334` await work before `sendResponse`.
- Current symptom: the listener returns a Promise, not literal `true` synchronously. Chrome
  runtime messaging requires the listener to return `true` synchronously when responding
  asynchronously.
- Why it matters for deployed users: popup/content flows such as forced popup sync,
  logout, upgrade modal opening, and GitHub App sync notifications can appear to hang or
  fail if the response channel closes before `sendResponse` runs.
- Suggested fix shape: replace the async listener with a synchronous listener that delegates
  async work to helpers and returns literal `true` for every async branch; add tests that
  assert the registered listener returns `true` synchronously and resolves/rejects through
  `sendResponse`.
- Tests/reproduction needed: focused Vitest coverage in background message tests for
  `FORCE_POPUP_SYNC`, `USER_LOGOUT`, `SHOW_UPGRADE_MODAL`, and one failure path.
- Validation gates: `pnpm exec vitest run src/background/__tests__/BackgroundService.*.test.ts`,
  `pnpm lint`, `pnpm check`, `pnpm test:ci`.

### 2. E2E release gate has stale error-flow coverage

- Primary lane: Release and CI.
- Evidence source: `pnpm exec playwright test --project=chromium --reporter=list` failed
  18 tests. Failures in `e2e/errors.spec.ts` repeatedly time out at
  `e2e/helpers/popup.ts:115` because the first repository input match is hidden. The same
  spec calls `fillRepositorySettings(page, { ... })` at `e2e/errors.spec.ts:40`,
  `e2e/errors.spec.ts:75`, `e2e/errors.spec.ts:236`, `e2e/errors.spec.ts:295`,
  `e2e/errors.spec.ts:311`, and `e2e/errors.spec.ts:378`, while the helper signature at
  `e2e/helpers/popup.ts:106` expects positional strings.
- Current symptom: error-flow tests fail before they reach the intended product assertions.
- Why it matters for deployed users: invalid token, offline, invalid repo, push failure,
  retry, and recovery paths are not currently protected by a passing browser-level release
  gate.
- Suggested fix shape: update the E2E helper to select visible repository controls and/or
  support the object shape used by existing specs; remove placeholder-only assertions and
  convert error-flow tests into deterministic product checks with visible degraded states.
- Tests/reproduction needed: rerun `e2e/errors.spec.ts` first, then the full E2E suite.
- Validation gates: `pnpm exec playwright test e2e/errors.spec.ts --project=chromium`,
  `pnpm exec playwright test --project=chromium --reporter=list`.

### 3. E2E lifecycle specs use stale extension/storage contracts

- Primary lane: Storage and migration.
- Evidence source: `pnpm exec playwright test --project=chromium --reporter=list` failed
  lifecycle tests. Current source still expects stale storage aliases including
  `settings.authType` at `e2e/lifecycle.spec.ts:85`, `e2e/lifecycle.spec.ts:106`,
  `e2e/lifecycle.spec.ts:115`, `e2e/lifecycle.spec.ts:232`, and
  `e2e/lifecycle.spec.ts:357`, plus `settings.installationId` at
  `e2e/lifecycle.spec.ts:116`; current helpers use `authenticationMethod` and
  `githubAppInstallationId` in `e2e/helpers/storage.ts:11`. The spec also navigates to
  nonexistent `chrome-extension://<id>/popup.html` at `e2e/lifecycle.spec.ts:127`,
  `e2e/lifecycle.spec.ts:147`, `e2e/lifecycle.spec.ts:471`, and
  `e2e/lifecycle.spec.ts:486`; the real popup URL used elsewhere is `src/popup/index.html`.
- Current symptom: lifecycle tests fail against outdated assumptions, making storage
  persistence and restart coverage untrustworthy.
- Why it matters for deployed users: MV3 service worker restarts, extension reloads,
  auth persistence, and cross-context storage updates are high-risk areas for this
  extension.
- Suggested fix shape: align lifecycle helpers and assertions with current extension URLs
  and current storage schema, then separate true product failures from stale test
  assertions.
- Tests/reproduction needed: rerun `e2e/lifecycle.spec.ts`; inspect remaining failures
  after the contract drift is fixed.
- Validation gates: `pnpm exec playwright test e2e/lifecycle.spec.ts --project=chromium`,
  `pnpm exec playwright test --project=chromium --reporter=list`.

### 4. Log viewer still uses native confirmation dialogs

- Primary lane: UI degraded states.
- Evidence source: `src/lib/components/LogViewer.svelte:71` and
  `src/lib/components/LogViewer.svelte:78` call `confirm()`. Existing project guidance
  forbids native `window.alert()`, `window.confirm()`, and `window.prompt()`.
- Current symptom: destructive log-clearing actions depend on blocking browser-native
  dialogs rather than extension-native, testable UI.
- Why it matters for deployed users: native dialogs are inconsistent across extension pages,
  hard to test, and can obscure the visible degraded-state UX for log recovery.
- Suggested fix shape: replace both native confirmations with the existing
  `ConfirmationDialog`/`EnhancedConfirmationDialog` pattern and add component tests for
  cancel, normal clear, emergency clear, disabled/loading, and focus/visibility behavior.
- Tests/reproduction needed: focused `LogViewer` component tests plus a scan confirming no
  native dialogs remain in app code.
- Validation gates: `pnpm exec vitest run src/lib/components/__tests__/LogViewer.*.test.ts`,
  `rg -n "alert\\(|confirm\\(|prompt\\(" src`, `pnpm lint`, `pnpm check`.

### 5. Bolt DOM capture behavior needs regression coverage

- Primary lane: bolt.new integration.
- Evidence source:
  `.claude/insights/2026/05/30/2026-05-30_10-31_bolt-dom-selector-fix-and-capture-script-correction_6ecdcb136097.md`
  reported a prior mismatch between runtime selector recovery and captured toolbar HTML.
  Current script evidence at `scripts/capture-bolt-dom.mjs:109` through
  `scripts/capture-bolt-dom.mjs:125` now anchors on Publish/Deploy/Share before legacy
  `ml-auto` fallback, matching the runtime direction in
  `src/content/managers/GitHubButtonManager.ts:38`.
- Current symptom: runtime selector tests cover the current toolbar strategy, but the
  capture script itself has no regression test guarding the Publish/Share-first extraction
  behavior that future selector recovery depends on.
- Why it matters for deployed users: Bolt DOM drift is a repeated production failure mode;
  misleading fixtures slow down recovery and can cause selector regressions.
- Suggested fix shape: factor or test the capture script's Publish/Share anchor extraction,
  keep legacy `ml-auto` fallback coverage, and ensure future capture changes cannot regress
  to preview-pane or resize-handle HTML.
- Tests/reproduction needed: fixture-based test for toolbar HTML extraction plus the existing
  `GitHubButtonManager` tests.
- Validation gates: `pnpm exec vitest run src/content/managers/__tests__/GitHubButtonManager.test.ts`,
  a focused test for `scripts/capture-bolt-dom.mjs` extraction if script tests are added,
  `pnpm lint`, `pnpm build`.

### 6. Build/test output contains avoidable release noise

- Primary lane: Release and CI.
- Evidence source: `pnpm build` warns that `vite.config.ts:4` uses the deprecated JSON
  import assertion syntax under the current Node target. The same build warns about dynamic
  imports that cannot move chunks and a post-minification chunk over 500 kB. `pnpm test:ci`
  passes but prints debug output from `src/lib/__tests__/zip-debug.test.ts:11`.
- Current symptom: successful validation output is noisy enough to hide meaningful warnings
  and makes release logs harder to review.
- Why it matters for deployed users: release warnings can mask regressions in packaged
  extension builds, especially in a repo that depends on browser packaging and MV3 behavior.
- Suggested fix shape: change the Vite config JSON import to current syntax or an equivalent
  typed load, convert the ZIP debug test into a quiet behavioral regression test, and decide
  whether chunk warnings need thresholds, manual chunks, or a separate performance task.
- Tests/reproduction needed: rerun build and focused ZIP tests, verifying no debug stdout.
- Validation gates: `pnpm build`, `pnpm exec vitest run src/lib/__tests__/zip-debug.test.ts`,
  `pnpm test:ci`.

#### Verification Notes

The remaining Rollup chunk-size warnings are accepted for this release-noise pass. Treat
chunk splitting, manual chunk policy, or warning-threshold changes as a separate performance
task so this fix stays limited to the JSON import warning and noisy ZIP regression output.

## Risk Lane Backlog

- MV3 lifecycle: fix async runtime message response handling; verify service worker restart
  E2E after stale lifecycle contracts are repaired.
- Release and CI: make E2E error/lifecycle suites deterministic; remove Vite import warning
  and ZIP debug stdout; decide whether chunk warnings are accepted or require a performance
  follow-up.
- UI degraded states: replace native log-clearing confirmations with app-native dialogs and
  visible loading/error states.
- bolt.new integration: add regression coverage around DOM capture tooling and preserve
  legacy/current layout tests.
- Storage and migration: align lifecycle E2E helpers with `authenticationMethod` and current
  extension page URLs.
- User-visible correctness: after E2E harness repair, confirm whether failed push/error
  paths show the intended user-visible messages.

## Suggested Draft Manifests

- `manifests/drafts/harden-background-runtime-message-channel.manifest.yaml`
- `manifests/drafts/repair-e2e-error-flow-coverage.manifest.yaml`
- `manifests/drafts/repair-e2e-lifecycle-storage-contracts.manifest.yaml`
- `manifests/drafts/replace-logviewer-native-confirms.manifest.yaml`
- `manifests/drafts/align-bolt-dom-capture-toolbar.manifest.yaml`
- `manifests/drafts/clear-build-and-test-release-noise.manifest.yaml`

## Speculative Ideas

- Add a scheduled CI job for a minimal real-browser extension smoke suite if the full E2E
  suite remains too slow for every PR.
- Consider a separate performance task for popup/content chunk size once release-blocking
  warnings and failing E2E tests are handled.
- Consider promoting the Bolt DOM capture fixtures into versioned test fixtures if real DOM
  capture continues to be central to selector recovery.

## Verification Notes

- Active MAID validation passed before draft manifests were created:
  `pnpm maid:behavioral` and `pnpm maid:implementation`.
- Full E2E currently does not pass: `18 failed, 56 passed, 3 skipped` after retries.
- Draft manifests are intentionally under `manifests/drafts/`, not active `manifests/`.
- Subagent review completed after initial draft creation. The review found that draft schema
  validation passes, but draft behavioral validation is not green because these are planning
  drafts and do not yet include the behavioral tests required for promotion to active
  implementation manifests. Do not promote a draft until its behavioral tests exist and
  `./scripts/maid validate --manifest-dir manifests/drafts --mode behavioral` passes for the
  promoted scope.
