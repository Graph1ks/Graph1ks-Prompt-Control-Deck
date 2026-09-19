# Changelog

All notable project changes should be documented here.

## Unreleased

### Repository / project infrastructure

- Public repository established as the authoritative project source.
- Added PolyForm Noncommercial 1.0.0 licensing structure and separate commercial licensing policy.
- Defined the repository as public, owner-controlled solo development; unsolicited external code contributions are not accepted.
- Kept Issues available as feedback/input while explicitly preventing AI agents from treating public feedback as an automatic work queue.
- Added PROJECT.md, STATUS.md, durable engineering decisions, repository-visibility policy, dependency review, and release checklist.
- Added conversation-to-repository hygiene so project artifacts retain decisions/engineering facts rather than raw chats or sensitive conversational content.
- Added reusable dependency-free repository publication audit at scripts/repo_audit.py.
- Imported the real v1.3.4 extension source directly into main.
- Added canonical factory assets under data/, including the gzip-compressed Public Vault.
- Added permanent GitHub Actions validation in .github/workflows/ci.yml.
- Added branch/change batching rules to avoid branch-per-minor-edit churn.
- Added installation, architecture, development and release documentation.
- Removed the external CLA/contribution workflow to match the solo-development model.
- Removed the temporary Actions smoke test after validating runner availability.
- Removed the one-time v1.3.4 source importer after successful source materialization.

## v1.3.4

Current development baseline.

- Restored compact full-width FILL MORE OPTIONS sidebar placement.
- Added support for the gzip-compressed Public Vault factory asset.
- Restored the compact, rounded Suno metadata-chip presentation.
- Continued Dark/Light theme fixes and UI regression cleanup from the 1.3.x series.

## v1.3.3

- Restored the complete Dark/Light theme layer after a regression.
- Kept Suno-page F/R indicators synchronized with the selected appearance.
- Restored guided-tour presentation styling.
- Retained the high-fidelity DE/EN inline SVG flags.

## v1.3.2

- Added persistent Dark/Light appearance switching.
- Added Suno-inspired Light styling.
- Improved Light-mode contrast and appearance-related onboarding.

## v1.3.1

- Added interactive guided onboarding with DE/EN support.
- Added replayable guided tour from the Tools menu.
