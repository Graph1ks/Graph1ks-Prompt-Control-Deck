# PROJECT.md

## Product

**Name:** GRAPH1KS Prompt Control Deck  
**Type:** Chrome/Chromium extension  
**Current baseline:** v1.3.4  
**Primary mode:** local-first Suno/Vault workflow  
**Changelog:** enabled

## Repository mode

**Repository visibility:** public  
**Collaboration mode:** owner-controlled solo development  
**External code contributions:** not accepted  
**Issues:** enabled for bug reports, suggestions, compatibility reports, and user feedback  
**Discussions:** disabled  
**Community inbox behavior:** user-triggered only for AI agents  
**Wiki:** disabled by policy unless explicitly needed  
**Projects:** disabled by policy unless explicitly needed  
**Pages:** disabled

Public visibility is not an invitation to contribute code. Forking or opening a pull request does not create a review or merge obligation.

GitHub-host settings that cannot be enforced from repository files must be verified against this policy.

## Scope

### In scope

- Public and Private Vault workflows;
- Suno retrieve and autofill integration;
- manual Editor/Draft workflows;
- DE/EN user interface;
- Dark/Light appearance;
- local persisted settings and user data;
- popup, overlay, and pop-out surfaces;
- bundled factory data and provenance controls;
- dependency-light browser-native implementation.

### Explicitly out of scope unless the owner changes direction

- analytics, advertising, telemetry, or background tracking;
- cloud synchronization or collection of prompts, lyrics, or Vault contents;
- required paid APIs, SaaS, or hosted infrastructure;
- community-governed development;
- unsolicited external code contributions;
- framework/build-system adoption solely for convenience.

## Engineering targets

- Preserve user data and existing workflows across changes.
- Prefer focused fixes over broad rewrites.
- Treat UI regressions as bugs.
- Keep live Suno integration resilient to locale and moderate DOM variation.
- Keep the extension runnable directly from the committed source tree.
- Keep required production operation genuinely zero-cost.

## Architecture

The extension uses Manifest V3 and browser-native APIs. Runtime source is committed directly in the repository.

Authoritative architecture documentation: docs/ARCHITECTURE.md.

### Architecture constraints

- Public Vault remains gzip-compressed at data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz.
- Factory imports/migrations must not destroy user-created Private Vault data.
- reference_artist and reference_song remain provenance/catalog metadata and must not become generation/autofill inputs without an explicit architecture and rights review.
- No hidden remote execution, telemetry, or data collection.

## Cost policy

Required development, build, validation, distribution, and normal production use must remain zero-cost.

A free tier is not automatically acceptable if realistic intended use can create unavoidable charges.

Optional paid integrations require explicit owner approval and must not become necessary for the core product.

## Licensing strategy

### Code

**Public terms:** PolyForm Noncommercial License 1.0.0  
**Commercial use:** separate written commercial license from Graph1ks  
**Source model:** public source, noncommercial public license, separate commercial rights

Do not weaken or replace this model without explicit owner instruction.

### Data / models / assets

Factory data and project-authored assets are covered only to the extent Graph1ks owns or is entitled to license the relevant rights.

Third-party names, titles, trademarks, facts, recordings, compositions, lyrics, artwork, databases, and other third-party material retain their own rights.

Authoritative provenance policy: docs/DATA_PROVENANCE.md.

### Contribution model

This is a solo-development repository.

External code contributions are not accepted. No CLA/DCO workflow is active or required.

Issues may be used for feedback and bug reports. They are not roadmap commitments and do not authorize an AI agent to act unless the owner explicitly requests analysis, response, triage, or implementation.

## Dependency policy

Prefer browser/platform capabilities and small local helpers.

Before adding a non-trivial dependency, review:

1. technical necessity;
2. zero-cost status;
3. license compatibility;
4. maintenance/security posture;
5. dependency and transitive weight;
6. portability and removal cost.

Use docs/DEPENDENCY_REVIEW.md for non-trivial or difficult-to-remove additions.

## Data sources

External datasets, research sources, or assets require an explicit rights/provenance review before redistribution.

Record source, applicable terms, commercial-use status, redistribution status, attribution needs, and material privacy implications.

See docs/DATA_PROVENANCE.md.

## Security/privacy

The product is local-first.

Do not introduce analytics, telemetry, advertising, hidden network calls, cloud synchronization, prompt/lyrics collection, or expanded browser permissions without explicit owner approval.

Never commit credentials, private keys, session material, private user data, unnecessary personal identifiers, or machine-specific private paths.

Persist project decisions and engineering facts, not raw user/AI conversations.

See SECURITY.md.

## QA / release gate

Applicable changes must pass:

- relevant local syntax/static checks;
- repository CI;
- targeted functional checks;
- Dark/Light and DE/EN checks when affected;
- Chromium/Suno smoke testing when integration behavior changes;
- data/provenance validation when factory data changes;
- privacy/publication audit;
- release archive integrity checks for releases.

See docs/RELEASE_CHECKLIST.md and docs/RELEASING.md.

## Continuity

- STATUS.md is the compact current operational truth.
- docs/HANDOVER.md contains durable continuation context.
- docs/DECISIONS.md records expensive-to-rediscover decisions.
- CHANGELOG.md records meaningful product/release history.
- Git remains the complete technical history.

A competent developer or AI agent must be able to resume from repository state without prior chat history.

## Current priorities

1. Preserve the stable v1.3.4 baseline while changes continue.
2. Keep repository governance aligned with owner-controlled solo development.
3. Maintain privacy, provenance, and local-first boundaries.
4. Avoid process or dependency overhead that does not improve product quality.
