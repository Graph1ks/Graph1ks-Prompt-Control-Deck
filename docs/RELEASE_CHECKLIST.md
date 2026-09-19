# Release Checklist

Use only the sections that apply. Keep the checklist operational rather than ceremonial.

## Product

- [ ] Release scope is intentional.
- [ ] Active application version markers are synchronized.
- [ ] Factory release markers changed only when factory data actually changed.
- [ ] User-visible release notes are accurate.
- [ ] CHANGELOG.md contains the meaningful release changes.

## Quality

- [ ] CI is green on the exact release commit.
- [ ] manifest.json parses successfully.
- [ ] Modified JavaScript passes syntax checks.
- [ ] No duplicate HTML IDs were introduced.
- [ ] Dark/Light and DE/EN were checked where affected.
- [ ] Public/Private Vault behavior was checked where affected.
- [ ] Retrieve/Fill and Advanced Options were smoke-tested for Suno-integration changes.
- [ ] Persistent user data/migrations were tested where affected.

## Factory data / provenance

- [ ] Public Vault gzip can be decompressed and parsed.
- [ ] Genre Map JSON parses and is the intended taxonomy revision.
- [ ] No uncompressed Public Vault duplicate is shipped.
- [ ] reference_artist / reference_song remain outside generation/autofill.
- [ ] New external data/assets passed rights/provenance review.

## Cost / dependency gate

- [ ] No required paid or realistically billable production dependency was introduced.
- [ ] New non-trivial dependencies passed docs/DEPENDENCY_REVIEW.md.
- [ ] Browser/platform-native alternatives were considered.

## Licensing

- [ ] Public PolyForm Noncommercial terms remain accurate.
- [ ] Commercial-license language remains consistent.
- [ ] No material is shipped under incompatible, non-commercial, research-only, field-of-use, or unclear third-party terms without explicit resolution.
- [ ] Third-party rights are not implied to be granted by Graph1ks.

## Security and privacy

- [ ] python scripts/repo_audit.py passes.
- [ ] No credentials, secrets, browser/session data, or unintended personal data is present.
- [ ] No unnecessary machine-local paths are present.
- [ ] No raw/sensitive user-AI conversations are persisted in repository artifacts.
- [ ] Extension permissions/network behavior changed only with explicit justification.
- [ ] Security-sensitive defaults are safe.

## Repository / continuity

- [ ] Repository mode still matches PROJECT.md.
- [ ] External contribution language has not been reintroduced accidentally.
- [ ] STATUS.md reflects the real operational state.
- [ ] docs/HANDOVER.md contains enough current context to resume without chat history.
- [ ] Durable decisions were added to docs/DECISIONS.md when needed.

## Release artifact

- [ ] Release ZIP contains only intended runtime source/assets.
- [ ] No scratch/bootstrap/backups/reports are included.
- [ ] Archive integrity test passes.
- [ ] Tag/release points at the validated commit.
