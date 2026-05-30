# MAID Manifests

This directory contains the machine-checkable contracts for MAID-backed work in
this repository.

Use the repository wrapper instead of a globally installed `maid` executable:

```bash
./scripts/maid validate --manifest-dir manifests --mode schema
./scripts/maid validate --manifest-dir manifests --mode behavioral
./scripts/maid validate --manifest-dir manifests --mode implementation
./scripts/maid test --manifest-dir manifests
./scripts/maid files --manifest-dir manifests
```

The wrapper runs `maid-runner[all]@latest` through `uvx`. Override the runner
when a pinned reproduction is needed:

```bash
MAID_RUNNER_SPEC="maid-runner[all]==2.8.3" ./scripts/maid validate --manifest-dir manifests --mode implementation
```

If `uvx` is missing, install `uv` first:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Workflow

- Keep active manifests directly under `manifests/`.
- Start every feature, bug fix, and refactor with a MAID manifest unless the
  user explicitly says to skip MAID.
- For touched files that lack MAID coverage, add a manifest and focused
  behavioral or characterization tests in the same change.
- Validate the behavioral contract before implementation.
- Validate implementation and run the manifest test commands before handoff.
- Prefer observable behavior in Vitest tests over private helpers or local
  component state as MAID artifacts.
