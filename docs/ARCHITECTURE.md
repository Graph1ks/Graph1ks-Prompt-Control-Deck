# Architecture

## Overview

GRAPH1KS Prompt Control Deck is a Manifest V3 Chrome/Chromium extension with a local-first architecture. It does not require a hosted backend for normal operation.

## Runtime components

### `manifest.json`

Defines the Manifest V3 extension, permissions, Suno host access, service worker, content script, command shortcut, icons and web-accessible Deck/data assets.

### `background.js`

The extension service worker. It coordinates extension-level behavior such as opening/toggling extension surfaces, tab/window interactions and messaging that must happen outside the page context.

### `content.js`

Runs on supported Suno pages. It is responsible for page-side integration, including Suno field discovery, Fill/Retrieve interactions, page overlays/indicators and communication with the extension runtime.

Suno selectors should remain resilient to minor DOM and localization changes. German and English labels are supported where the project already recognizes them.

### `deck.html`, `deck.css`, `deck.js`

The Control Deck UI and primary application logic.

`deck.js` owns most local application state and IndexedDB/Vault behavior, including:

- Public Vault indexing/content storage;
- Private Vault registry and records;
- factory seeding/migration;
- genre taxonomy handling;
- search/filter/sort state;
- editor/draft workflows;
- Suno metadata presentation;
- optional Advanced Options filling;
- appearance/settings persistence;
- popup/overlay/pop-out surface handoff.

### `i18n.js`

German/English UI localization helpers and language presentation.

### `theme-preload.js`

Applies the persisted Dark/Light appearance before the main Deck CSS/UI initializes, reducing theme flash and keeping the Deck appearance consistent.

## Local storage model

The project uses browser-local storage mechanisms. Current application code includes IndexedDB-backed Public/Private Vault behavior and local persisted settings.

User-created Private Vault data must be treated as durable user data. Factory upgrades must not destructively replace it.

## Factory data

Canonical bundled assets:

```text
data/GRAPH1KS_GENRE_MAP_FACTORY.json
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

The Public Vault asset is gzip-compressed JSON. Runtime code uses browser-native gzip decompression support and should not depend on an uncompressed repository duplicate.

The genre map is a versioned application asset and should be validated before replacement/import.

## Suno integration boundary

The extension integrates with a third-party web application whose DOM may change independently.

Rules for this boundary:

- prefer stable structure, roles, ARIA and semantic labels over brittle deep CSS selectors;
- retain DE/EN matching where applicable;
- avoid destructive page DOM changes;
- preserve known-working slider/mouse interaction techniques unless intentionally replaced and tested;
- retrieved Voice metadata may be stored/displayed without automatically selecting a Voice unless explicitly supported.

## UI surfaces

The Deck can operate across multiple extension surfaces, including popup, overlay and pop-out/topmost-style windows. Surface changes should preserve relevant UI state through the existing handoff mechanism.

## Privacy boundary

No analytics, telemetry, advertising, cloud synchronization, hidden API calls or collection of user prompts/lyrics/Vault contents should be added without explicit maintainer approval.

## CI boundary

`.github/workflows/ci.yml` performs static and data-integrity validation. It intentionally does not introduce a framework/build dependency into the extension itself.

Browser-interaction behavior still requires real Chromium/Suno testing when a change affects live integration.
