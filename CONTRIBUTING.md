# Contributing

Contributions are welcome when they improve GRAPH1KS Prompt Control Deck without changing its licensing model or project direction.

## Before you contribute

Please open an issue or discussion before starting substantial work. Small bug fixes and documentation corrections may be submitted directly.

## Contributor License Agreement

All code contributions require acceptance of [CLA.md](CLA.md). Before a pull request can be merged, the contributor must post this exact statement in the pull request discussion:

`I have read and agree to CLA.md for this contribution.`

This is required so Graph1ks can continue to distribute the project under the public noncommercial license and also offer separate commercial licenses.

## Branch and pull-request policy

- Use one branch per coherent task, feature, bug-fix batch or release batch.
- Do not create separate branches for every tiny file edit or follow-up tweak that belongs to the same task.
- Keep unrelated work separate, but bundle closely related changes together.
- Prefer one pull request per coherent unit of work.
- Do not open duplicate PRs merely to force another CI run.
- If a newer commit supersedes an older one in the same PR, CI should cancel obsolete in-progress validation where configured.

## Pull request rules

- Keep changes focused. Do not mix unrelated refactors with a feature or bug fix.
- Preserve existing user data and migration behavior unless a migration is explicitly part of the change.
- Do not silently change licensing, attribution, bundled data, telemetry, network behavior, or permissions.
- Do not introduce tracking, analytics, advertising, remote code execution, or hidden network requests.
- Do not add dependencies without a clear technical need.
- Do not bump the extension version unless the maintainer requests it.
- Preserve Dark and Light themes, DE/EN behavior, and the existing extension surfaces unless the change explicitly targets them.
- Changes to Suno selectors must be resilient to localization and minor DOM variation where practical.

## Validation

Before requesting review, validate at minimum:

- `manifest.json` parses as valid JSON;
- JavaScript files pass a syntax check;
- the extension loads unpacked in a current Chromium-based browser;
- the Deck opens without console-breaking errors;
- Dark and Light modes both render correctly;
- Public and Private Vault behavior still works;
- no duplicate HTML IDs were introduced;
- any release ZIP contains the intended source and bundled data only.

## CI usage

CI should be useful, not noisy.

- Prefer PR validation plus validation on `main`.
- Avoid validating every arbitrary branch push unless needed.
- Use path filters so documentation-only changes do not run extension checks unnecessarily.
- Prefer local validation before pushing repeated trial-and-error commits.
- Re-run only failed jobs when that is sufficient instead of re-running an entire successful workflow.

## Licensing of contributions

Submitting a contribution does not make the project permissively licensed. Accepted contributions become part of the project under the repository's public licensing model, while the CLA also grants Graph1ks the rights needed for separate commercial licensing.
