# Plan Revision: align-bolt-dom-capture-toolbar

Manifest path: `manifests/drafts/align-bolt-dom-capture-toolbar.manifest.yaml`

## Stop Reason

The draft cannot currently be completed as a MAID implementation contract because
the script artifacts declared for `scripts/capture-bolt-dom.mjs` are not
representable to the validator.

## Evidence

- `./scripts/maid validate manifests/drafts/align-bolt-dom-capture-toolbar.manifest.yaml --mode behavioral`
  still reports:
  - `E200 Artifact 'toolbar HTML extraction' not used in any test file`
  - `E200 Artifact 'structured toolbar candidate collection' not used in any test file`
  - `E201 Test file 'scripts/__tests__/capture-bolt-dom.test.ts' not found`
- `./scripts/maid validate manifests/drafts/align-bolt-dom-capture-toolbar.manifest.yaml --mode implementation`
  reports the same missing-test and `E200` failures:
  - `E306 File 'scripts/__tests__/capture-bolt-dom.test.ts' not found`
  - `E201 Test file 'scripts/__tests__/capture-bolt-dom.test.ts' not found`
  - `E200 Artifact 'toolbar HTML extraction' not referenced in any test file`
  - `E200 Artifact 'structured toolbar candidate collection' not referenced in any test file`
    and also warns:
  - `E307 No validator available for 'scripts/capture-bolt-dom.mjs'`
- Replacing the descriptive artifact labels with real exported helper names in a
  temporary manifest still failed implementation validation because `.mjs`
  artifacts are not collected by the active validator.
- The draft declares `scripts/__tests__/capture-bolt-dom.test.ts`, but that file
  does not exist yet.
- The script-test harness blocker has been addressed by
  `manifests/direct-script-vitest-harness.manifest.yaml`: the shared Vitest
  include list now collects `scripts/**/*.{test,spec}.{js,ts}` directly.
- Importing the out-of-tree script test from a collected `src/**` test file is
  not an acceptable workaround because it pulls the `.mjs` script into normal
  type validation and can break `pnpm check`.

## Proposed Revision

Revise the manifest before implementation so it can be validated without test
indirection:

1. Move the script-level regression tests to a path collected by the existing
   Vitest config, such as `scripts/__tests__/capture-bolt-dom.test.ts`, now that
   the harness directly includes `scripts/**/*.{test,spec}.{js,ts}`.
2. Do not use a transitive import from an unrelated collected test file to make
   script tests run; the test discovery path must be direct and type-checkable.
3. Do not declare `.mjs` helper implementation artifacts as public MAID
   artifacts unless the MAID runner in this repo can validate `.mjs` files.
4. If script helper contracts must be public, move the reusable DOM extraction
   logic into a validator-supported TypeScript module and have
   `scripts/capture-bolt-dom.mjs` delegate to that module.
5. Keep the existing manager test artifacts for
   `GitHubButtonManager.findToolbarContainer()` because those are already
   validator-supported and behaviorally covered.
6. Include `pnpm check` in the revised validation list when the solution imports
   script logic into TypeScript-collected tests or moves helpers into TypeScript.

After that revision, rerun behavioral validation before implementation.
