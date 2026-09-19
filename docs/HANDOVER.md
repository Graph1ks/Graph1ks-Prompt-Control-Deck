# Project Handover

This document contains the durable context required to continue GRAPH1KS Prompt Control Deck without relying on prior chat history.

## Current objective

Maintain the v1.3.4 runtime baseline while continuing development under a public, owner-controlled solo-development model with explicit privacy, provenance, licensing, and continuity rules.

## What was just completed

Repository governance was aligned with the shared Graph1ks repository template without changing extension runtime behavior.

The alignment adds:

- PROJECT.md as the durable project contract;
- STATUS.md as compact operational state;
- docs/DECISIONS.md for durable engineering decisions;
- docs/REPOSITORY_VISIBILITY.md for the public solo-development model;
- docs/DEPENDENCY_REVIEW.md and docs/RELEASE_CHECKLIST.md;
- scripts/repo_audit.py as the reusable publication/privacy audit;
- explicit conversation-to-repository hygiene;
- explicit user-trigger-only behavior for Issues/public feedback;
- removal of the external-contribution/CLA workflow.

## Current implementation state

Current runtime baseline: **v1.3.4**.

The real extension source and canonical factory assets are committed directly to the repository.

Primary runtime behavior remains:

- gzip Public Vault loading;
- Public and Private Vault workflows;
- Suno Retrieve/Fill integration;
- manual Editor/Draft workflows;
- compact Suno metadata chips;
- full-width FILL MORE OPTIONS sidebar placement;
- Dark/Light appearance;
- DE/EN behavior;
- guided onboarding and persisted local settings.

No runtime feature is intentionally changed by the governance migration.

## Important files / entry points

Runtime:

- manifest.json
- background.js
- content.js
- deck.html
- deck.css
- deck.js
- i18n.js
- theme-preload.js

Factory data:

- data/GRAPH1KS_GENRE_MAP_FACTORY.json
- data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz

Project/continuity:

- AGENTS.md
- PROJECT.md
- STATUS.md
- docs/DECISIONS.md
- docs/ARCHITECTURE.md
- docs/DATA_PROVENANCE.md
- docs/DEVELOPMENT.md
- docs/RELEASING.md
- scripts/repo_audit.py
- .github/workflows/ci.yml

## Decisions already made

- Repository mode is PUBLIC — owner-controlled solo development.
- External code contributions are not accepted by default.
- Issues are feedback/input only and are not an automatic AI-agent work queue.
- Public terms remain PolyForm Noncommercial License 1.0.0 with separate written commercial licensing.
- The product remains local-first and dependency-light.
- Public Vault stays gzip-compressed.
- reference_artist and reference_song remain provenance/catalog metadata, not generation inputs.
- Version bumps happen only when explicitly requested.

See docs/DECISIONS.md for durable rationale.

## Known problems / risks

- Suno is an external UI integration and selectors can break when Suno changes DOM structure or localization.
- Browser-interaction changes still require real Chromium/Suno smoke testing; static CI cannot fully verify live integration.
- GitHub-host settings such as Wiki and Projects cannot be enforced by repository files. PROJECT.md defines the target policy and host settings should be verified after changes.
- Factory-data changes require additional provenance, migration, and user-data care.

## Next concrete work

Work only on the next task explicitly requested by Graph1ks.

Do not proactively scan Issues or public feedback for implementation work.

For each new task:

1. read AGENTS.md, PROJECT.md, STATUS.md, and this handover;
2. inspect affected code/data and relevant decisions/docs;
3. make one coherent change;
4. run the applicable local checks and repository audit;
5. verify live Chromium/Suno behavior when required;
6. update STATUS.md, this handover, decisions, and changelog when project state materially changes.

## Verification

### Commands

Repository/publication audit:

~~~bash
python scripts/repo_audit.py
~~~

JavaScript syntax:

~~~bash
node --check background.js
node --check content.js
node --check deck.js
node --check i18n.js
node --check theme-preload.js
~~~

Manifest:

~~~bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
~~~

Public Vault gzip:

~~~bash
python -c "import gzip,json; json.load(gzip.open('data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz','rt',encoding='utf-8')); print('public vault ok')"
~~~

### Expected result

- publication audit passes;
- JavaScript syntax checks pass;
- manifest parses;
- gzip Public Vault parses;
- repository CI is green on the intended source commit;
- manual UI/Suno checks pass when relevant to the change.

## Important context / traps

- Do not bump the app version while performing unrelated maintenance.
- Do not mirror every app release into FACTORY_RELEASE.
- Do not add an uncompressed Public Vault copy.
- Do not reintroduce community-contribution/CLA language unless the repository model explicitly changes.
- Do not persist raw user/AI conversations as project history.
- Do not infer current behavior from old release packages or chats when repository source is newer.

## Local / generated state

Local browser profiles, extension state, Vault contents, logs, generated reports, scratch archives, and machine-specific paths are not authoritative repository state and should not be committed unless explicitly required, sanitized, and appropriate for publication.

## Resume instruction

A new developer or AI agent should:

1. read AGENTS.md;
2. read PROJECT.md;
3. read STATUS.md;
4. read this handover;
5. read docs/DECISIONS.md plus the relevant domain docs;
6. inspect current code/data and verification before editing.

If this handover conflicts with current code/tests, reproducible repository state is authoritative. Correct the handover as part of the next coherent work chunk.
