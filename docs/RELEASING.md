# Releasing

## Release principles

Releases should be reproducible from the repository source and bundled factory assets.

The repository must contain the real maintainable extension source directly. Do not rely on bootstrap/materialization workflows to reconstruct normal source files.

## Version bump checklist

Only bump the extension version when explicitly requested.

For a normal application release, synchronize the active application version in:

- `manifest.json`;
- `APP_VERSION` in `deck.js`;
- `EXT_VERSION` in `content.js`;
- `data-g1-version` in `deck.html`;
- README current-version references where appropriate;
- `CHANGELOG.md`.

Do not rewrite historical release headings or old version references just because a new version is being prepared.

Do not automatically change `FACTORY_RELEASE`. That marker should follow the factory-data release, not every UI/code patch.

## Required validation

Before publishing a ZIP/release:

1. Confirm CI is green on the exact source commit.
2. Parse `manifest.json` successfully.
3. Run JavaScript syntax checks.
4. Confirm there are no duplicate HTML IDs.
5. Verify Dark and Light appearance manually for UI-affecting changes.
6. Verify core Public/Private Vault behavior for data/storage changes.
7. Verify Retrieve and Fill behavior for Suno-integration changes.
8. Verify `FILL MORE OPTIONS` and supported Advanced Options when their code changed.
9. Confirm the gzip Public Vault can be decompressed and parsed.
10. Confirm the Genre Map JSON parses and is the intended taxonomy revision.
11. Confirm the release archive contains no scratch files, bootstrap parts or uncompressed duplicate Public Vault.
12. Run an archive integrity test after building the ZIP.

## Expected release contents

A normal unpacked/release package should contain the extension runtime source and required assets, including:

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
data/GRAPH1KS_GENRE_MAP_FACTORY.json
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

Repository-only governance/development documentation does not need to be included in the extension ZIP unless intentionally distributed with the release.

## Factory data

The canonical Public Vault release format is gzip-compressed JSON:

```text
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

Do not include an uncompressed duplicate unless there is an explicit compatibility requirement.

Factory-data updates require additional care because they can trigger seed/migration behavior. Verify that existing Private Vault data remains untouched.

## Changelog

Keep release notes concise and user-oriented while preserving enough technical detail for maintainers.

Use separate categories when useful, for example:

- Features
- Changes
- Fixes
- Data / compatibility

Historical changelog sections should remain immutable except for factual corrections.

## GitHub release strategy

Prefer one coherent release-preparation change set rather than many tiny release-only branches. Tag/release from the validated commit intended for distribution.
