# Security Policy

Please do not disclose security-sensitive findings in a public Issue or pull request.

## Reporting

If you discover a vulnerability that could expose user data, modify Vault contents, execute unintended code, abuse browser permissions, or otherwise compromise users, contact Graph1ks privately through a private GitHub security/contact mechanism or another private contact channel publicly provided by Graph1ks.

Do not include secrets or private user content unless strictly necessary. Sanitize logs, screenshots, paths, prompts, lyrics, identifiers, and Vault data before sharing.

Please include:

- affected version;
- browser/version;
- concise reproduction steps;
- impact;
- sanitized logs or screenshots where useful;
- whether the issue is already being exploited, if known.

## Scope

Security reports are especially relevant for:

- unsafe handling of local Vault data;
- unintended external network requests;
- privilege or permission escalation;
- injection or code-execution paths;
- unsafe import/export parsing;
- exposure of prompts, lyrics, credentials, identifiers or private metadata;
- malicious or malformed factory/import data that can corrupt stored data.

## Repository hygiene

Never publish credentials, tokens, private keys, browser/session material, private user data, machine-specific private paths, or raw private user/AI conversations in repository artifacts.

If an actual credential is committed, assume exposure and rotate or revoke it. Removing it from the latest revision alone is not sufficient.

Use python scripts/repo_audit.py for the maintained publication audit.

## Supported versions

Until a formal support matrix is published, the latest public release is the primary supported version.

## Disclosure

Please allow reasonable time for investigation and a fix before public disclosure.
