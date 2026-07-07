---
title: 'B2G Production Readiness Snapshot'
subtitle: 'Implementation Reference and MAID Epic Source Document'
author: 'Prepared for Mamerto Fabian'
date: 'July 6, 2026'
---

# Contents

| Section | Topic                                  |
| ------: | -------------------------------------- |
|       - | Document control                       |
|       1 | Executive summary                      |
|       2 | Product thesis                         |
|       3 | Product boundary                       |
|       4 | Core user stories                      |
|       5 | Canonical module contract              |
|       6 | Readiness language model               |
|       7 | Readiness categories                   |
|       8 | Signal catalog                         |
|       9 | Historical baseline and trends         |
|      10 | Readiness state composition            |
|      11 | Data model                             |
|      12 | Architecture proposal                  |
|      13 | Path classification rules              |
|      14 | Report formats                         |
|      15 | ADC Fix crossover                      |
|      16 | User settings                          |
|      17 | Error states and fallbacks             |
|      18 | Testing strategy                       |
|      19 | MAID epic source plan                  |
|      20 | MVP definition                         |
|      21 | Open decisions                         |
|      22 | Copy guidelines                        |
|      23 | Risk register for this module          |
|      24 | Definition of done for the parent epic |
|      25 | Final recommended positioning          |

# Document control

**Working name:** B2G Production Readiness Snapshot  
**Short name:** PRS  
**Product context:** Bolt to GitHub extension, with a thin crossover to ADC Fix at `fix.aidrivencoder.com`  
**Document role:** Base planning reference for a parent MAID draft manifest epic. Child MAID draft manifests should be split from this document into implementation-sized slices.

This document is intentionally more comprehensive than an implementation ticket. It defines the product boundary, module contract, signal model, detectors, output formats, UI expectations, privacy constraints, test strategy, and suggested MAID epic split for the B2G Production Readiness Snapshot module.

This is **not** the MAID manifest itself. It is the canonical planning source that the MAID draft manifest epic should be based on.

# 1. Executive summary

Bolt to GitHub currently exports a static `bolt.new` project zip and can connect that export to a GitHub repository. The extension does not need LLM capabilities to provide more value. The most valuable next step is to turn each export into an evidence-based production readiness snapshot.

The module should answer:

> What changed in this Bolt export, what production-sensitive areas were touched, and is this change unusual compared with the project's history?

The module should not claim to understand whether the code is correct. It should not present itself as a full security audit or AI code review. Instead, it should give deterministic, explainable signals based on the exported zip, the GitHub repository state, and optionally prior B2G snapshots.

The intended product positioning is:

- **Bolt to GitHub**: lightweight export preflight and readiness trail.
- **ADC Fix**: deeper production readiness diagnosis and repair service.

The thin crossover is a user-initiated **ADC Fix Handoff Report** generated from the same evidence. The extension should never auto-upload project code, secrets, or private repository data to ADC Fix. The handoff is an artifact the user can copy, save, or send deliberately.

# 2. Product thesis

## 2.1 From exporter to readiness trail

The current mental model is:

> Export Bolt project to GitHub.

The stronger product mental model is:

> Export Bolt project to GitHub with a production readiness trail.

This turns B2G into a safety layer for people building with Bolt. It helps users notice when a small prompt caused a broad rewrite, when auth or deployment files changed, when new environment variables appeared, or when the project is getting harder to maintain.

## 2.2 Smoke alarm, not repair service

The module should behave like a smoke alarm. It detects visible signs that a change deserves attention. It does not diagnose every root cause and does not fix the application.

ADC Fix remains the inspection and repair service.

Good language:

> This export touched production-sensitive areas.

Avoid language like:

> Your app is insecure.

Good language:

> New environment variables were referenced, but `.env.example` was not updated.

Avoid language like:

> Your environment is broken.

Good language:

> This export is 4.2x larger than your usual export.

Avoid language like:

> Bolt made a bad change.

## 2.3 Deterministic signals are enough

The absence of LLM capabilities is not a weakness for this module. Deterministic checks are often more trustworthy for this use case because they are:

- cheaper to run;
- explainable;
- predictable;
- testable with fixtures;
- privacy-friendly;
- suitable for browser-extension execution;
- easy to use as evidence in a MAID workflow.

# 3. Product boundary

## 3.1 In scope

The PRS module should inspect a Bolt export and compare it with the target GitHub repository state. It should produce a concise snapshot containing readiness state, top concerns, safe-looking areas, detailed evidence, and optional handoff content.

In scope:

- zip ingestion and normalized file inventory;
- comparison against GitHub HEAD or selected base ref;
- changed, added, deleted, and renamed file detection;
- line-level change metrics where practical;
- binary and asset change metrics;
- path-based sensitive-area classification;
- dependency diffing from package manifests;
- environment variable reference detection;
- secret leakage heuristics with redaction;
- public route and API surface detection;
- test and CI presence or degradation signals;
- file bloat and churn signals;
- repository history baseline and unusual change detection;
- readiness state composition;
- extension UI summary;
- Markdown export receipt;
- optional ADC Fix handoff report.

## 3.2 Out of scope for MVP

Out of scope for the first implementation:

- LLM-based code review;
- executing user code;
- running builds, tests, migrations, or deployment commands;
- verifying application behavior in a browser;
- proving security vulnerabilities;
- automatic pull request creation unless already supported elsewhere in B2G;
- automatic upload of source code to any external service;
- full SBOM generation;
- dependency vulnerability lookup;
- license compliance;
- semantic duplicate-code detection;
- deep AST-based control-flow analysis.

Some of these can be future modules, but they should not block the deterministic PRS MVP.

## 3.3 Product claims to avoid

Avoid these claims in UI, docs, and marketing:

- "AI code audit"
- "security audit"
- "guaranteed production ready"
- "finds all bugs"
- "proves your app is safe"
- "replaces testing"

Preferred claims:

- "production readiness snapshot"
- "export preflight"
- "production-sensitive change detection"
- "change receipt"
- "readiness trail"
- "handoff report for deeper review"

# 4. Core user stories

## 4.1 Builder exporting from Bolt

As a Bolt user, I want to see what changed before I push an export to GitHub, so that I do not blindly overwrite or deploy a risky change.

Acceptance signal:

- The user sees changed file counts, readiness state, top concerns, and safe-looking areas before committing.

## 4.2 Builder trying to launch

As a builder preparing to deploy or launch, I want to know whether the latest export touched production-sensitive areas like auth, data, env vars, payments, or deployment config.

Acceptance signal:

- The snapshot groups evidence by readiness category and uses practical language.

## 4.3 Builder needing help from ADC Fix

As a builder who sees a Yellow or Red snapshot, I want to generate a handoff report I can use for a deeper production readiness review.

Acceptance signal:

- The user can generate a Markdown report containing repo context, changed areas, evidence, historical concerns, and suggested ADC Fix review areas.

## 4.4 Technical user reviewing history

As a technical user, I want to know whether my project is becoming more complex or unstable across exports.

Acceptance signal:

- The module identifies unusual change size, repeated churn, large file growth, dependency drift, and repeated sensitive-area changes.

# 5. Canonical module contract

## 5.1 Inputs

The module may consume the following inputs:

| Input                        |                       Required? | Notes                                                                     |
| ---------------------------- | ------------------------------: | ------------------------------------------------------------------------- |
| Exported Bolt zip            |                        Required | Treated as the candidate project snapshot.                                |
| GitHub repository owner/name |         Required for comparison | Needed to fetch base tree, commits, and compare URLs.                     |
| Base ref                     |         Required for comparison | Usually current default branch HEAD.                                      |
| Target branch                |                        Optional | Usually the branch B2G will push to.                                      |
| GitHub commit history        | Optional but strongly preferred | Enables unusual change detection and churn trends.                        |
| Prior B2G snapshots          |                        Optional | Enables richer history if stored locally or in commit bodies.             |
| User settings                |                        Optional | Includes ignored paths, readiness thresholds, ADC Fix handoff preference. |

## 5.2 Outputs

The module should produce these outputs:

| Output                    |   Required? | Purpose                                                                 |
| ------------------------- | ----------: | ----------------------------------------------------------------------- |
| Readiness snapshot object |    Required | Structured machine-readable result.                                     |
| UI summary                |    Required | Human-readable panel inside B2G.                                        |
| Export receipt            | Recommended | Markdown summary that can be copied, saved, or included in commit body. |
| ADC Fix handoff report    |    Optional | More complete Markdown report for deeper review.                        |
| Debug evidence object     | Recommended | Useful for tests, troubleshooting, and MAID validation.                 |

## 5.3 Non-mutating default behavior

The module should default to analysis only. It should not alter the repo, commit files, create issues, or contact external services unless the user explicitly invokes an action.

# 6. Readiness language model

The module should classify evidence, not make unsupported judgments.

## 6.1 Readiness states

Use three user-facing states for MVP.

### Green: mostly safe-looking preflight

Meaning:

- No obvious production-sensitive areas changed.
- Change size is normal for the project or no history exists yet.
- No high-severity deterministic signals were found.

Example copy:

> Mostly UI/content changes. No obvious production-sensitive areas changed.

### Yellow: review before deploy

Meaning:

- One or more production-sensitive areas changed, or the export is larger than usual.
- The change may be fine, but should not be deployed blindly.

Example copy:

> Production-sensitive areas changed. Review config, routes, dependencies, or tests before deploying.

### Red: do not blindly deploy

Meaning:

- Multiple high-impact signals were detected, or a critical signal was detected.
- Red does not mean the app is broken. It means the export deserves deeper review before deployment.

Example copy:

> This export changed multiple production-sensitive areas or is unusually large. Generate a handoff report or run a deeper review before deploying.

## 6.2 Internal severity levels

The implementation may use internal severity levels to compose the final state.

| Severity | User meaning                | Example                                                |
| -------- | --------------------------- | ------------------------------------------------------ |
| Info     | Useful context              | 12 files changed.                                      |
| Low      | Minor readiness signal      | UI component grew by 120 lines.                        |
| Medium   | Review-worthy signal        | New dependency added.                                  |
| High     | Production-sensitive signal | Auth middleware changed.                               |
| Critical | Do not ignore               | `.env` file included in zip or likely secret detected. |

The UI should not over-focus on numeric scores. The state and evidence are more important than the number.

## 6.3 Evidence wording rules

Every concern should follow this structure:

1. What changed.
2. Why it matters practically.
3. What the user should review.
4. Evidence: file paths, variable names, dependency names, or metrics.

Example:

> New environment variables were referenced, but `.env.example` was not updated. Review production environment configuration before deploying. Evidence: `RESEND_API_KEY`, `VITE_SUPABASE_URL`.

# 7. Readiness categories

The categories should mirror the ADC Fix production readiness worldview. This makes the thin crossover natural while keeping B2G independent.

## 7.1 Identity and access

Purpose:

- Detect changes that may affect sign-in, sessions, protected routes, admin routes, and role access.

Static signals:

- auth-related file paths;
- middleware files;
- login, signup, account, dashboard, admin routes;
- Clerk, Supabase Auth, Firebase Auth, Auth.js, NextAuth dependencies;
- role-related filenames or constants;
- route guards or protected-route helpers.

Example concern:

> Identity/access surface changed. Review sign-in, session handling, and protected routes before deploying.

## 7.2 Data and persistence

Purpose:

- Detect changes that affect stored data, schemas, migrations, uploads, and database clients.

Static signals:

- Prisma, Drizzle, Supabase, Firebase, SQL, migration, schema files;
- storage or upload code;
- database client config;
- new tables or collection-looking files;
- migrations added, deleted, or renamed.

Example concern:

> Data layer changed. Check whether schema, storage, and production data assumptions still match.

## 7.3 Secrets and configuration

Purpose:

- Detect production configuration changes and accidental secret exposure.

Static signals:

- new `process.env.*`, `import.meta.env.*`, `Deno.env.get`, or `Bun.env.*` references;
- new `VITE_*`, `NEXT_PUBLIC_*`, or public environment variables;
- `.env` files included in zip;
- `.env.example` missing or stale;
- hardcoded key-like values by regex;
- deployment-specific config changes.

Example concern:

> Configuration changed. New environment variables were detected, but the example config was not updated.

## 7.4 Deployment and operations

Purpose:

- Detect changes that may affect building, deploying, hosting, and runtime operation.

Static signals:

- Vercel, Netlify, Cloudflare, Docker, GitHub Actions, and workflow files;
- build scripts changed;
- package manager lockfile changes;
- deploy command changes;
- runtime config files;
- logging, monitoring, or error-handling dependencies.

Example concern:

> Deployment surface changed. Verify build, preview deploy, and production deploy settings.

## 7.5 External integrations

Purpose:

- Detect the introduction or modification of third-party service dependencies.

Static signals:

- Stripe, PayPal, Resend, SendGrid, Twilio, OpenAI, Anthropic, Supabase, Firebase, Clerk, analytics, monitoring, storage, or webhook-related packages;
- webhook routes;
- email templates;
- billing-related filenames;
- API client modules.

Example concern:

> External integration added or changed. Review credentials, webhook behavior, retries, and failure handling.

## 7.6 Public surface and routing

Purpose:

- Detect user-visible pages and exposed endpoints added by the export.

Static signals:

- Next.js app routes;
- Next.js pages routes;
- API route files;
- React Router route arrays or route components where detectible;
- admin, upload, dashboard, billing, settings, login, signup, callback, or webhook paths;
- forms and file inputs.

Example concern:

> Public surface changed. New routes or endpoints were added and should be checked before deployment.

## 7.7 Testing and recovery

Purpose:

- Detect whether the amount and sensitivity of changes are matched by tests, CI, and rollback readiness.

Static signals:

- test scripts in `package.json`;
- test file counts;
- deleted tests;
- CI workflow files;
- error boundaries;
- rollback checkpoints;
- large sensitive changes with no test files nearby.

Example concern:

> Test/recovery coverage looks thin for the amount of code changed.

## 7.8 Maintainability and change discipline

Purpose:

- Detect whether the project is becoming harder to maintain across Bolt exports.

Static signals:

- file bloat;
- frequently changed hotspot files;
- dependency drift;
- repeated lockfile churn;
- backup/temp/copy files;
- large generated assets;
- duplicate-looking paths;
- many files changed by a small feature export.

Example concern:

> This export is much larger than usual and changed hotspot files that have churned across recent exports.

# 8. Signal catalog

This section defines the first useful detector set. The implementation should keep these detectors independent and composable.

## 8.1 Change size signals

Metrics:

- changed file count;
- added file count;
- deleted file count;
- renamed file count where detectable;
- added lines;
- deleted lines;
- binary file count;
- total zip size;
- largest changed file;
- largest line-count increase.

Concerns:

- export is larger than project median;
- export is largest in recent history;
- file deletion spike;
- source code rewrite spike;
- asset size spike.

Suggested thresholds:

- Yellow if changed files are greater than 3x historical median and at least 15 files.
- Yellow if added plus deleted lines are greater than 3x historical median and at least 500 lines.
- Red if changed files are greater than 6x historical median and production-sensitive files also changed.
- Red if many files were deleted and the deletion includes config, route, source, or test files.

Fallback when history is unavailable:

- Yellow if more than 30 source files changed.
- Yellow if more than 1,000 source lines changed.
- Red if more than 75 source files changed plus sensitive categories changed.

## 8.2 Sensitive file signals

Classify paths into production-sensitive buckets:

- auth and access;
- database and persistence;
- env and config;
- deployment and CI;
- payment and billing;
- external integrations;
- routes and API endpoints;
- tests and recovery.

Concern examples:

- auth file changed;
- middleware changed;
- database schema changed;
- deployment config changed;
- GitHub Actions workflow changed;
- payment route added;
- API route added;
- tests deleted.

## 8.3 Dependency drift signals

Parse `package.json` and compare dependency sections:

- `dependencies`;
- `devDependencies`;
- `peerDependencies`;
- `optionalDependencies`.

Metrics:

- dependencies added;
- dependencies removed;
- dependency version changed;
- major-looking version change;
- dependency category introduced;
- package manager conflict;
- lockfile changed without manifest change;
- manifest changed without lockfile change.

Concern examples:

> 3 new production dependencies were added: `stripe`, `resend`, `zod`.

> `package.json` changed but no lockfile change was detected.

> Multiple package manager lockfiles were detected.

Dependency category map for MVP:

- auth: `@clerk/*`, `next-auth`, `@supabase/supabase-js`, `firebase`;
- database: `prisma`, `drizzle-orm`, `@neondatabase/serverless`, `pg`, `mysql2`, `mongoose`;
- payments: `stripe`, `@paypal/*`;
- email/SMS: `resend`, `nodemailer`, `@sendgrid/*`, `twilio`;
- AI APIs: `openai`, `anthropic`, `ai`, `@ai-sdk/*`;
- validation: `zod`, `yup`, `joi`;
- monitoring: `sentry`, `@sentry/*`, `posthog-js`;
- auth/storage/platform: `firebase`, `@supabase/*`.

The map should be extensible and data-driven.

## 8.4 Environment variable signals

Scan source files for environment variable references.

Patterns:

- `process.env.NAME`;
- `process.env["NAME"]`;
- `process.env['NAME']`;
- `import.meta.env.NAME`;
- `Deno.env.get("NAME")`;
- `Bun.env.NAME`;
- `PUBLIC_*` conventions;
- `VITE_*` and `NEXT_PUBLIC_*` public variables.

Metrics:

- env vars referenced in candidate export;
- env vars referenced in base repo;
- new env vars;
- removed env vars;
- public env vars;
- `.env.example` coverage;
- `.env` or `.env.local` present in export.

Concern examples:

> New environment variables were referenced, but `.env.example` was not updated.

> A `.env` file was found in the exported zip. Do not commit real secrets.

> A new public environment variable was introduced. Confirm that it is safe for client-side exposure.

Important privacy rule:

- Never display detected secret values. Show variable names and file paths only.

## 8.5 Secret leakage heuristics

Detect likely secrets using conservative regex rules, but phrase findings carefully.

Signals:

- `.env`, `.env.local`, `.env.production`, `.env.development` files included;
- key-looking strings assigned to variables like `apiKey`, `secret`, `token`, `privateKey`;
- common provider key prefixes;
- PEM private key blocks;
- long high-entropy strings in config files.

User-facing wording:

> Possible secret-looking value detected. Review before committing. Values are hidden in this report.

Avoid claiming certainty unless the file itself is clearly a secret file.

## 8.6 Public surface signals

Detect route files and route-like declarations.

Framework conventions:

- Next.js App Router: `app/**/page.*`, `app/**/route.*`, `src/app/**/page.*`, `src/app/**/route.*`;
- Next.js Pages Router: `pages/**/*.*`, `src/pages/**/*.*`, excluding `_app`, `_document`, `_error` as special files;
- Vite/React: detect route arrays and router config heuristically;
- API routes: `api`, `route.ts`, `route.js`, `functions`, `server`, `webhook` paths.

Additional public-surface hints:

- form elements;
- file upload inputs;
- admin, billing, dashboard, settings, callback, webhook, login, signup route names;
- public assets added;
- CORS config files;
- middleware touching request/response.

Concern examples:

> New API route added: `/api/contact`.

> New admin-looking route added: `/admin`.

> New upload-related code found. Review file size limits, auth, storage, and error handling.

## 8.7 Test and CI signals

Detect:

- test script present or missing;
- test files added or deleted;
- test framework dependencies;
- CI workflows added, changed, or deleted;
- typecheck and lint scripts;
- `eslint-disable`, `@ts-ignore`, or `any` growth in TypeScript projects.

Concern examples:

> This export changed 18 source files but no test files were added or updated.

> Test files were deleted in this export.

> CI workflow changed. Verify that build and test checks still run.

## 8.8 Maintainability signals

Detect:

- files over line thresholds;
- files crossing a threshold in this export;
- files that grew significantly;
- large single components;
- repeated churn in the same file;
- backup/temp/copy file names;
- generated-looking code committed to source folders;
- duplicate route/component names;
- too many files changed in one export.

Suggested thresholds:

- Info at 300+ lines for component files;
- Yellow at 500+ lines;
- Red at 1,000+ lines if the file also changed heavily;
- Yellow when a file grows by 300+ lines in one export;
- Yellow when the same source file changed in 5 of the last 8 exports.

Concern examples:

> `src/App.tsx` is now 1,247 lines and grew by 430 lines in this export.

> `src/lib/supabase.ts` has changed in 5 of the last 7 exports.

## 8.9 File deletion and overwrite signals

Detect:

- deleted files by category;
- source files deleted;
- config files deleted;
- test files deleted;
- route files deleted;
- lockfile removed;
- `.env.example` removed;
- README or setup docs removed.

Concern examples:

> 12 files were deleted, including 2 test files and 1 deployment config file.

> `.env.example` was removed.

## 8.10 Rollback readiness signals

Detect:

- current base commit;
- previous export commit candidates;
- last low-risk snapshot if available;
- compare URL;
- suggested checkpoint tag name or commit note.

Concern examples:

> This export is Red. Consider keeping a rollback checkpoint before merging.

Suggested checkpoint format:

`bolt-export-YYYY-MM-DD-NNN`

# 9. Historical baseline and trends

## 9.1 Why history matters

Generic stats are useful but limited.

Weak:

> 42 files changed.

Stronger:

> 42 files changed. Your usual export changes 9 files. This is your largest export in the last 30 days.

History is what turns a static receipt into a project flight recorder.

## 9.2 Sources of history

The module can use three history sources, in this order:

1. Prior PRS snapshots, if available.
2. GitHub commits generated by B2G, if identifiable.
3. Recent GitHub commit history as a fallback.

Possible B2G commit identification methods:

- commit message prefix;
- commit body marker;
- author metadata;
- local extension snapshot store;
- optional `.b2g` metadata file in repo in a future version.

For MVP, do not require perfect export detection. Use available history and clearly label confidence.

## 9.3 Baseline metrics

Track per export or commit:

- changed files;
- added files;
- deleted files;
- lines added;
- lines deleted;
- sensitive categories touched;
- dependency count;
- env var count;
- route count;
- API route count;
- test file count;
- largest file size;
- hotspot files.

## 9.4 Robust comparison

Use robust statistics rather than simple averages when possible.

Suggested approach:

- Use median as the baseline.
- Use percentile rank for user-friendly statements.
- Use median absolute deviation or IQR for unusual-change detection.
- Use fallback thresholds when fewer than 5 historical samples exist.

Example labels:

- normal range;
- larger than usual;
- unusually large;
- largest recent export;
- repeated churn;
- accelerating dependency growth.

## 9.5 Trend examples

Trend copy should be simple:

> Project size is growing steadily across recent exports.

> Dependency count increased in 4 of the last 5 exports.

> `src/App.tsx` is the largest and most frequently changed file.

> Tests have not increased while source files have grown.

# 10. Readiness state composition

## 10.1 Internal scoring recommendation

Use points internally, but avoid making the score the main UI.

Suggested initial points:

| Signal severity | Points |
| --------------- | -----: |
| Info            |      0 |
| Low             |      1 |
| Medium          |      3 |
| High            |      5 |
| Critical        |      8 |

Suggested state rules:

- Green: total below 4, no High or Critical signals.
- Yellow: total 4 to 11, or one High signal, no Critical signal.
- Red: total 12 or above, any Critical signal, or two or more High signals.

Combination rule examples:

- Auth changed + env vars added = Red or strong Yellow depending on other evidence.
- `.env` found = Red.
- Many files deleted + tests deleted = Red.
- New payment dependency + webhook route = Red.
- Large export only = Yellow, unless combined with sensitive changes.

## 10.2 Confidence level

Each snapshot should include a confidence label:

- High: GitHub comparison and sufficient history available.
- Medium: GitHub comparison available but limited history.
- Low: zip-only or partial repository data.

Confidence should be shown quietly. It helps avoid overclaiming.

Example:

> Confidence: Medium. GitHub comparison was available, but this project has limited export history.

## 10.3 Top concern selection

The UI should show at most 3 to 5 top concerns first.

Prioritize by:

1. Critical signals.
2. High production-sensitive categories.
3. Unusual change size combined with sensitive categories.
4. Env/config signals.
5. Deleted tests/config.
6. Maintainability trends.

The full evidence can live in an expandable details panel or generated report.

# 11. Data model

This section gives a TypeScript-oriented shape. Exact names can change, but the concepts should remain stable.

## 11.1 ReadinessSnapshot

```ts
export interface ReadinessSnapshot {
  schemaVersion: 'b2g.prs.snapshot.v1';
  generatedAt: string;
  repository: RepositoryRef;
  base: GitRefSummary;
  candidate: CandidateExportSummary;
  comparison: ComparisonSummary;
  state: ReadinessStateSummary;
  categories: CategorySummary[];
  signals: ReadinessSignal[];
  trends?: TrendSummary[];
  outputs: SnapshotOutputRefs;
  limitations: string[];
}
```

## 11.2 Readiness state

```ts
export type ReadinessState = 'green' | 'yellow' | 'red';
export type SignalSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SnapshotConfidence = 'low' | 'medium' | 'high';

export interface ReadinessStateSummary {
  state: ReadinessState;
  confidence: SnapshotConfidence;
  internalScore: number;
  headline: string;
  recommendedAction: string;
  topConcerns: string[];
  safeLookingAreas: string[];
}
```

## 11.3 Signal object

```ts
export interface ReadinessSignal {
  id: string;
  category: ReadinessCategory;
  severity: SignalSeverity;
  title: string;
  message: string;
  evidence: EvidenceRef[];
  suggestedReview?: string;
  deterministic: true;
}
```

## 11.4 Category names

```ts
export type ReadinessCategory =
  | 'identity_access'
  | 'data_persistence'
  | 'secrets_config'
  | 'deployment_ops'
  | 'external_integrations'
  | 'public_surface'
  | 'testing_recovery'
  | 'maintainability'
  | 'change_history';
```

## 11.5 Evidence references

```ts
export interface EvidenceRef {
  kind: 'file' | 'dependency' | 'env_var' | 'route' | 'metric' | 'commit' | 'pattern';
  label: string;
  path?: string;
  before?: string | number | boolean;
  after?: string | number | boolean;
  redacted?: boolean;
}
```

## 11.6 Comparison summary

```ts
export interface ComparisonSummary {
  changedFiles: number;
  addedFiles: number;
  deletedFiles: number;
  renamedFiles?: number;
  addedLines?: number;
  deletedLines?: number;
  binaryFilesChanged: number;
  sensitiveFilesChanged: number;
  packageManifestChanged: boolean;
  lockfileChanged: boolean;
  envExampleChanged: boolean;
  routeSurfaceChanged: boolean;
}
```

# 12. Architecture proposal

## 12.1 Module layers

Recommended internal layers:

1. **Input adapters**
   - read zip;
   - fetch GitHub base tree;
   - fetch GitHub history;
   - load user settings.

2. **Normalization layer**
   - normalize paths;
   - ignore generated/vendor paths;
   - classify text vs binary;
   - compute hashes and line counts.

3. **Diff engine**
   - compare candidate file inventory with base file inventory;
   - calculate changed, added, deleted, and optionally renamed files;
   - compute line-level changes for text files.

4. **Detector layer**
   - path classifier;
   - dependency detector;
   - env detector;
   - secret heuristic detector;
   - public surface detector;
   - test/CI detector;
   - maintainability detector;
   - history baseline detector.

5. **Composer layer**
   - merge signals;
   - deduplicate evidence;
   - assign severities;
   - compute state and confidence;
   - select top concerns and safe-looking areas.

6. **Output layer**
   - UI summary;
   - export receipt Markdown;
   - ADC Fix handoff Markdown;
   - optional commit body content;
   - debug JSON.

## 12.2 Processing pipeline

Recommended pipeline:

```text
Bolt zip
  -> unzip and inventory
  -> fetch GitHub base tree
  -> normalize both inventories
  -> diff candidate vs base
  -> run static detectors
  -> fetch and analyze history if available
  -> compose readiness state
  -> render UI summary
  -> optionally generate receipt or handoff report
```

## 12.3 Browser-extension implementation notes

The module should assume browser-extension constraints:

- no shell access;
- no local git binary;
- no arbitrary code execution;
- memory limits for large zips;
- GitHub API rate limits;
- private repo token scope must be minimized;
- secrets must not be logged;
- long scans should be cancellable.

Design implications:

- Use streaming or staged file processing where possible.
- Apply ignore rules before expensive text diffing.
- Compute file hashes and line counts incrementally.
- Limit line-level diffs for very large files.
- Prefer deterministic regex and path matching in MVP.
- Cache GitHub history and base inventories carefully.

# 13. Path classification rules

## 13.1 Ignore rules

Ignore for source analysis, unless specifically needed as metadata:

- `node_modules/**`;
- `.git/**`;
- `dist/**`;
- `build/**`;
- `.next/**`;
- `.turbo/**`;
- `coverage/**`;
- `.cache/**`;
- `tmp/**`;
- `.DS_Store`;
- minified bundles where detected;
- large binary assets for line diffing.

Do not ignore lockfiles for dependency signals.

## 13.2 Sensitive path patterns

Initial pattern examples:

```text
Auth/access:
  **/auth/**
  **/middleware.*
  **/session*.*
  **/login/**
  **/signup/**
  **/admin/**
  **/protected*/**

Data/persistence:
  **/prisma/**
  **/drizzle/**
  **/migrations/**
  **/schema.*
  **/supabase/**
  **/firebase/**
  **/db/**
  **/database/**

Secrets/config:
  .env*
  **/.env*
  **/config/**
  next.config.*
  vite.config.*
  astro.config.*
  nuxt.config.*

Deployment/ops:
  .github/workflows/**
  vercel.json
  netlify.toml
  Dockerfile
  docker-compose.*
  wrangler.*

External integrations:
  **/stripe/**
  **/billing/**
  **/webhook/**
  **/email/**
  **/resend/**
  **/twilio/**

Tests/recovery:
  **/*.test.*
  **/*.spec.*
  **/__tests__/**
  playwright.config.*
  cypress.config.*
  vitest.config.*
```

## 13.3 Rule storage

Rules should live in data/config files rather than being scattered across implementation code. This makes them easier to test, version, and update.

Suggested structure:

```text
src/production-readiness/rules/path-rules.ts
src/production-readiness/rules/dependency-categories.ts
src/production-readiness/rules/env-patterns.ts
src/production-readiness/rules/secret-patterns.ts
src/production-readiness/rules/ignore-rules.ts
```

# 14. Report formats

## 14.1 UI summary layout

Recommended first screen:

```text
Production Readiness Snapshot: Yellow

This export touched production-sensitive areas.

Changed files: 42
Unusual size: 3.4x normal
Sensitive areas: auth, env/config, dependencies
New dependencies: 1
New env vars: 2
Deleted files: 3

Top concerns:
1. Auth-related file changed.
2. New env vars detected but .env.example was not updated.
3. This export is much larger than usual.

Safe-looking areas:
- No database migrations detected.
- No deployment config changes detected.
- Tests were not deleted.

Actions:
[View evidence] [Copy receipt] [Generate ADC Fix handoff]
```

## 14.2 Export receipt template

```md
# Bolt Export Receipt

Readiness: Yellow
Generated: 2026-07-06T21:00:00+08:00
Repository: owner/repo
Compared against: main@abc123
Candidate export: bolt-export-2026-07-06-001

## Summary

This export touched production-sensitive areas. Review before deploying.

## Change metrics

- Files changed: 42
- Files added: 8
- Files deleted: 3
- Lines added: 1,240
- Lines deleted: 530
- Sensitive files changed: 2

## Top concerns

1. Auth-related file changed: `src/lib/auth.ts`.
2. New env vars detected: `RESEND_API_KEY`, `VITE_SUPABASE_URL`.
3. Export size is 3.4x the project median.

## Safe-looking areas

- No database migrations detected.
- No deployment config changes detected.
- Test files were not deleted.

## Limitations

This is a static readiness snapshot. It does not run the app, execute tests, or prove correctness.
```

## 14.3 ADC Fix handoff report template

```md
# ADC Fix Handoff Report

## Repository

- Repository: owner/repo
- Base ref: main@abc123
- Candidate export: bolt-export-2026-07-06-001
- Compare URL: <GitHub compare URL>

## Readiness summary

State: Red
Confidence: High

This Bolt export appears production-sensitive because it modified auth,
environment configuration, public routes, and dependencies.

## Changed areas

### Identity and access

- `src/lib/auth.ts` changed.
- `middleware.ts` changed.

### Secrets and configuration

- New env vars: `RESEND_API_KEY`, `VITE_SUPABASE_URL`.
- `.env.example` was not updated.

### External integrations

- New dependency: `resend`.

### Public surface

- New API route: `/api/contact`.

## Historical context

- This export is larger than 87% of recent exports.
- `package.json` changed in 3 of the last 5 exports.
- `src/App.tsx` has grown from 420 to 1,247 lines.

## Suggested ADC Fix review areas

- Auth/session boundary.
- Env and secrets setup.
- API route behavior.
- Deployment readiness.
- Test coverage.
- Rollback/recovery.

## Limitations

Generated by deterministic static checks. No source code was uploaded by B2G.
```

## 14.4 Commit body integration

If B2G supports or later adds commit-body customization, the receipt can be appended to the commit body.

Suggested marker:

```text
[B2G-PRS]
Readiness: Yellow
Top concerns:
- Auth-related file changed.
- New env vars detected but .env.example was not updated.
- Export is 3.4x larger than usual.
[/B2G-PRS]
```

This marker can help future history parsing.

# 15. ADC Fix crossover

## 15.1 Crossover principle

The crossover should be thin, explicit, and user-initiated.

B2G should not become ADC Fix inside the extension. It should generate evidence. ADC Fix should remain the deeper review and repair path.

## 15.2 Good CTA language

Preferred:

> This export touched production-sensitive areas. Generate an ADC Fix handoff report for deeper review.

Preferred:

> This looks like a good candidate for a production-readiness review.

Preferred:

> This static snapshot is not a full audit. For deeper help, create a handoff report.

Avoid:

> Your app is broken. Hire ADC Fix.

Avoid:

> ADC Fix is required to continue.

Avoid:

> Your app is not production ready.

## 15.3 Privacy guardrails

The handoff feature must follow these rules:

- Never auto-upload source code.
- Never auto-upload the zip.
- Never auto-send reports to ADC Fix.
- Hide secret-like values.
- Show variable names and paths only.
- Let the user copy or download the handoff deliberately.
- Make external navigation to ADC Fix explicit.
- State the limitation that the snapshot is static and deterministic.

## 15.4 Product ecosystem fit

The ecosystem can be framed as:

```text
AI Driven Coder
  -> teaches production-readiness thinking for AI-built apps

Bolt to GitHub
  -> captures export history and readiness signals

ADC Fix
  -> helps diagnose and fix production-readiness blockers

MAID Runner
  -> prevents AI-code drift through manifest-driven validation
```

# 16. User settings

Suggested settings for later, not all required in MVP:

- enable/disable Production Readiness Snapshot;
- show snapshot before commit;
- include receipt in commit body;
- generate handoff report button visibility;
- custom ignored paths;
- custom sensitive paths;
- readiness threshold sensitivity: relaxed, normal, strict;
- store local snapshot history;
- include ADC Fix CTA: enabled/disabled;
- redact path names in handoff: enabled/disabled.

Default settings should be conservative:

- snapshot enabled;
- no auto-upload;
- receipt not automatically committed unless user opts in;
- ADC Fix handoff manual only;
- secrets redacted.

# 17. Error states and fallbacks

## 17.1 No GitHub comparison available

If the GitHub base cannot be fetched:

- produce zip-only inventory;
- show confidence as Low;
- skip historical comparison;
- still detect env files, package dependencies, route surface, large files, and secrets.

Example copy:

> GitHub comparison was unavailable, so this snapshot only inspected the exported zip.

## 17.2 First export or no history

If history is insufficient:

- compare against base HEAD only;
- do not claim unusual size;
- use fallback thresholds;
- show confidence as Medium if GitHub comparison succeeded.

Example copy:

> Not enough export history yet to judge whether this change is unusual.

## 17.3 Large zip or timeout

If scan is too large:

- inventory paths first;
- skip expensive line-level diffs for large files;
- report skipped files in limitations;
- still flag sensitive paths and `.env` files.

Example copy:

> Some large files were skipped for line-level diffing. Path and size signals were still analyzed.

## 17.4 API rate limit

If GitHub API rate limits occur:

- show partial snapshot;
- cache what was already fetched;
- provide retry action;
- do not block basic export unless the existing B2G flow requires GitHub access.

# 18. Testing strategy

The module is well-suited for fixture-driven tests.

## 18.1 Fixture types

Create small synthetic project fixtures:

1. UI-only change.
2. Auth file changed.
3. New env var without `.env.example` update.
4. `.env` file accidentally included.
5. New dependency added.
6. Package manifest changed without lockfile change.
7. New API route added.
8. Test files deleted.
9. Large component growth.
10. Large export compared with history.
11. New Stripe dependency plus webhook route.
12. Zip-only mode with no GitHub history.
13. Large binary assets.
14. Multiple package manager lockfiles.
15. False-positive secret-like sample that should be redacted but phrased cautiously.

## 18.2 Behavioral expectations

Tests should assert:

- correct file inventory;
- correct diff counts;
- correct path classification;
- env variable detection;
- secret values not included in output;
- dependency changes detected;
- route paths normalized;
- readiness state composition;
- top concerns ordering;
- limitations listed when data is missing;
- handoff report contains evidence but no secret values.

## 18.3 Golden snapshots

Use golden JSON snapshots for deterministic outputs. This fits MAID well because expected artifacts are explicit and machine-checkable.

Recommended artifacts:

```text
test/fixtures/prs/ui-only/
test/fixtures/prs/auth-env-change/
test/fixtures/prs/dependency-drift/
test/fixtures/prs/history-large-export/
test/golden/prs/*.snapshot.json
test/golden/prs/*.receipt.md
test/golden/prs/*.handoff.md
```

# 19. MAID epic source plan

## 19.1 Parent epic intent

Suggested parent epic slug:

`b2g-production-readiness-snapshot`

Suggested parent epic goal:

> Implement a deterministic Production Readiness Snapshot module for Bolt to GitHub that compares an exported Bolt project zip with GitHub repository state, detects production-sensitive change signals, presents a readiness summary in the extension, and can generate an optional ADC Fix handoff report without uploading source code.

## 19.2 Epic-level acceptance criteria

The parent epic should be considered complete when:

- B2G can analyze an exported Bolt zip before or during GitHub export.
- B2G can compare the zip with a GitHub base ref.
- B2G produces a structured `ReadinessSnapshot` object.
- The snapshot includes state, confidence, top concerns, safe-looking areas, evidence, and limitations.
- MVP detectors cover sensitive paths, dependencies, env vars, public routes, test/CI signals, maintainability signals, and history-based unusual change detection.
- The extension UI displays a clear Green, Yellow, or Red snapshot.
- The module can generate a Markdown export receipt.
- The module can generate a Markdown ADC Fix handoff report.
- Secret-looking values are never displayed in generated outputs.
- The implementation is covered by deterministic fixture tests.
- The module does not require LLM calls.
- The module does not auto-upload code or reports to ADC Fix.

## 19.3 Suggested child MAID manifests

Each child should be implementation-sized. Avoid combining UI, detector logic, GitHub integration, and report generation into one child manifest.

### Child 1: Domain model and fixture foundation

Slug:

`b2g-prs-domain-models-fixtures`

Goal:

- Add core TypeScript domain types, signal categories, severity types, fixture structure, and golden output test harness.

Behavioral test focus:

- Domain objects validate against expected schema.
- Golden snapshot fixture loader works.
- Secret redaction helper exists and is tested.

### Child 2: Zip inventory and normalization

Slug:

`b2g-prs-zip-inventory-normalization`

Goal:

- Parse exported Bolt zips into normalized file inventory with path normalization, ignore rules, file type detection, size, hash, and line counts.

Behavioral test focus:

- Zip fixture produces expected file inventory.
- Ignored paths are excluded from source analysis.
- Lockfiles are retained for dependency analysis.
- Binary files are detected and not line-diffed.

### Child 3: GitHub base inventory adapter

Slug:

`b2g-prs-github-base-inventory`

Goal:

- Fetch repository base tree and file metadata from GitHub for comparison with the zip inventory.

Behavioral test focus:

- Mock GitHub tree data becomes normalized inventory.
- Missing or rate-limited GitHub data produces a partial snapshot limitation.
- Base ref metadata is preserved.

### Child 4: Diff engine

Slug:

`b2g-prs-diff-engine`

Goal:

- Compare candidate zip inventory against GitHub base inventory and produce added, changed, deleted, and line-change metrics.

Behavioral test focus:

- Changed/added/deleted counts match fixtures.
- Line deltas are correct for text files.
- Large files can be skipped with limitations.
- Binary file changes are counted separately.

### Child 5: Sensitive path classifier

Slug:

`b2g-prs-sensitive-path-classifier`

Goal:

- Classify changed files into readiness categories using deterministic path rules.

Behavioral test focus:

- Auth, data, config, deployment, integration, route, and test paths classify correctly.
- Ignore rules do not hide lockfiles or relevant config.
- Classifier evidence includes category and path.

### Child 6: Dependency detector

Slug:

`b2g-prs-dependency-detector`

Goal:

- Detect dependency additions, removals, version changes, package manager conflicts, and dependency category introductions.

Behavioral test focus:

- `package.json` diffs are correct.
- New Stripe/Resend/Supabase/etc. packages produce categorized signals.
- Manifest/lockfile mismatch signals are generated.

### Child 7: Env and secret detector

Slug:

`b2g-prs-env-secret-detector`

Goal:

- Detect new environment variable references, `.env.example` coverage, `.env` files, and secret-looking values with redacted output.

Behavioral test focus:

- Env var patterns are detected across supported syntaxes.
- New env vars are compared with base.
- `.env.example` stale/missing signals appear.
- Secret values never appear in snapshot, receipt, or handoff output.

### Child 8: Public surface detector

Slug:

`b2g-prs-public-surface-detector`

Goal:

- Detect route, API, admin, upload, billing, webhook, login, signup, and dashboard surface changes using path and lightweight content heuristics.

Behavioral test focus:

- Next.js app/pages routes normalize to route paths.
- New API routes are detected.
- Admin/upload/webhook names produce appropriate signals.

### Child 9: Test, CI, and maintainability detector

Slug:

`b2g-prs-test-ci-maintainability-detector`

Goal:

- Detect test/CI readiness, deleted tests, large file thresholds, file growth, and backup/temp/copy files.

Behavioral test focus:

- Test scripts and test files are detected.
- Deleted tests produce signals.
- Files crossing line thresholds produce signals.
- Backup/temp filenames produce low or medium signals.

### Child 10: History baseline engine

Slug:

`b2g-prs-history-baseline-engine`

Goal:

- Analyze GitHub commit history or prior B2G snapshots to detect unusual change size, hotspots, dependency drift, and repeated sensitive-area churn.

Behavioral test focus:

- Median and percentile baselines work.
- Insufficient history produces limitations, not false claims.
- Hotspot files are identified from fixture history.
- Large export signal appears only when thresholds are met.

### Child 11: Readiness composer

Slug:

`b2g-prs-readiness-composer`

Goal:

- Combine detector outputs into final state, confidence, top concerns, safe-looking areas, and limitations.

Behavioral test focus:

- Green, Yellow, and Red fixture cases classify correctly.
- Critical signals force Red.
- Top concerns are ordered by severity and evidence.
- Safe-looking areas are not shown when data is unavailable.

### Child 12: Receipt and handoff report generator

Slug:

`b2g-prs-report-generators`

Goal:

- Generate Markdown export receipts and ADC Fix handoff reports from `ReadinessSnapshot`.

Behavioral test focus:

- Receipt matches golden Markdown.
- Handoff report matches golden Markdown.
- Reports include limitations.
- Reports never expose secret values.
- ADC Fix language is helpful, not coercive.

### Child 13: Extension UI panel

Slug:

`b2g-prs-extension-ui-panel`

Goal:

- Display readiness state, top metrics, top concerns, safe-looking areas, evidence drawer, and actions in the B2G extension.

Behavioral test focus:

- Green/Yellow/Red states render correctly.
- Partial snapshots render with confidence and limitations.
- Buttons invoke copy receipt and generate handoff actions.
- UI does not block existing export flow unless explicitly configured.

### Child 14: Commit body and history marker integration

Slug:

`b2g-prs-commit-marker-integration`

Goal:

- Optionally append compact PRS metadata to commit body and parse prior PRS markers from history.

Behavioral test focus:

- Commit marker format is generated correctly.
- Prior markers parse into history records.
- User setting controls whether marker is included.

### Child 15: End-to-end PRS fixtures

Slug:

`b2g-prs-e2e-fixtures-regression`

Goal:

- Add end-to-end fixture tests that run zip inventory, diff, detectors, composer, and reports together.

Behavioral test focus:

- UI-only export returns Green.
- Auth plus env export returns Yellow or Red as specified.
- Secret file export returns Red and redacts values.
- Large historical export returns Yellow/Red depending on category combination.

## 19.4 Suggested implementation order

Recommended sequence:

1. Domain model and fixtures.
2. Zip inventory and normalization.
3. GitHub base inventory.
4. Diff engine.
5. Sensitive path classifier.
6. Dependency detector.
7. Env and secret detector.
8. Readiness composer.
9. Receipt generator.
10. Extension UI summary.
11. Public surface detector.
12. Test/CI and maintainability detector.
13. History baseline engine.
14. ADC Fix handoff report.
15. Commit marker and richer history parsing.

This order creates visible value early while keeping the MVP manageable.

# 20. MVP definition

## 20.1 Minimum useful MVP

The smallest useful version should include:

- zip inventory;
- GitHub base comparison;
- changed/added/deleted metrics;
- sensitive path classifier;
- dependency diff;
- env var detector;
- `.env` file detection;
- basic readiness composer;
- UI summary;
- export receipt Markdown.

This MVP can already say:

> This export changed 38 files, touched auth and environment configuration, added 2 dependencies, and introduced 3 env vars. Review before deploying.

## 20.2 MVP plus thin ADC crossover

Add:

- Generate ADC Fix Handoff Report button;
- report template;
- privacy guardrails;
- no auto-upload;
- optional link to ADC Fix.

This keeps the crossover thin and useful.

## 20.3 Deferred improvements

Defer:

- dependency vulnerability lookup;
- AST-based route parsing;
- local test/build execution;
- cloud analysis;
- LLM explanation;
- auto-created GitHub issues;
- dashboard across many repos;
- team collaboration features.

# 21. Open decisions

These decisions can be resolved during manifest drafting or early implementation.

1. **Where should prior snapshots live?**
   - Local extension storage only for MVP?
   - Commit body markers?
   - Optional repo file under `.b2g/` later?

2. **Should the receipt be included in commits by default?**
   - Recommended: no. Make it opt-in.

3. **Should the UI block export on Red?**
   - Recommended: no for MVP. Warn clearly, but do not block unless the user enables strict mode.

4. **Should ADC Fix CTA be shown for all states?**
   - Recommended: show mainly on Yellow/Red, keep subtle on Green.

5. **Should history analyze all commits or only B2G commits?**
   - Recommended: prefer B2G markers if available, fallback to recent commits with confidence label.

6. **How configurable should rules be?**
   - Recommended: internal data-driven config first. User customization later.

# 22. Copy guidelines

## 22.1 Preferred terms

Use:

- production-sensitive;
- review before deploy;
- static snapshot;
- evidence;
- readiness signal;
- handoff report;
- safe-looking areas;
- limitations.

Avoid:

- broken;
- insecure;
- bad code;
- guaranteed;
- audit complete;
- AI review;
- vulnerability found, unless backed by a specific deterministic finding like `.env` file included.

## 22.2 Example states

Green:

> Mostly UI/content changes. No obvious production-sensitive areas changed.

Yellow:

> Production-sensitive areas changed. Review config, routes, dependencies, or tests before deploying.

Red:

> This export changed multiple production-sensitive areas or contains critical static signals. Do not blindly deploy.

# 23. Risk register for this module

## 23.1 False positives

The module may flag changes that are actually safe.

Mitigation:

- Use evidence-based language.
- Explain what changed, not what is broken.
- Allow users to expand details.
- Keep thresholds adjustable later.

## 23.2 False negatives

The module may miss real production problems.

Mitigation:

- Include limitations in every receipt.
- Avoid claiming full readiness.
- Encourage deeper review when the project is launch-bound.

## 23.3 Privacy mistakes

The scanner may encounter secrets.

Mitigation:

- Redact values at the lowest layer.
- Do not log raw file contents.
- Test redaction with fixtures.
- Never auto-upload code or report content.

## 23.4 Performance issues

Large zips or repos may be slow.

Mitigation:

- Apply ignore rules early.
- Skip line diff for large binaries or generated files.
- Use progress indicators.
- Cache GitHub inventories.
- Support partial snapshots.

## 23.5 Scope creep into ADC Fix

The extension may become overloaded with audit features.

Mitigation:

- Keep B2G focused on static evidence and readiness signals.
- Keep ADC Fix as the deeper service.
- Use the handoff report as the crossover boundary.

# 24. Definition of done for the parent epic

A parent epic implementation can be treated as done when:

- The module produces deterministic snapshots from fixture projects.
- The module works without LLM calls.
- The module compares a Bolt zip with GitHub base state.
- The module detects MVP production-sensitive signals.
- The module renders Green, Yellow, and Red states in the extension.
- The module generates Markdown receipt output.
- The module generates ADC Fix handoff output.
- Secret values are redacted in all outputs.
- Partial-data states are handled gracefully.
- Tests cover at least the fixture set listed in this document.
- Existing B2G export behavior remains intact.

# 25. Final recommended positioning

The module should be introduced as:

> Production Readiness Snapshot for Bolt to GitHub.

Short description:

> Before you push a Bolt export, see what changed, what production-sensitive areas were touched, and whether the export is unusual compared with your project history.

Longer description:

> B2G does not need to run an AI code review to make Bolt exports safer. It can create an evidence-based readiness trail from the exported zip and GitHub history. The snapshot highlights sensitive changes in auth, data, env vars, dependencies, deployment, routes, tests, and maintainability. When deeper help is needed, it can generate an ADC Fix handoff report without uploading source code automatically.

The core promise:

> Do not blindly deploy a Bolt export. First, get a production readiness snapshot.

================

Yes — I strongly agree with **teaser states over hard gates** for this module.

For B2G, the free version should not feel like:

> “We scanned your export. Pay to see anything.”

It should feel like:

> “Here is the basic production-readiness signal. Pro gives you the full evidence trail, history, receipts, and handoff workflow.”

That fits B2G much better because the extension already touches a sensitive workflow: source code, GitHub, exports, commits. A hard blank gate would feel untrustworthy.

## My recommended rule

**Free = orientation and basic safety signal.**
**Pro = depth, evidence, history, documentation, and workflow acceleration.**

In other words, do not gate the fact that something happened. Gate the deeper usefulness around understanding it, tracking it, documenting it, and acting on it.

## Free users should get “Snapshot Lite”

Free users should see enough to understand whether the export is boring, interesting, or production-sensitive.

I would include:

```text
Production Readiness Snapshot Lite

Status: Yellow
38 files changed
5 files added
2 files deleted

Sensitive areas touched:
- Configuration / env
- Dependencies
- Public routes

Full Production Readiness Snapshot is Pro.
```

Free should include these features:

| Feature                                       | Free? | Why                                         |
| --------------------------------------------- | ----: | ------------------------------------------- |
| Changed file count                            |   Yes | Basic orientation.                          |
| Added / modified / deleted counts             |   Yes | Makes the export understandable.            |
| Overall readiness state: Green / Yellow / Red |   Yes | This is the teaser anchor.                  |
| Sensitive categories touched                  |   Yes | Strong teaser without giving full evidence. |
| Top 1–2 general concerns                      |   Yes | Makes free useful.                          |
| Basic “review before deploy” language         |   Yes | Builds trust.                               |
| Critical safety warnings                      |   Yes | Should not be paywalled.                    |
| Pro CTA                                       |   Yes | Natural conversion point.                   |

The key is that free users should understand the **shape** of the issue, but not get the full diagnostic package.

## Critical warnings should never be fully gated

This is important.

If B2G detects something like:

- `.env` included in the export
- likely secret committed
- mass deletion spike
- lockfile/package mismatch
- GitHub workflow or deployment config deletion
- unusually destructive export

Then free users should still see enough to avoid damage.

Bad:

```text
Critical issue detected. Upgrade to Pro to view.
```

Better:

```text
Critical warning: A .env-like file appears in this export.
Do not commit secrets.

Pro unlocks the full evidence drawer and remediation checklist.
```

You can still gate the full detailed report, but do not hide the safety-critical fact itself. That is a trust-building decision.

## Pro should unlock the “Full Production Readiness Snapshot”

Pro should be where the module becomes genuinely powerful.

I would Pro-gate these:

| Feature                      | Pro? | Notes                                                                      |
| ---------------------------- | ---: | -------------------------------------------------------------------------- |
| Detailed concern list        |  Yes | Full list of detected concerns, grouped by readiness area.                 |
| Evidence drawer              |  Yes | File paths, rule IDs, diff context, affected sections.                     |
| History baseline             |  Yes | “This export is 4.2× larger than your usual export.”                       |
| Trend analysis               |  Yes | Dependency drift, file growth, churn, route growth.                        |
| Markdown receipt             |  Yes | Useful artifact for commits, issues, PRs, audits.                          |
| ADC Fix handoff report       |  Yes | Strong paid crossover.                                                     |
| Detailed dependency diff     |  Yes | Package names, version changes, category mapping.                          |
| Env/config report            |  Yes | Full env var list, `.env.example` mismatch, public/private classification. |
| Public route/API surface map |  Yes | Detailed route list and endpoint changes.                                  |
| Test/CI readiness details    |  Yes | Deleted tests, missing scripts, disabled checks, CI changes.               |
| Rollback/checkpoint guidance |  Yes | Compare links, previous export references, “last low-risk export.”         |
| Export history dashboard     |  Yes | Long-term retention feature.                                               |
| Saved snapshots              |  Yes | Gives users a reason to keep using B2G.                                    |

This makes Pro about **memory and evidence**, not just “more warnings.”

That is the right kind of paid value.

## The exact gating line I would use

### Free

```text
What changed?
What sensitive categories were touched?
Is this export Green, Yellow, or Red?
Is there any obvious critical stop sign?
```

### Pro

```text
Why did B2G classify it that way?
Which exact files caused the concern?
How unusual is this compared with my project history?
What should I review before deploying?
Can I save/share this as a receipt?
Can I generate an ADC Fix handoff?
```

That is a clean boundary.

## Suggested free vs Pro UI

### Free state

```text
Production Readiness Snapshot Lite

Yellow — Review before deploying

38 files changed
5 added · 31 modified · 2 deleted

Sensitive categories touched:
- Configuration / env
- Dependencies
- Public routes

1 critical warning:
- Possible env/config issue detected

Unlock Pro for:
- Full concern list
- Evidence drawer
- History baseline
- Markdown receipt
- ADC Fix handoff
```

### Pro state

```text
Production Readiness Snapshot

Yellow — Review before deploying

Main concerns:
1. New env vars detected but .env.example was not updated.
2. package.json and lockfile changed heavily.
3. New public API route added without nearby test coverage.
4. This export is 4.2× larger than your usual export.

Evidence:
- src/app/api/contact/route.ts
- package.json
- package-lock.json
- src/lib/env.ts

History:
- Largest export in the last 14 days
- package.json changed in 3 of the last 5 exports
- src/App.tsx grew by 420 lines since last export

Actions:
- Copy Markdown Receipt
- Create GitHub Issue
- Generate ADC Fix Handoff
```

That feels fair.

## I would avoid gating the normal B2G workflow

The core export-to-GitHub value should stay free, or at least stay available in whatever form users already expect.

Do not make users feel like:

> “The extension used to export my project, but now it mainly nags me to pay.”

So I would avoid gating:

- basic zip detection
- GitHub connection
- repository selection
- commit/push flow
- basic changed-file summary
- basic readiness state
- critical safety warnings

Pro should enhance the workflow, not interrupt it.

## Best Pro-gated features by conversion strength

If you want the strongest paid reasons, I would prioritize these first:

### 1. History baseline

This is probably the highest-value Pro feature.

```text
This export changed 62 files.
Your normal export changes 11 files.
This is 5.6× larger than usual.
```

Generic stats are nice. Project-relative stats feel intelligent.

### 2. Evidence drawer

This turns the scanner from a badge into a tool.

```text
Concern: Env/config changed

Evidence:
- src/lib/env.ts references RESEND_API_KEY
- .env.example was not updated
- package.json added resend
```

### 3. Markdown receipt

This gives users an artifact.

```text
Copy receipt
Save to repo
Add to commit body
Create GitHub issue
```

Receipts are very aligned with your “flight recorder” concept.

### 4. ADC Fix handoff

This is the ecosystem bridge.

Free can show the CTA, but Pro should generate the proper structured report.

```text
Generate ADC Fix Handoff Report
```

The free version could still have:

```text
This export may be a good candidate for deeper review.
```

But the full handoff document should be Pro.

### 5. Trend dashboard

This creates retention.

```text
Dependency count over time
Largest files
Churn hotspots
Export size history
Sensitive-change frequency
```

This gives users a reason to keep using the extension after the first push.

## One nuance: ADC Fix handoff could have two levels

I would probably do this:

### Free

```text
Copy basic summary for ADC Fix
```

This includes:

- readiness state
- changed file count
- sensitive categories touched
- basic warning count

### Pro

```text
Generate full ADC Fix Handoff Report
```

This includes:

- detailed concerns
- evidence paths
- historical baseline
- route/env/dependency changes
- suggested review areas
- GitHub compare link
- Markdown export

That keeps the funnel open without giving away the full paid value.

## Should B2G stay open-source?

My answer: **yes, but as open-core / trust-first, not necessarily with every Pro capability fully open.**

B2G touches source code, GitHub, and project exports. Open source gives you a major trust advantage. Users can inspect what the extension does, especially around GitHub permissions and whether code is uploaded anywhere. That matters even more if you later add production-readiness scanning.

But there is a practical monetization issue:

> If all Pro logic lives entirely in an open-source browser extension, Pro gating is mostly an honor system.

A motivated user can build from source and bypass the UI lock. That may be fine at small scale, but you should be aware of it.

## The model I would use

Keep this open-source:

```text
B2G Core
- Bolt export detection
- GitHub push workflow
- Basic diff summary
- Snapshot Lite
- Rule engine interfaces
- A basic public set of readiness rules
- Critical warning detection
- Privacy-first local scanning model
```

Keep this paid/private or service-backed:

```text
B2G Pro
- License/account system
- Full evidence drawer
- Historical baseline engine
- Saved snapshot history
- Markdown receipt generator
- ADC Fix handoff generator
- Advanced rule packs
- GitHub issue/PR comment automation
- Team/project dashboard later
```

That gives you the best of both worlds:

- open-source trust
- free utility
- paid depth
- ADC Fix crossover
- no hard blank gate

## I would not close-source the existing extension abruptly

If B2G is already open-source, I would avoid suddenly making the existing value closed.

Better:

```text
B2G remains open-source.
The new Production Readiness Snapshot Lite is included.
B2G Pro adds deeper evidence, history, receipts, and handoff workflows.
```

That feels additive rather than extractive.

It also aligns with your broader ecosystem: MAID Runner as open-source prevention infrastructure, B2G as open-source export/readiness trail, and ADC Fix as the deeper paid diagnosis/repair path.

## Payment/licensing note

Chrome Web Store’s old native paid-extension and in-app-purchase flow is no longer the path; Google’s own deprecation notes say developers affected by Chrome Web Store Payments needed to migrate to another payment processor and another way to track licenses, and the timeline says new paid extensions/in-app items were permanently disabled back in 2020. ([GitHub][1])

So B2G Pro would likely need your own license system, Stripe/Lemon Squeezy/Paddle-style checkout, or a small backend that validates entitlement. Also, because the extension handles user/project/GitHub-related data, keep permissions narrow, disclose data handling clearly, and avoid automatic code upload; Chrome’s policies emphasize accurate privacy disclosures, limited user-data use, narrow permissions, and transparency around data practices. ([Chrome for Developers][2])

## My recommended final packaging

I would package it like this:

### B2G Free

**Export Bolt to GitHub with a basic production-readiness teaser.**

Includes:

- GitHub export flow
- changed file count
- added/modified/deleted summary
- Green/Yellow/Red state
- sensitive categories touched
- critical warning visibility
- Pro CTA

### B2G Pro

**Full Production Readiness Snapshot for serious AI-built apps.**

Includes:

- detailed concerns
- evidence drawer
- history baseline
- dependency/env/route/test reports
- Markdown receipt
- GitHub issue/PR handoff
- ADC Fix handoff report
- saved snapshot history

### ADC Fix

**Deep production-readiness review and repair path.**

Includes:

- human/LLM-assisted diagnosis
- prioritized launch blockers
- concrete fix plan
- implementation guidance or done-for-you repair

## The product line should be this

```text
B2G Free:
“Did this export touch anything production-sensitive?”

B2G Pro:
“Show me exactly what changed, why it matters, and give me a receipt.”

ADC Fix:
“Help me fix the production-readiness problems before launch.”
```

That is a clean ladder.

My strongest recommendation: **keep B2G open-source at the core, add Snapshot Lite to free, and make Pro about evidence/history/artifacts/handoff — not basic safety.**

[1]: https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/docs/webstore/cws-payments-deprecation/index.md 'developer.chrome.com/site/en/docs/webstore/cws-payments-deprecation/index.md at main · GoogleChrome/developer.chrome.com · GitHub'
[2]: https://developer.chrome.com/docs/webstore/program-policies/policies 'Chrome Web Store - Program Policies  |  Chrome for Developers'
