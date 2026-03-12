# Version Management Directive

## Version Sources (Two-File Sync)

Version MUST be consistent across exactly two files:

1. **`package.json`** — `"version"` field (authoritative source)
2. **`VERSION`** — plain text file, single line, no trailing newline

Both files must always match. The release manager agent handles this automatically.

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** — breaking changes to MCP tool API or context/instinct file format
- **MINOR** — new MCP tools, new engine features, new CLI commands
- **PATCH** — bug fixes, documentation, internal refactors

### Pre-Release Phase

Current phase: **alpha** (v2.0.0-alpha.x)

Progression: `alpha` → `beta` → `rc` → `stable`

- **alpha**: API may change, features incomplete, not for production
- **beta**: Feature-complete, API stabilizing, may have known issues
- **rc**: Release candidate, only critical fixes before stable
- **stable**: Production-ready (drop pre-release suffix)

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/):

- `[Unreleased]` section always at top for accumulating changes
- Sections: Added, Changed, Fixed, Removed (only include non-empty sections)
- Date format: YYYY-MM-DD
- Most recent release first

## Release Process

- Releases happen on the **main branch** (no release branches)
- Tag format: `vX.Y.Z` or `vX.Y.Z-pre.N` (e.g., `v2.0.0-alpha.4`)
- **Always use the Release Manager agent** (`.claude/agents/github-release-manager.md`)
- Never bump versions manually — the agent ensures consistency

## Version Bump Decision Matrix

| Change | Bump |
|--------|------|
| New MCP tool | MINOR |
| New CLI command | MINOR |
| New engine capability | MINOR |
| Bug fix | PATCH |
| Context/instinct file format change | MAJOR |
| MCP tool API change (params/response) | MAJOR |
| Documentation only | PATCH |
| Dependency update | PATCH |
| Pre-release increment | PRE (e.g., alpha.3 → alpha.4) |
