# GRAPH1KS Prompt Control Deck

![Validation](https://github.com/Graph1ks/Graph1ks-Prompt-Control-Deck/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-1.3.4-6f45c5)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-c43761)

A local-first Chrome/Chromium extension for managing, retrieving, editing, organizing and autofilling Suno song/prompt data.

> **License:** Free for personal and non-commercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use requires a separate written license from Graph1ks. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

## Current status

Current development baseline: **v1.3.4**.

This public repository is the authoritative project source for code, documentation, licensing, factory data and future releases.

Development is **owner-controlled solo development**. Public visibility is not an invitation for external code contributions.

## What it does

GRAPH1KS Prompt Control Deck provides a local Vault workflow around Suno, including:

- Public and Private Vaults;
- retrieval of Suno song/prompt data;
- verified autofill back into Suno;
- optional filling of supported Advanced Options;
- manual editing and Draft creation;
- genre/subgenre classification and mapping;
- compact Suno metadata display;
- Dark and Light appearance modes;
- German and English UI;
- persisted local settings;
- popup, overlay and pop-out surfaces;
- guided onboarding;
- keyboard-assisted Fill / Retrieve workflows.

The extension is intentionally local-first. Normal use does not require a hosted backend, cloud account, telemetry service or remote database.

## Installation

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full instructions.

Short version:

1. Clone or download this repository.
2. Open chrome://extensions.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository folder containing manifest.json.
6. Open Suno.

## Factory data

Bundled application data lives under data/:

~~~text
data/
├── GRAPH1KS_GENRE_MAP_FACTORY.json
└── GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
~~~

The Public Vault is deliberately stored as gzip-compressed JSON and decompressed client-side by the extension. The repository and release package should not contain an unnecessary uncompressed duplicate.

The current factory Vault contains more than 10,000 prompt/song entries. See [data/README.md](data/README.md) for data-specific rules and [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md) for the research/generation pipeline, reference-field semantics, third-party identifiers, and licensing scope.

reference_artist and reference_song are provenance/catalog metadata only; they identify the research target and are not intended to be used as artist-name or song-title imitation instructions in the song-generation workflow.

## Repository layout

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
data/
docs/
scripts/
.github/
~~~

Architecture details are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

Read these before non-trivial work:

- [AGENTS.md](AGENTS.md) — authoritative developer/agent contract;
- [PROJECT.md](PROJECT.md) — project mode, scope, licensing and engineering constraints;
- [STATUS.md](STATUS.md) — compact current operational state;
- [docs/HANDOVER.md](docs/HANDOVER.md) — continuation context;
- [docs/DECISIONS.md](docs/DECISIONS.md) — durable engineering decisions;
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — practical development workflow;
- [docs/RELEASING.md](docs/RELEASING.md) — release discipline;
- [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md) — Public Vault provenance and third-party-reference policy.

### CI

The repository uses one compact GitHub Actions validation workflow: .github/workflows/ci.yml.

It validates extension/runtime invariants, factory data, repository hygiene, and the reusable publication audit.

CI runs on pushes to main, pull requests targeting main, and manual dispatch.

## Branching and change batching

Do not create a branch for every tiny edit. Related changes should be grouped into one coherent task branch/pull request when isolation is useful. Small owner-authorized maintenance may be committed directly to main.

See AGENTS.md and docs/DEVELOPMENT.md.

## Privacy

The project is local-first by design. Do not introduce analytics, advertising, background tracking, hidden network requests, prompt/lyrics collection or cloud synchronization without explicit owner approval.

See [SECURITY.md](SECURITY.md) and [AGENTS.md](AGENTS.md).

## Feedback and code contributions

Issues are available for bug reports, compatibility reports, suggestions, and user feedback.

This is **not a community-development repository**. Unsolicited external code contributions and pull requests are not accepted.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Commercial use

The public license does **not** grant commercial-use rights.

Selling, monetizing, commercially redistributing, bundling, hosting or incorporating this project into a commercial product or service requires a separate written commercial license from Graph1ks.

A Graph1ks commercial license can grant only rights that Graph1ks owns or is otherwise entitled to license; it does not grant rights in third-party names, trademarks, recordings, compositions, lyrics, artwork, databases, or other third-party material merely because those items are referenced by project metadata.

See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

## Security

Do not publish security-sensitive findings as public issues. See [SECURITY.md](SECURITY.md).

## Third-party references and service notice

This is an independent project and is not affiliated with or endorsed by Suno, referenced artists, record labels, publishers, chart providers, or other third parties.

Artist names, song titles, trademarks, and similar identifiers may appear in factory data solely for identification, reference, and research provenance. No ownership of third-party names, recordings, compositions, lyrics, artwork, or trademarks is claimed by their inclusion.

See [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

## Copyright

Copyright © 2026 Graph1ks. Rights are granted only as expressly stated in the repository license or a separate written commercial agreement, and only to the extent Graph1ks owns or is otherwise entitled to license those rights.
