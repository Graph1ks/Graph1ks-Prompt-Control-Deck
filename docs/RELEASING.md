# Releasing

## Release principles

Releases must be reproducible from repository source and bundled factory assets.

The repository contains the real maintainable extension source directly. Do not rely on bootstrap/materialization workflows to reconstruct normal source files.

Use docs/RELEASE_CHECKLIST.md as the operational release gate.

## Version bump checklist

Only bump the extension version when explicitly requested.

For a normal application release, synchronize the active application version in:

- manifest.json;
- APP_VERSION in deck.js;
- EXT_VERSION in content.js;
- data-g1-version in deck.html;
- README current-version references where appropriate;
- CHANGELOG.md.

Do not rewrite historical release headings or old version references just because a new version is being prepared.

Do not automatically change FACTORY_RELEASE. That marker follows the factory-data release, not every UI/code patch.

## Required validation

Before publishing a ZIP/release:

1. Confirm CI is green on the exact source commit.
2. Run python scripts/repo_audit.py.
3. Parse manifest.json successfully.
4. Run JavaScript syntax checks.
5. Confirm there are no duplicate HTML IDs.
6. Verify Dark and Light appearance manually for UI-affecting changes.
7. Verify core Public/Private Vault behavior for data/storage changes.
8. Verify Retrieve and Fill behavior for Suno-integration changes.
9. Verify FILL MORE OPTIONS and supported Advanced Options when their code changed.
10. Confirm the gzip Public Vault can be decompressed and parsed.
11. Confirm Genre Map JSON parses and is the intended taxonomy revision.
12. Confirm reference_artist/reference_song remain outside the Suno generation/autofill path.
13. Confirm the release archive contains no scratch files, bootstrap parts, local reports, secrets, or uncompressed Public Vault duplicate.
14. Run an archive integrity test after building the ZIP.

For data, licensing, permission, dependency, or security-sensitive releases, complete the corresponding sections in docs/RELEASE_CHECKLIST.md.

## Expected release contents

A normal unpacked/release package contains the extension runtime source and required assets, including:

~~~text
manifest.json
background.js
content.js
deck.html
deck.css
deck.js
i18n.js
theme-preload.js
icons/
data/GRAPH1KS_GENRE_MAP_FACTORY.json
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
~~~

Repository-only governance/development documentation does not need to be included in the extension ZIP unless intentionally distributed.

## Factory data

The canonical Public Vault release format is gzip-compressed JSON:

data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz

Do not include an uncompressed duplicate unless there is an explicit compatibility requirement.

Factory-data updates require additional care because they can trigger seed/migration behavior. Verify existing Private Vault data remains untouched and keep provenance documentation current.

## Changelog

Keep release notes concise and user-oriented while preserving enough technical detail for maintainers.

Historical changelog sections should remain immutable except for factual corrections.

CHANGELOG.md is curated release/product history, not a commit dump.

## Repository and licensing gate

Before release:

- public repository mode must still match PROJECT.md;
- public PolyForm Noncommercial and commercial-license language must remain consistent;
- no community-contribution/CLA workflow should exist unless the owner explicitly changed the repository model;
- third-party rights must not be represented as rights granted by Graph1ks.

## GitHub release strategy

Prefer one coherent release-preparation change set rather than many tiny release-only branches.

Tag/release from the validated commit intended for distribution.
