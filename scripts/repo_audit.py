#!/usr/bin/env python3
"""Dependency-free repository publication audit.

Checks tracked text files for likely secrets, private-key material,
machine-specific user paths, continuity requirements, and project-policy drift.

Optional --history scans added lines across reachable Git history in one
streaming pass. Matching values are never printed.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CHECKS = {
    "private-key-material": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "credential-assignment": re.compile(
        r"(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)\b"
        r"\s*[:=]\s*['\"]?[A-Za-z0-9_./+~$!@#%^&*(){}\[\]:;?=-]{12,}"
    ),
    "github-token": re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b"),
    "aws-access-key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "windows-user-path": re.compile(r"(?i)\b[A-Z]:\\Users\\(?!<name>|real-user|user|username)[^\\\s]+\\"),
    "mac-user-path": re.compile(r"/" + r"Users/(?!<name>|real-user|user|username)[^/\\s]+/"),
    "linux-user-path": re.compile(r"/" + r"home/(?!<name>|real-user|user|username)[^/\\s]+/"),
}

GENERIC_PLACEHOLDER = re.compile(r"<[^>\n]{2,120}>")
DATE_PLACEHOLDER = re.compile(r"\bYYYY-MM-DD\b")

TEXT_EXTENSIONS = {
    ".md", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".conf", ".env", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rb",
    ".rs", ".go", ".java", ".kt", ".kts", ".cs", ".cpp", ".c", ".h", ".hpp",
    ".sql", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd", ".xml",
    ".html", ".css", ".scss", ".vue", ".svelte", ".properties",
}

PROJECT_TEMPLATE_FILES = {
    "PROJECT.md",
    "README.md",
    "STATUS.md",
    "docs/HANDOVER.md",
    "docs/DECISIONS.md",
}

REQUIRED_CONTINUITY = {
    "STATUS.md": (
        "## Current objective",
        "## Current state",
        "## Last verified checks",
        "## Next concrete action",
        "## Do not redo",
    ),
    "docs/HANDOVER.md": (
        "## Current objective",
        "## Current implementation state",
        "## Important files / entry points",
        "## Next concrete work",
        "## Verification",
        "## Resume instruction",
    ),
}

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def run_git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        errors="replace",
    )


def tracked_files() -> list[str]:
    result = run_git("ls-files", "-z")
    return [p for p in result.stdout.split("\0") if p]


def looks_textual(path: Path) -> bool:
    if path.name in {".env", ".gitignore", ".gitattributes", ".editorconfig"}:
        return True
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    try:
        chunk = path.read_bytes()[:4096]
    except OSError:
        return False
    return b"\0" not in chunk


def scan_line(line: str) -> list[str]:
    return [name for name, pattern in CHECKS.items() if pattern.search(line)]


def scan_current(template_mode: bool) -> list[tuple[str, str, int]]:
    findings: list[tuple[str, str, int]] = []
    tracked = set(tracked_files())

    project_text = ""
    if "PROJECT.md" in tracked:
        try:
            project_text = (ROOT / "PROJECT.md").read_text(encoding="utf-8", errors="replace")
        except OSError:
            project_text = ""

    changelog_enabled = bool(
        re.search(r"(?im)^\*\*Changelog:\*\*\s*enabled\s*$", project_text)
    )
    owner_controlled = bool(
        re.search(
            r"(?im)^\*\*Collaboration mode:\*\*\s*owner-controlled solo development\s*$",
            project_text,
        )
    )

    if changelog_enabled:
        if "CHANGELOG.md" not in tracked:
            findings.append(("missing-enabled-changelog", "CHANGELOG.md", 0))
        else:
            try:
                changelog_text = (ROOT / "CHANGELOG.md").read_text(
                    encoding="utf-8", errors="replace"
                )
            except OSError:
                findings.append(("unreadable-enabled-changelog", "CHANGELOG.md", 0))
            else:
                if "## Unreleased" not in changelog_text:
                    findings.append(("missing-unreleased-changelog-section", "CHANGELOG.md", 0))

    if owner_controlled and "CLA.md" in tracked:
        findings.append(("solo-dev-policy-forbids-active-cla", "CLA.md", 0))

    for rel, required_sections in REQUIRED_CONTINUITY.items():
        if rel not in tracked:
            findings.append(("missing-continuity-file", rel, 0))
            continue
        try:
            continuity_text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        except OSError:
            findings.append(("unreadable-continuity-file", rel, 0))
            continue
        for section in required_sections:
            if section not in continuity_text:
                findings.append(("missing-continuity-section", rel, 0))

    for rel in sorted(tracked):
        path = ROOT / rel
        if not path.is_file() or not looks_textual(path):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for number, line in enumerate(text.splitlines(), start=1):
            for category in scan_line(line):
                findings.append((category, rel, number))

            if rel in PROJECT_TEMPLATE_FILES and (
                GENERIC_PLACEHOLDER.search(line) or DATE_PLACEHOLDER.search(line)
            ):
                if not template_mode:
                    findings.append(("template-placeholder", rel, number))

            if rel == "SECURITY.md" and "TEMPLATE BLOCKER:" in line and not template_mode:
                findings.append(("security-reporting-placeholder", rel, number))

    return findings


def scan_history() -> list[tuple[str, str, int]]:
    """Scan only added lines from every reachable commit in one Git process."""
    findings: list[tuple[str, str, int]] = []
    seen: set[tuple[str, str, int]] = set()

    marker = "__REPO_AUDIT_COMMIT__"
    cmd = [
        "git", "log", "--all", "--root", "-p", "--no-color", "--no-ext-diff",
        "--diff-merges=first-parent", f"--format={marker}%H",
    ]

    proc = subprocess.Popen(
        cmd,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        errors="replace",
    )

    assert proc.stdout is not None
    current_commit = "unknown"
    current_path = "unknown"
    new_line = 0

    for raw in proc.stdout:
        line = raw.rstrip("\n")

        if line.startswith(marker):
            current_commit = line[len(marker):][:10]
            current_path = "unknown"
            new_line = 0
            continue

        if line.startswith("+++ "):
            value = line[4:]
            current_path = value[2:] if value.startswith("b/") else value
            continue

        hunk = HUNK_RE.match(line)
        if hunk:
            new_line = int(hunk.group(1))
            continue

        if line.startswith("+") and not line.startswith("+++"):
            content = line[1:]
            for category in scan_line(content):
                key = (category, f"{current_commit}:{current_path}", new_line)
                if key not in seen:
                    seen.add(key)
                    findings.append(key)
            new_line += 1
            continue

        if line.startswith("-") and not line.startswith("---"):
            continue

        if line.startswith(" "):
            new_line += 1

    stderr = proc.stderr.read() if proc.stderr is not None else ""
    return_code = proc.wait()
    if return_code != 0:
        raise RuntimeError(
            f"git history scan failed with exit code {return_code}: {stderr.strip()}"
        )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--history",
        action="store_true",
        help="also scan added lines across all reachable history",
    )
    parser.add_argument(
        "--template-mode",
        action="store_true",
        help="allow intentional project-template placeholders",
    )
    args = parser.parse_args()

    try:
        inside = run_git("rev-parse", "--is-inside-work-tree")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(
            "ERROR: Git is required and the script must run inside a Git repository.",
            file=sys.stderr,
        )
        return 2

    if inside.stdout.strip() != "true":
        print("ERROR: not inside a Git working tree.", file=sys.stderr)
        return 2

    try:
        findings = scan_current(args.template_mode)
        if args.history:
            findings.extend(scan_history())
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if not findings:
        print("PASS: no publication-audit findings.")
        return 0

    print(f"FAIL: {len(findings)} publication-audit finding(s).")
    for category, location, line in findings:
        print(f"- {category}: {location}:{line}")
    print("Matching values are intentionally not printed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
