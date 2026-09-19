# Development Workflow

## Authoritative source

The GitHub repository is the authoritative project state.

Before substantial work, read:

1. AGENTS.md;
2. PROJECT.md;
3. STATUS.md;
4. docs/HANDOVER.md;
5. relevant decisions/domain docs;
6. directly affected source files.

Do not reconstruct current behavior from old chat history or stale release artifacts when repository state is newer.

## Repository model

This is a public, owner-controlled solo-development project.

External code contributions are not accepted by default. Issues may be used for feedback, but they do not authorize work and must not be treated as an automatic AI-agent backlog.

See docs/REPOSITORY_VISIBILITY.md.

## Branching policy

Use branches for coherent bodies of work, not for every tiny edit.

Preferred patterns:

- one feature branch for one feature or closely related feature set;
- one bug-fix branch for a coherent regression/fix batch;
- one release-preparation branch when release work spans multiple files;
- direct main commits only for small owner-authorized maintenance when review isolation is unnecessary.

Avoid branch-per-line, branch-per-file and branch-per-minor-follow-up behavior.

## CI economy

The repository uses one compact validation workflow rather than overlapping workflows.

CI runs on pushes to main, pull requests targeting main, and manual dispatch.

concurrency with cancel-in-progress prevents stale runs from consuming unnecessary runner time.

Validate locally first when practical. Do not trigger or re-run CI merely to show progress.

## Git identity privacy

For maintainer-authored local commits, use the GitHub noreply identity rather than a private mailbox:

~~~bash
git config user.name "Graph1ks"
git config user.email "213925530+Graph1ks@users.noreply.github.com"
~~~

To make this the default for all local repositories, use --global on both commands.

Verify before committing:

~~~bash
git config --get user.name
git config --get user.email
~~~

After any public-history rewrite, do not push from an old clone that still contains removed history. Re-clone or explicitly reset the local clone to the new public root first.

## Local validation

Run checks proportionate to the change.

### Repository publication audit

~~~bash
python scripts/repo_audit.py
~~~

Use --history before a material public-history/publication event or when explicitly auditing reachable history:

~~~bash
python scripts/repo_audit.py --history
~~~

### JavaScript syntax

~~~bash
node --check background.js
node --check content.js
node --check deck.js
node --check i18n.js
node --check theme-preload.js
~~~

### Manifest JSON

~~~bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
~~~

### Factory gzip

~~~bash
python -c "import gzip,json; json.load(gzip.open('data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz','rt',encoding='utf-8')); print('public vault ok')"
~~~

CI also validates duplicate HTML IDs, required assets, icons, version consistency, factory-data integrity, provenance invariants, and repository hygiene.

## Versioning

Do not bump the extension version unless explicitly requested.

When bumping, synchronize current runtime version markers including:

- manifest.json;
- APP_VERSION in deck.js;
- EXT_VERSION in content.js;
- data-g1-version in deck.html;
- current README/changelog references where applicable.

Do not blanket-replace old version numbers in historical changelog sections.

FACTORY_RELEASE is a factory-data marker, not automatically an application-version mirror.

## UI changes

Treat visual regressions as bugs.

When modifying CSS/UI:

- test Dark and Light independently;
- verify popup/overlay/pop-out surfaces when layout is affected;
- retain intended full-width/grid behavior for sidebar controls;
- preserve compact metadata-chip presentation;
- avoid broad selectors that override component-specific sizing/spacing;
- verify DE/EN labels do not break layout.

## Suno integration changes

When changing page integration:

- test supported Suno hostnames when relevant;
- prefer semantic/ARIA/structural matching;
- consider English and German labels;
- reload both extension and Suno tab after changing content.js;
- do not replace working slider/mouse behavior casually.

## Data changes

Factory assets are application data, not scratch files.

- keep Public Vault as .json.gz;
- do not commit an uncompressed duplicate;
- validate JSON before committing;
- preserve user-created Private Vault data during migrations;
- validate genre taxonomy imports before replacing canonical mappings;
- keep docs/DATA_PROVENANCE.md accurate.

## Dependencies

The extension is intentionally dependency-light.

Do not add a package manager, framework, build pipeline, paid service, or runtime dependency solely for convenience when browser-native APIs and small local helpers are sufficient.

Use docs/DEPENDENCY_REVIEW.md for a non-trivial or difficult-to-remove external component.

## Finishing a work chunk

Before declaring meaningful work complete:

- run applicable checks;
- confirm privacy/licensing/permission implications;
- update STATUS.md if operational truth changed;
- update docs/HANDOVER.md if continuation context changed;
- add/update docs/DECISIONS.md for expensive-to-rediscover decisions;
- update CHANGELOG.md for meaningful user/release changes;
- persist project facts rather than raw conversations.
