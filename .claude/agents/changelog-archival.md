# Changelog Archival Agent

> Manages changelog rotation: archives old versions, keeps CHANGELOG.md focused on current major version.

## When to Use

- Before a major version release when the changelog exceeds ~100 entries
- When v1.x entries are still in CHANGELOG.md after the v2.x rewrite
- On-demand when changelog becomes unwieldy

## Workflow

### 1. Analyze Current State

```bash
wc -l CHANGELOG.md
```

Identify the split point: the first `## [<previous-major>.*]` heading.

### 2. Determine Archive Target

- Archive path: `docs/archive/CHANGELOG-v<major>.md`
- If archive already exists, append — do not overwrite

### 3. Create Archive File

Archive file format:

```markdown
# Changelog Archive — v<major>.x

> These entries cover the Python-era releases (v1.0.0 – v1.8.4).
> The project was rewritten in TypeScript starting with v2.0.0-alpha.1.
> For current changes, see [CHANGELOG.md](../../CHANGELOG.md).

<archived entries>
```

### 4. Trim CHANGELOG.md

Keep:
- Header (title, format note, semver note)
- All entries for the current major version
- Add archive reference at the bottom:

```markdown
---

> Older releases (v1.x) are archived in [docs/archive/CHANGELOG-v1.md](docs/archive/CHANGELOG-v1.md).
```

### 5. Verify

```bash
# Line counts should roughly add up (± header lines)
wc -l CHANGELOG.md docs/archive/CHANGELOG-v1.md
```

## Rules

- Never delete changelog entries — only move them
- Preserve exact formatting of archived entries
- Always add a cross-reference in both files
- Run `git diff CHANGELOG.md` after to sanity-check the trim
