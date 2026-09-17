# Installation

GRAPH1KS Prompt Control Deck is currently installed as an unpacked Chrome/Chromium extension.

## Requirements

- A current Chromium-based browser.
- Chrome version 116 or newer, matching `minimum_chrome_version` in `manifest.json`.
- Access to Suno through `https://suno.com/` or `https://www.suno.com/`.

## Install from the repository

1. Clone the repository or download it as a ZIP from GitHub.
2. If you downloaded a ZIP, extract it to a permanent local folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the folder containing `manifest.json`.
7. Open or reload Suno.

Do not select the ZIP itself. Chrome must receive the extracted directory containing the extension files.

## Updating an existing unpacked installation

1. Replace or pull the files in the same local extension directory.
2. Open `chrome://extensions`.
3. Find **GRAPH1KS Prompt Control Deck**.
4. Click **Reload**.
5. Reload the Suno tab as well when content-script behavior changed.

Local Vault/user data should remain intact across normal extension reloads and source updates. Factory-data migration code must not destroy Private Vault content.

## Factory data

A valid checkout contains:

```text
data/GRAPH1KS_GENRE_MAP_FACTORY.json
data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz
```

Do not manually decompress the Public Vault into the extension folder. The runtime loads the gzip-compressed asset directly.

## Default command

The extension manifest currently defines:

```text
Ctrl+Shift+G
```

for opening the Control Deck. Browser/OS shortcut conflicts can be managed through `chrome://extensions/shortcuts`.

## Troubleshooting

If the Deck does not appear or Suno integration is stale:

1. Reload the extension from `chrome://extensions`.
2. Reload the Suno tab.
3. Confirm the extension is enabled.
4. Confirm the page URL is under `suno.com`.
5. Check the extension/service-worker console for errors.
6. Confirm both files under `data/` are present.

For reproducible bugs, use the repository bug-report template and include the extension version, browser version, Suno language and the affected surface (popup / overlay / pop-out).
