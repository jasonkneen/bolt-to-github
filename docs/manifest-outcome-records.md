# Manifest Outcome Records

Outcome records are required completion metadata for MAID manifests. Capture the
Outcome after implementation validation and implementation review, before final
handoff.

Outcome records live in the optional top-level `outcome` field of the promoted
active manifest. They record what happened when the contract closed: status,
summary, rationale, validation evidence, review notes, and reusable lessons.

## Required Boundary

Outcome capture is required for completed, partial, failed, superseded,
archived, or abandoned MAID work. The record must cite concrete validation
commands and review evidence. It does not replace behavioral tests, declared
artifacts, validation commands, supersession or evolution, or implementation
review.

## Lifecycle

1. Plan or promote a manifest with declared files, artifacts, behavioral tests,
   validation commands, and temptations.
2. Implement strictly inside the manifest's declared scope.
3. Run the declared tests and validation commands.
4. Complete implementation review and fix valid findings.
5. Add or update the manifest's `outcome` section.

Do not add final Outcome claims during initial draft planning. Drafts describe
the intended contract; Outcomes describe the reviewed result.
