# Draft Manifests

Draft manifests are planning inventory. They stay outside the active
`manifests/*.manifest.yaml` set until promoted.

Promote by moving one implementation-sized
`manifests/drafts/<slug>.manifest.yaml` file to `manifests/<slug>.manifest.yaml`.
Implement and validate the promoted path, then delete only the matching draft
file.

Do not promote or implement epic drafts directly. Split epics into smaller
implementation-sized child drafts first.

A draft is ready to promote when behavioral or characterization tests exist, the
red phase has been confirmed when applicable, and draft behavioral validation
passes for the selected scope.

Outcome records are added to the promoted active manifest after implementation
review and before final handoff. See
`../../docs/draft-manifest-workflow.md` and
`../../docs/manifest-outcome-records.md`.
