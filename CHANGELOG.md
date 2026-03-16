# Changelog

All notable changes to the MCP Context Provider project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Claude Code Plugin Marketplace** (`.claude-plugin/`): `marketplace.json` and `plugin.json` for distribution via the Anthropic plugin marketplace and self-hosted marketplaces
  - MCP server auto-configured with `${CLAUDE_PLUGIN_ROOT}` path resolution
  - Plugin category: `code-intelligence`
  - Installable via `/plugin marketplace add doobidoo/MCP-Context-Provider`

### Fixed
- **MCP server connection failure with Claude Code**: Documented that Claude Code does not support the `cwd` field in MCP server configs — relative paths resolve from the wrong directory, causing silent connection failures. Added absolute path requirement notes to README.md and CLAUDE.md

## [2.0.0-alpha.5] - 2026-03-15

### Added
- **Instill Auto-Trigger Hook** (`hooks/instill-trigger.js`): Hybrid hook registered on both `UserPromptSubmit` and `PostToolUse` that detects user corrections and tool failures, tracks a per-session counter, and injects a `systemMessage` nudging Claude to suggest `/instill` when a configurable threshold is reached
  - 20+ correction detection patterns with false-positive filtering
  - Tool failure detection for Bash/Edit/Write (exit codes, tracebacks, permission errors) with benign-pattern exclusion
  - Weighted scoring: corrections 1.5x, failures 0.5x, combined threshold 3.0
  - Max 1 nudge per session, all thresholds tunable via CONFIG object
  - Per-session state stored in `/tmp/claude-instill-<session_id>.json`

### Fixed
- **`/instill` skill global installation**: Skill must be installed as `~/.claude/skills/instill/SKILL.md` (directory per skill), not as a loose `.md` file in the skills directory — updated README with correct symlink instructions

### Changed
- **README.md**: Added auto-trigger hook documentation, installation instructions, and scoring details; fixed skill installation path to use correct `<name>/SKILL.md` directory structure

## [2.0.0-alpha.4] - 2026-03-12

### Added
- **Changelog Archival Agent** (`.claude/agents/changelog-archival.md`): On-demand changelog rotation for major version transitions
- **Release Manager Agent** (`.claude/agents/github-release-manager.md`): Guided version bump, changelog update, tagging, and GitHub release workflow
- **Version Management Directive** (`.claude/directives/version-management.md`): Semver policy, two-file sync, pre-release phase progression
- **Release GitHub Actions Workflow** (`.github/workflows/release.yml`): Tag-triggered CI pipeline — test, build, create GitHub release with auto pre-release detection
- **`[Unreleased]` section** in CHANGELOG.md for accumulating changes between releases

### Changed
- **CHANGELOG.md**: Archived v1.x entries (v1.0.0–v1.8.4) to `docs/archive/CHANGELOG-v1.md`, keeping only v2.x entries
- **CLAUDE.md**: Added "Development Processes" section documenting agents, directives, and release workflow
- **.gitignore**: Track `.claude/agents/` and `.claude/directives/` alongside `.claude/skills/`

## [2.0.0-alpha.3] - 2026-03-10

### Fixed
- **`/instill` skill**: Replaced hardcoded Windows-style paths (`C:/REPOSITORIES/...`) with generic relative paths using `INSTINCTS_PATH` env var — skill was broken on macOS/Linux
- **`/instill` skill**: Documented that `learned.instincts.yaml` requires `version: "1.0"` and `instincts:` top-level wrapper; bare YAML appends caused schema validation errors on server startup (`Engine loaded: N errors`)
- **`/instill` skill**: Removed `usage_count` from instinct YAML template (field not in Zod schema)

## [2.0.0-alpha.2] - 2026-03-09

### Added
- **Node.js MCP Server** (`src/server/index.ts`): Full MCP protocol server wrapping the V2 Engine
  - stdio transport (default) for Claude Desktop and Claude Code
  - HTTP transport (`--http` flag) with Streamable HTTP on configurable port (default 3100)
  - `/health` endpoint for HTTP mode with engine status
  - 6 MCP tools: get_tool_context, get_syntax_rules, list_available_contexts, apply_auto_corrections, build_injection, list_instincts
- **`/instill` Skill**: Global Claude Code skill with interactive review flow (a/e/r shortcuts)
- **`mcp-context-provider` CLI**: Global binary to run the MCP server directly

### Fixed
- **context-loader.ts**: Missing closing brace causing build failure
- **9 context files**: Migrated to V2 Zod schema (auto_corrections format, session_initialization fields, priority enum values)
- **tool_category collision**: azure-vm-sql-server no longer collides with azure context

### Changed
- **Documentation**: Complete rewrite of CLAUDE.md, Installation guide, and MkDocs landing page for V2
- **Configuration**: .mcp.json and Claude Desktop config updated from Python to Node.js server

## [2.0.0-alpha.1] - 2026-03-08

### Changed
- **Complete TypeScript Rewrite**: Ground-up rewrite from Python to TypeScript
  - New dual-concept architecture: **Contexts** (static rules) and **Instincts** (learned rules)
  - ES2022 target, Node16 modules, strict mode throughout
  - Zod schema validation for both YAML instincts and JSON contexts

### Added
- **Instinct Engine**: Confidence-scored learned rules (0.0–1.0) with human approval workflow
  - YAML-based instinct files with Zod validation
  - Regex + substring trigger pattern matching
  - Outcome tracking with delta-confidence adjustments
- **Context Engine**: Static tool-specific context rules migrated from v1.8.x
  - JSON context file discovery (`*_context.json`)
  - Glob-style tool pattern matching (`*`, `git:*`, `bash:git`)
  - Priority-sorted matching (high > medium > low)
- **Unified Engine**: Coordinator that loads both contexts and instincts
  - `buildInjection(tool, input)` returns combined context + instinct rules
  - Optional Memory Bridge integration
- **Approval Registry CLI** (`mcp-cp`): Zero-dependency ANSI-formatted CLI
  - Commands: list, show, approve, reject, tune, outcome, remove
- **Memory Bridge**: HTTP integration with mcp-memory-service REST API
  - Instinct sync (push/pull), orphan detection, semantic discovery
  - Configurable base URL, API key, timeout
- **`/instill` Skill**: Claude Code skill for extracting instincts from sessions
- **Test Suite**: 61 vitest tests across 5 suites — all passing

### Removed
- Python server (`context_provider_server.py`)
- DXT packaging system
- Python-based CI scripts (retained for version checking compatibility)

---

> Older releases (v1.x) are archived in [docs/archive/CHANGELOG-v1.md](docs/archive/CHANGELOG-v1.md).
