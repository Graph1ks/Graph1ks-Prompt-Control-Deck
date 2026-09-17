# Project Handover

## Authoritative repository

`Graph1ks/Graph1ks-Prompt-Control-Deck` is the authoritative project source for future work.

Agents and contributors must read `AGENTS.md` first and use repository state rather than reconstructing project state from old conversations or stale release packages.

## Current baseline

Current development baseline: **v1.3.4**.

The real extension source is now committed directly to `main`, together with the canonical factory assets and project documentation. No bootstrap/materialization workflow is required for normal development.

## Repository status

Present and authoritative on `main`:

```text
manifest.json
background.js
content.js
deck.html
deck.css
deck.js
i18n.js
theme-preload.js
icons/
data/
docs/
.github/workflows/ci.yml
```

The one-time v1.3.4 import workflow removed itself after successfully materializing the source. The earlier Actions smoke-test workflow has also been removed.

## Factory data

Canonical bundled assets:

```text
data/GRAPH1KS_GENRE_MAP_FACTORY.json
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

The Public Vault remains gzip-compressed in the repository and release package. The runtime references that exact `.json.gz` asset and uses browser-native decompression support.

Do not add an uncompressed duplicate unless explicitly required for compatibility.

## Current v1.3.4 behavior/fixes

The v1.3.4 baseline includes:

- gzip Public Vault factory loading;
- compact Suno metadata-chip presentation;
- restored full-width `FILL MORE OPTIONS` sidebar placement;
- Dark/Light regression cleanup;
- persistent DE/EN and theme behavior from the 1.3.x series;
- guided onboarding and existing Vault/Retrieve/Fill workflows.

## CI

Permanent validation lives at:

```text
.github/workflows/ci.yml
```

The first permanent validation run completed successfully.

CI currently checks:

- Manifest V3 structure and required files;
- synchronized app version markers;
- JavaScript syntax;
- duplicate HTML IDs;
- Genre Map JSON validity;
- gzip Public Vault JSON validity;
- icon PNG signatures;
- runtime gzip factory references/decompression support;
- full-width `FILL MORE OPTIONS` regression guard;
- absence of bootstrap/scratch/uncompressed factory artifacts.

CI runs on relevant source/data changes to `main`, relevant pull requests and manual dispatch. Documentation-only commits are excluded by path filters. Stale runs are cancelled through workflow concurrency settings.

## Development workflow

Do not create a branch for every tiny change.

Bundle related work into one coherent branch/PR when isolation is useful. Follow-up fixes belonging to the same task should remain in that task's branch/PR until complete. Small owner-authorized maintenance may go directly to `main`.

See `docs/DEVELOPMENT.md`.

## Release discipline

Before publishing a release:

- keep active application-version markers synchronized;
- do not rewrite historical changelog versions;
- change factory release markers only when factory data actually changes;
- require green CI on the intended source commit;
- perform manual Chromium/Suno testing for integration/UI changes;
- verify release ZIP integrity and contents;
- do not include scratch/bootstrap material or an uncompressed Public Vault duplicate.

See `docs/RELEASING.md`.

## Licensing model

- Public/noncommercial: PolyForm Noncommercial License 1.0.0.
- Commercial use: separate written license from Graph1ks.
- External code contributions: CLA acceptance required before merge.

Do not weaken or replace this licensing model without explicit instruction from Graph1ks.

## Next development action

Future work should start from the current `main` branch and the documented v1.3.4 baseline. For each new task:

1. read `AGENTS.md` and this handover;
2. inspect the directly affected source files;
3. keep the change scoped/batched coherently;
4. run local checks where practical;
5. rely on the permanent CI workflow for repository-level validation;
6. update `CHANGELOG.md` and this handover when project state materially changes.
