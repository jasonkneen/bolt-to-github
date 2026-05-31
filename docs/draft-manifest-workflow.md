# Draft Manifest Workflow

Draft manifests are MAID planning inventory. Promoted manifests are active
contracts.

Use `manifests/drafts/` for mutable planned work that has not been approved for
implementation. Normal validation and test execution should target promoted
manifests in `manifests/`.

## Lifecycle

1. Split larger work into implementation-sized draft manifests under
   `manifests/drafts/`.
2. Refine each draft until scope, declared artifacts, behavioral tests,
   validation commands, dependencies, and temptations are coherent.
3. Promote one ready draft by moving
   `manifests/drafts/<slug>.manifest.yaml` to `manifests/<slug>.manifest.yaml`.
4. Implement strictly inside the promoted manifest's declared scope.
5. Validate the promoted path and run its declared tests.
6. Complete implementation review and fix valid findings.
7. Capture the Outcome record in the promoted manifest after review and before
   final handoff.
8. Remove only the draft file that was promoted.

Do not implement directly from `manifests/drafts/`. If a promoted contract must
change after approval, use the normal MAID evolution path instead of silently
rewriting it.

## Promotion Criteria

A draft is ready to promote when:

- it is implementation-sized and not an epic;
- its file scope is narrow and explicit;
- behavioral or characterization tests exist for the declared production
  behavior;
- the red phase fails for the intended reason, unless the draft is explicitly
  characterization-only;
- behavioral validation passes for the draft path;
- dependencies on earlier drafts are clear.

Outcome capture is documented in `manifest-outcome-records.md`.
