# AGENTS.md

This file defines the operating contract for Graph1ks and AI/coding agents working in GRAPH1KS Prompt Control Deck.

## Mission

Build and maintain the extension quickly, safely, and to a high engineering standard without unnecessary process, paid dependencies, privacy leaks, licensing surprises, or architecture beyond the product's real scope.

This is a public-source, owner-controlled solo-development project.

## 0. Resume protocol — HARD RULE

Before meaningful work, read in this order:

1. AGENTS.md;
2. PROJECT.md;
3. STATUS.md;
4. docs/HANDOVER.md;
5. relevant architecture, provenance, development, release, and decision documentation;
6. the files directly involved in the requested change.

Then inspect current Git/repository state and relevant validation before changing code.

Source-of-truth precedence when information conflicts:

1. current code/data/schema plus reproducible verification;
2. PROJECT.md for project intent, constraints, licensing, and repository mode;
3. accepted decisions in docs/DECISIONS.md and authoritative domain docs;
4. STATUS.md and docs/HANDOVER.md for current operational state;
5. README and other explanatory documentation.

If continuity docs are stale, correct them as part of the current work.

No continuation-critical fact may exist only in chat history.

## 1. Execution mode

Default behavior:

- work in coherent end-to-end chunks;
- combine analysis, implementation, focused tests, verification, and necessary documentation;
- do not stop for confirmation on routine, reversible engineering choices;
- escalate changes that materially alter product scope, licensing, permissions, privacy boundaries, data ownership, or destructive persistent state;
- prefer one finished slice over several partially completed ones;
- keep explanations concise unless a material decision needs deeper analysis.

Do not trade correctness for speed.

## 2. Product invariants

Preserve working behavior unless the requested change intentionally modifies it.

In particular, protect:

- Public and Private Vault behavior;
- Suno Retrieve and Autofill flows;
- manual Editor/Draft workflows;
- DE/EN support;
- Dark and Light modes;
- persisted user settings;
- popup, overlay, and pop-out behavior;
- local-first storage assumptions;
- guided onboarding;
- user-created Private Vault data.

Bug fixes should be narrowly scoped when practical. Do not redesign unrelated behavior while fixing another issue.

## 3. Versioning and release markers

- Never bump the extension version unless explicitly requested.
- When a version bump is requested, keep manifest.json, runtime version constants, current documentation, and release naming consistent.
- Do not rewrite historical changelog headings during a normal version bump.
- FACTORY_RELEASE and equivalent factory-data markers change only when the corresponding factory data changes.

## 4. UI regressions are bugs

When changing UI/CSS:

- verify Dark and Light independently;
- verify DE/EN labels where layout is affected;
- avoid broad selectors that override component-specific layout;
- preserve contrast for text, controls, badges, disabled states, and onboarding;
- keep compact Suno metadata chips readable and bounded;
- preserve intended sidebar full-width/grid behavior;
- check popup/overlay/pop-out surfaces when relevant.

## 5. Suno integration

Suno's UI may vary by locale and DOM revision.

When reading or filling Suno controls:

- prefer semantic, structural, ARIA, and label matching over brittle text-only selectors;
- support German and English where the project already does so;
- avoid destructive DOM manipulation;
- preserve known-working mouse/slider interaction techniques unless intentionally replaced and tested;
- do not auto-select stored Voice entries unless the feature explicitly supports it;
- test both supported Suno hostnames when relevant.

## 6. Factory data and provenance

Canonical bundled assets include:

- data/GRAPH1KS_GENRE_MAP_FACTORY.json;
- data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz.

Rules:

- do not add an uncompressed Public Vault duplicate unless explicitly required;
- treat the gzip Public Vault as a first-class runtime asset;
- validate imports/migrations before committing changes;
- never destroy user-created Private Vault data during factory operations;
- validate genre-map schema and canonical mappings before replacement;
- keep docs/DATA_PROVENANCE.md accurate when the research/generation pipeline changes materially;
- do not add unlicensed lyrics, audio, notation, artwork, copied reviews, raw chart histories, or third-party bulk datasets merely because they are publicly accessible.

reference_artist and reference_song are provenance/catalog metadata only.

They must not be injected into song-generation/autofill inputs unless Graph1ks explicitly changes this architecture after reviewing the associated rights implications.

Inside instrumental_arrangement, terms such as source, original motif, or original register refer to the generated concept inside that entry, not to a commercial reference recording.

## 7. Security, privacy, and conversation hygiene — HARD RULE

Do not introduce without explicit approval:

- analytics;
- telemetry;
- advertising;
- hidden API calls;
- cloud synchronization;
- background tracking;
- collection of prompts, lyrics, or Vault contents;
- remote code execution;
- new browser permissions without a clear product need.

Never commit, publish, paste into public artifacts, or intentionally log:

- passwords, tokens, API keys, private keys, or credentials;
- browser/session secrets;
- private user/customer data;
- unnecessary personal identifiers;
- machine-specific private paths;
- local databases/exports not intended for publication.

Use project-relative or sanitized paths in public documentation, reports, examples, fixtures, and logs.

### Conversation-to-repository hygiene

Persist decisions and engineering facts, not conversations.

Do not copy raw chats, prompts, private discussions, or unrelated conversational content into source code, documentation, logs, fixtures, reports, commit messages, Issues, generated artifacts, or release packages.

This applies especially to sensitive, private, abusive, exploitative, potentially unlawful, harmful, or otherwise inappropriate conversation content that is not required for legitimate project state.

When a conversation produces a valid project decision, retain only the minimum durable engineering consequence.

See SECURITY.md.

## 8. Zero-cost, dependencies, and licensing — HARD GATES

Required development, build, test, distribution, operation, and normal intended use must remain genuinely zero-cost unless Graph1ks explicitly approves an exception.

A free tier is not automatically zero-cost.

Prefer browser/platform capabilities and small local helpers over new dependencies.

Do not add a package manager, framework, build system, runtime dependency, paid service, SDK, dataset, model, font, media asset, or external code merely for convenience.

Before adopting a non-trivial external component, review:

1. technical necessity and fit;
2. zero-cost status;
3. license/terms compatibility;
4. commercial-use and redistribution implications;
5. maintenance/security posture;
6. dependency/transitive weight;
7. privacy/network impact;
8. portability and removal cost.

Use docs/DEPENDENCY_REVIEW.md when the choice is non-trivial or difficult to reverse.

Public availability is not a license. Non-commercial, research-only, field-of-use, copyleft, source-available, custom, or unclear terms require explicit review.

Do not weaken or replace the current PolyForm Noncommercial + separate commercial-license model without explicit instruction from Graph1ks.

## 9. QA and performance

Use risk-based QA.

For meaningful changes:

- test the changed behavior and likely regressions;
- run relevant syntax/static checks;
- run build/package checks when packaging is affected;
- verify migrations when persistent data changes;
- benchmark when performance is a requirement;
- verify failure behavior for security-sensitive/destructive paths;
- add a regression check for bug fixes when practical.

When performance matters:

1. define the target;
2. measure the baseline;
3. identify the bottleneck;
4. change the smallest high-leverage part;
5. benchmark again;
6. verify correctness.

Before a release, use docs/RELEASE_CHECKLIST.md and docs/RELEASING.md.

## 10. Repository model — HARD RULE

The repository mode is PUBLIC — owner-controlled solo development.

External code contributions are not accepted by default.

Do not:

- invite unsolicited pull requests;
- maintain an active CLA/DCO workflow;
- treat forks as contribution branches;
- infer community governance because the repository is public.

Issues may remain enabled for bug reports, suggestions, compatibility reports, and user feedback.

Issues and other public feedback channels are input channels, not automatic agent work queues.

Default agent behavior:

- do not proactively scan, triage, prioritize, reply to, label, close, or implement Issues merely because they exist;
- do not treat user/community requests as roadmap commitments;
- act on an Issue only when Graph1ks explicitly requests analysis, triage, feedback, response, or implementation;
- when triggered, verify the report against current code, PROJECT.md, STATUS.md, architecture, tests, and scope;
- implement only when the owner's instruction authorizes implementation.

Security reports follow SECURITY.md and must not be redirected into public exploit disclosure.

See docs/REPOSITORY_VISIBILITY.md.

## 11. Branching, batching, and CI economy

Default to one working branch per coherent task, feature, bug-fix batch, or release batch — not one branch per file or tiny edit.

- Bundle closely related changes.
- Keep follow-up fixes for the same task on the same branch/PR until complete.
- Direct main commits are acceptable only for small owner-authorized maintenance when review isolation is unnecessary.
- Prefer one PR per coherent unit when a branch is used.
- Validate locally first when practical.
- Do not trigger/re-run CI merely to show progress.
- Avoid duplicate workflows that validate the same thing without a specific need.

The committed repository must contain the real maintainable extension source directly.

## 12. Documentation and continuity

Documentation must make the project understandable and resumable.

Maintain:

- STATUS.md — compact current operational truth;
- docs/HANDOVER.md — durable continuation context;
- docs/DECISIONS.md — expensive-to-rediscover decisions;
- CHANGELOG.md — curated meaningful product/release history.

Update continuity docs whenever a meaningful work chunk changes facts another developer/agent needs to continue correctly.

Do not turn STATUS.md or docs/HANDOVER.md into chronological diaries.

Git remains the complete technical history; CHANGELOG.md is not a commit dump.

A meaningful session is not complete if implementation changed materially but continuity docs describe an obsolete state.

## 13. Public identity and repository hygiene

Maintainer-authored Git commits must not expose a private e-mail address.

Use the configured GitHub noreply identity for Graph1ks-authored local commits.

Never commit:

- .env secrets;
- credentials/tokens/private keys;
- browser/session data;
- local databases/state not intended for publication;
- machine-specific absolute paths;
- generated reports/debug dumps;
- scratch/release archives that do not belong in source control.

If a credential is ever committed, removing the file is insufficient: rotate/revoke it and purge it from reachable history as appropriate.

Use python scripts/repo_audit.py for the maintained publication audit.

## 14. Definition of done

A coherent change is done when applicable:

- intended behavior is implemented;
- relevant checks pass;
- obvious regressions are checked;
- no new secret/private-path leakage exists;
- new dependencies pass cost/license/privacy gates;
- persistent-data changes have an appropriate recovery path;
- repository/runtime permissions remain intentional;
- documentation is updated where needed;
- STATUS.md reflects actual current state;
- docs/HANDOVER.md supports resumption without chat history;
- durable decisions are recorded where needed;
- CHANGELOG.md is updated for meaningful user/release changes;
- repository artifacts contain project facts rather than raw conversations;
- public/generated artifacts are sanitized;
- performance requirements are measured when relevant;
- known limitations are explicit.

## 15. Decision priority

When constraints compete, use this order unless PROJECT.md explicitly overrides it:

1. security and data integrity;
2. correctness;
3. license and zero-cost compliance;
4. product quality and user impact;
5. iteration speed;
6. maintainability;
7. elegance;
8. process ceremony.
