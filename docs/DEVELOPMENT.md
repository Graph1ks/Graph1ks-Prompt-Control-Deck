# Development Workflow

## Authoritative source

The GitHub repository is the authoritative project state. Read `AGENTS.md`, `README.md`, `CHANGELOG.md` and `docs/HANDOVER.md` before substantial work.

Do not reconstruct current behavior from old chat history when the repository contains newer source.

## Branching policy

Use branches for coherent bodies of work, not for every tiny edit.

Preferred patterns:

- one feature branch for one feature or closely related feature set;
- one bug-fix branch for a coherent regression/fix batch;
- one release-preparation branch when release work spans multiple files;
- direct `main` commits are acceptable for small owner-authorized maintenance when review isolation is unnecessary.

Avoid branch-per-line, branch-per-file and branch-per-minor-follow-up behavior. If a follow-up belongs to the same task, keep it on the same branch/PR until the task is complete.

## CI economy

The repository uses one compact validation workflow rather than many overlapping workflows.

CI runs on relevant source/data changes to `main`, relevant pull requests and manual dispatch. Documentation-only commits are excluded by path filters.

`concurrency` with `cancel-in-progress` prevents stale runs from consuming runner time when a newer commit supersedes them.

## Git identity privacy

For maintainer-authored local commits, use the GitHub noreply identity rather than a private mailbox:

```bash
git config user.name "Graph1ks"
git config user.email "213925530+Graph1ks@users.noreply.github.com"
```

To make this the default for all local repositories, use `--global` on both commands:

```bash
git config --global user.name "Graph1ks"
git config --global user.email "213925530+Graph1ks@users.noreply.github.com"
```

Verify before committing:

```bash
git config --get user.name
git config --get user.email
```

After any public-history rewrite, do not push from an old clone that still contains the removed history. Re-clone the repository or explicitly reset the local clone to the new public root before resuming work.

## Local validation

Before pushing a code change, run the relevant checks locally when possible.

### JavaScript syntax

```bash
node --check background.js
node --check content.js
node --check deck.js
node --check i18n.js
node --check theme-preload.js
```

### Manifest JSON

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

### Factory gzip

```bash
python3 - <<'PY'
import gzip, json
with gzip.open('data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz', 'rt', encoding='utf-8') as f:
    data = json.load(f)
print('public vault ok')
PY
```

The GitHub CI workflow also validates duplicate HTML IDs, required assets, icons, version consistency and repository hygiene.

## Versioning

Do not bump the extension version unless explicitly requested.

When bumping a version, synchronize the current version in all active runtime locations, including:

- `manifest.json`;
- `APP_VERSION` in `deck.js`;
- `EXT_VERSION` in `content.js`;
- `data-g1-version` in `deck.html`;
- current README/CHANGELOG release references where applicable.

Do not blanket-replace old version numbers inside historical changelog entries.

`FACTORY_RELEASE` is a factory-data marker, not automatically an application-version mirror. Change it only when the relevant factory-data release changes.

## UI changes

Treat visual regressions as bugs.

When modifying CSS/UI:

- test Dark and Light modes independently;
- verify popup/overlay/pop-out surfaces when layout is affected;
- retain intended full-width/grid behavior for sidebar controls;
- preserve compact metadata-chip presentation;
- avoid broad selectors that override component-specific sizing/spacing;
- verify DE/EN labels do not break layout.

## Suno integration changes

When changing page integration:

- test both supported Suno hostnames when relevant;
- prefer semantic/ARIA/structural matching;
- consider both English and German labels;
- reload both the extension and the Suno tab after changing `content.js`;
- do not replace working slider/mouse behavior casually.

## Data changes

Factory assets are application data, not scratch files.

- keep the Public Vault as `.json.gz`;
- do not commit an uncompressed duplicate;
- validate JSON before committing;
- preserve user-created Private Vault data during migrations;
- validate genre taxonomy imports before replacing canonical mappings.

## Dependencies

The extension is intentionally dependency-light. Do not add a package manager, framework or build pipeline solely for convenience when browser-native APIs and small local helpers are sufficient.
