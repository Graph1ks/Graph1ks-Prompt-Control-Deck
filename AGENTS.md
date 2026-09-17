# AGENTS.md

This repository is the authoritative project source for GRAPH1KS Prompt Control Deck.

Any automated coding agent or contributor working on this repository must follow these rules.

## 1. Read project state before editing

Before making changes, inspect at minimum:

1. `AGENTS.md`
2. `README.md`
3. `CHANGELOG.md`
4. `docs/HANDOVER.md` when present
5. the files directly involved in the requested change

Do not reconstruct project state from old chats, guesses, or stale release artifacts when the repository contains newer information.

## 2. Versioning

- Never bump the extension version unless explicitly requested.
- When a version bump is requested, keep `manifest.json`, runtime version constants, documentation and release naming consistent.
- Do not rewrite historical changelog headings when bumping a current version.
- Factory-data version markers must only change when the corresponding factory data actually changes.

## 3. Preserve working behavior

Bug fixes must be narrowly scoped when possible.

Do not redesign or remove unrelated functionality while fixing another issue. In particular, preserve:

- Public and Private Vault behavior;
- Suno Retrieve and Autofill flows;
- manual Editor/Draft workflows;
- DE/EN support;
- Dark and Light modes;
- persisted user settings;
- pop-out / overlay behavior;
- local-first storage assumptions;
- guided onboarding unless intentionally changed.

## 4. UI regressions are bugs

Existing compact layouts, control widths, metadata chips, spacing and responsive behavior should not be changed accidentally by broad CSS overrides.

When changing theme CSS:

- verify Dark and Light independently;
- avoid selectors that unintentionally override component-specific layout rules;
- preserve contrast for text, buttons, badges and disabled states;
- keep compact Suno metadata chips readable and visually bounded;
- ensure sidebar primary controls retain intended full-width or grid placement.

## 5. Suno integration

Suno's UI may vary by locale and DOM revision.

When reading or filling Suno controls:

- prefer robust structural/ARIA/label matching over brittle text-only selectors;
- support German and English labels where the project already does so;
- avoid destructive DOM manipulation;
- do not auto-select stored Voice entries unless the feature explicitly supports it;
- preserve existing mouse/slider interaction techniques that are known to work.

## 6. Factory data

The canonical bundled factory assets are expected under `data/`.

Primary files:

- `data/GRAPH1KS_GENRE_MAP_FACTORY.json`
- `data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz`

Rules:

- do not add an uncompressed duplicate of the Public Vault unless explicitly requested;
- treat `.json.gz` as a first-class runtime asset;
- client-side gzip decompression is expected in supported Chromium versions;
- factory imports/migrations must not destroy user-created Private Vault data;
- genre-map replacement/import must validate schema and canonical mappings before committing changes;
- treat `reference_artist` and `reference_song` as provenance/catalog metadata only, not as generation instructions;
- do not inject `reference_artist` or `reference_song` into song-generation prompts unless Graph1ks explicitly changes this architecture after reviewing the associated rights implications;
- inside `instrumental_arrangement`, terms such as `source`, `original motif`, `original register`, or similar wording refer to the generated structured prompt/concept established inside that entry, not to the commercial reference recording;
- do not add unlicensed lyrics, audio, notation, artwork, copied reviews, raw chart histories, or third-party bulk datasets merely because they are publicly accessible;
- keep `docs/DATA_PROVENANCE.md` accurate when the research or generation pipeline changes materially.

## 7. Privacy and network behavior

Do not introduce any of the following without explicit approval:

- analytics;
- telemetry;
- advertising;
- remote code execution;
- hidden API calls;
- cloud synchronization;
- background tracking;
- collection of user prompts, lyrics or Vault contents.

New permissions in `manifest.json` require explicit justification.

## 8. Dependencies

Prefer the browser platform and small local helpers over dependencies.

Do not add a package manager, framework, build system or runtime dependency solely for convenience when the existing extension can remain dependency-free.

## 9. Validation before release

Before claiming a build is ready, validate as applicable:

- `manifest.json` parses successfully;
- all JavaScript files pass syntax checks;
- duplicate HTML IDs are absent;
- expected version strings are consistent;
- the release archive passes an integrity test;
- the release archive does not contain accidental backups, scratch files or uncompressed duplicate factory data;
- Dark and Light modes both render correctly;
- core Vault / Retrieve / Fill flows are not obviously broken.

## 10. Licensing and contributions

Do not change, replace or weaken the licensing model without explicit instruction from Graph1ks.

Public licensing is PolyForm Noncommercial License 1.0.0. Commercial rights are handled separately.

External code contributions require acceptance of `CLA.md` before merge.

## 11. Releases and automation

GitHub Actions or other CI may be used when explicitly useful, but the repository must not depend on CI merely to materialize the real source tree.

The committed repository should contain the actual maintainable extension source directly.

## 12. Branching, batching and CI economy

Default to one working branch per coherent task, feature, bug-fix batch or release batch — not one branch per file or tiny edit.

- Bundle closely related changes together when they belong to the same requested task.
- Do not create a new branch for each minor CSS tweak, documentation correction or follow-up fix.
- Create a separate branch only when isolation is useful: a distinct feature, risky experiment, independent bug, release line, or when repository protection/review rules require it.
- If Graph1ks explicitly asks for direct work on `main`, straightforward maintenance may be committed directly to `main` without creating a branch.
- Prefer one PR per coherent unit of work. Multiple sensible commits inside that PR are fine.
- Do not trigger or re-run CI merely to show progress. Validate locally first when practical.
- CI workflows should normally run on pull requests and `main`, not on every arbitrary branch push.
- Use path filters so documentation-only changes do not run extension validation unnecessarily.
- Use `concurrency` with `cancel-in-progress: true` for PR validation so outdated runs are cancelled when a newer commit supersedes them.
- Avoid duplicate workflows that validate the same thing on both branch push and pull request unless there is a specific reason.

## 13. Public identity and repository privacy

This is a public repository. Maintainer-authored Git commits must not expose a private e-mail address.

- Use `Graph1ks <213925530+Graph1ks@users.noreply.github.com>` for maintainer-authored Author and Committer identity.
- GitHub-generated `GitHub <noreply@github.com>` metadata is acceptable where GitHub itself is the committer.
- Never commit `.env` files, credentials, tokens, private keys, browser/session data, local databases, machine-specific absolute paths, local Downloads, generated reports, debug dumps, personal-data exports, or release/scratch archives that do not belong in source control.
- Before making a private/local repository public, audit advertised branches, tags, commit metadata and all reachable historical blobs — not only the current working tree.
- If an actual credential is ever committed, removing the file is insufficient: rotate or revoke the credential immediately and purge it from reachable Git history.
- Do not reintroduce rewritten/private history by pushing an old local clone after a public-history reset; re-clone or explicitly reset the local repository to the new public root first.
