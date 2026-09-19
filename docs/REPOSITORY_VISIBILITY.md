# Repository Visibility & Solo-Development Policy

## Current mode

GRAPH1KS Prompt Control Deck uses:

**PUBLIC — owner-controlled solo development**

Public visibility does not mean community governance or open contribution intake.

The repository is public so users can inspect the source, obtain releases/source, report problems, and understand licensing and data provenance.

## Code contributions

External code contributions are not accepted by default.

Do not invite unsolicited pull requests, maintain a CLA/DCO process, or treat forks as contribution branches.

An external pull request may be closed without review because the repository's collaboration model is owner-controlled. If Graph1ks explicitly invites a specific contribution, the rights/licensing implications must be decided before merge.

## Issues

Issues may remain enabled for:

- reproducible bug reports;
- feature suggestions;
- compatibility reports;
- user feedback.

An Issue is input, not a roadmap commitment or authorization to modify the project.

### Agent behavior

AI/coding agents must not proactively:

- scan Issues as a work queue;
- prioritize community requests;
- reply, label, close, or triage Issues;
- implement an Issue because it exists.

Agents may work with Issues only when Graph1ks explicitly requests analysis, triage, feedback, a response, or implementation.

When triggered, verify the report against current code, PROJECT.md, STATUS.md, architecture, tests, and project scope before acting.

## Discussions, Wiki, Projects, and Pages

Default policy:

- Discussions: disabled;
- Wiki: disabled unless explicitly used;
- Projects: disabled unless explicitly used;
- Pages: disabled unless explicitly used.

Repository-host settings should match these decisions. Files in the repository cannot enforce every GitHub setting, so host-level changes require verification.

## Security reports

Do not request exploitable vulnerability details in public Issues.

Follow SECURITY.md for private reporting guidance.

## Public repository hygiene

Treat every committed artifact as potentially permanent public information.

Do not publish:

- credentials, API keys, tokens, or private keys;
- browser/session data;
- private user data;
- local databases or exports not intended for publication;
- machine-specific private paths;
- unnecessary personal identifiers;
- raw user/AI conversations;
- scratch archives, debug dumps, or generated reports not intended for source control.

Use python scripts/repo_audit.py for the maintained publication audit.

## Visibility changes

A future PUBLIC → PRIVATE or PRIVATE → PUBLIC change is a material repository event.

Before changing visibility, review:

- reachable Git history;
- commit metadata;
- tracked/generated artifacts;
- secrets and local paths;
- licensing/redistribution assumptions;
- issue/security reporting behavior;
- host-level repository settings.

Do not infer that a private repository is an acceptable secret store.

## Target GitHub settings

For the current mode:

- Visibility: Public
- Issues: Enabled
- Discussions: Disabled
- Wiki: Disabled unless intentionally used
- Projects: Disabled unless intentionally used
- Pages: Disabled unless intentionally used
- Pull-request workflow: owner/collaborator use only
- Security reporting: private path described in SECURITY.md
