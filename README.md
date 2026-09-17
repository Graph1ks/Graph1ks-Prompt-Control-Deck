# GRAPH1KS Prompt Control Deck

![Validation](https://github.com/Graph1ks/Graph1ks-Prompt-Control-Deck/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-1.3.4-6f45c5)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-c43761)

A local-first Chrome/Chromium extension for managing, retrieving, editing, organizing and autofilling Suno song/prompt data.

> **License:** Free for personal and non-commercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use requires a separate written license from Graph1ks. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

## Current status

Current development baseline: **v1.3.4**.

This public repository is the authoritative project source for code, documentation, licensing, factory data and future releases.

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
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open Suno.

## Factory data

Bundled application data lives under `data/`:

```text
data/
├── GRAPH1KS_GENRE_MAP_FACTORY.json
└── GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

The Public Vault is deliberately stored as gzip-compressed JSON and decompressed client-side by the extension. The repository and release package should not contain an unnecessary uncompressed duplicate.

The current factory Vault contains more than 10,000 prompt/song entries. See [data/README.md](data/README.md) for data-specific rules.

## Repository layout

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
.github/
```

Architecture details are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

Read these before making non-trivial changes:

- [AGENTS.md](AGENTS.md) — authoritative project rules for coding agents and maintainers;
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution and pull-request rules;
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — practical development workflow;
- [docs/RELEASING.md](docs/RELEASING.md) — release discipline and versioning;
- [docs/HANDOVER.md](docs/HANDOVER.md) — current project state and next-action context.

### CI

The repository uses one compact GitHub Actions validation workflow: `.github/workflows/ci.yml`.

It validates:

- Manifest V3 structure and required files;
- synchronized extension version markers;
- JavaScript syntax;
- duplicate HTML IDs;
- bundled Genre Map JSON;
- gzip Public Vault JSON;
- icon PNG signatures;
- gzip loading support in the runtime source;
- the full-width `FILL MORE OPTIONS` regression guard;
- absence of temporary bootstrap/scratch artifacts.

CI runs on relevant source/data changes to `main`, on relevant pull requests, and manually. Documentation-only commits do not trigger it.

## Branching and change batching

Do not create a branch for every tiny edit. Related changes should be grouped into one coherent task branch / pull request when a branch is needed. Small owner-authorized maintenance may be committed directly to `main`.

The detailed policy is in [AGENTS.md](AGENTS.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Privacy

The project is local-first by design. Do not introduce analytics, advertising, background tracking, hidden network requests, prompt/lyrics collection or cloud synchronization without explicit maintainer approval.

See [SECURITY.md](SECURITY.md) and [AGENTS.md](AGENTS.md).

## Contributions

Code contributions require acceptance of the project [Contributor License Agreement](CLA.md). This preserves Graph1ks' ability to distribute the project under the public noncommercial license while also offering separate commercial licenses.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Commercial use

The public license does **not** grant commercial-use rights.

Selling, monetizing, commercially redistributing, bundling, hosting or incorporating this project into a commercial product or service requires a separate written commercial license from Graph1ks.

See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

## Security

Do not publish security-sensitive findings as public issues. See [SECURITY.md](SECURITY.md).

## Third-party service notice

This is an independent project and is not affiliated with or endorsed by Suno.

## Copyright

Copyright © 2026 Graph1ks. Rights are granted only as expressly stated in the repository license or a separate written commercial agreement.
