# Changelog

All notable changes to the MCP Context Provider project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **A store that could not be parsed was silently replaced by an empty one**: `InstinctLoader.append()` and the `store_instinct` handler both fell back to `{version, instincts: {}}` on *any* load failure and then saved that over the existing file. One transient parse failure was enough to discard a whole store — a 232-instinct store was wiped down to a single entry this way. Loading now falls back to an empty file only on `ENOENT`; an existing file that cannot be read or parsed raises an error naming the file instead of overwriting it.
- **Writes are atomic**: `InstinctLoader.save()` writes to a temporary file and renames it into place, so an interrupted or concurrent write can no longer leave a half-written store on disk for the next load to choke on.
- **The whole pipeline failed to compile**: the `validate-json` step's one-liner contained `echo "Checking: $(basename $f)"`, and YAML read the `: ` inside it as a mapping separator, so the command parsed as a map instead of a string. Every run — push and pull request alike — ended as `error` before a single step executed. Rewritten as a block scalar. This had been latent since the step was written; nothing ran it until the repository was enabled at ci.codeberg.org.
- **The Woodpecker UI's "Run pipeline" button did nothing**: `manual` was missing from the top-level event filter, so a hand-triggered run was skipped in full — the same class of defect as the missing `tag` event, and just as silent. Added.

### Fixed
- **License metadata contradicted the LICENSE file**: `package.json`, both `.claude-plugin` manifests, `mkdocs.yml` and the README/docs license sections all said MIT, while `LICENSE` has been Apache-2.0 since the initial commit. The LICENSE file is the operative grant, so the metadata was corrected to Apache-2.0. This is not a relicensing — it aligns the metadata with the licence that was always in effect.
- **Woodpecker never ran on tags**: the top-level `when: event: [push, pull_request]` gated the whole pipeline, so a tag event started nothing and the `release` step's own `when: event: tag` was unreachable. `tag` is now part of the top-level filter, so a release tag runs the same gates as a push.
- **The `release` step promised more than it did**: it re-ran `npm ci`, `npm run build` and `npm test` — the same gates as the steps above it — and created no release and published no package. Removed. The Codeberg release is created via the Forgejo API by the release manager, and `npm publish` stays manual until a registry token exists as a Woodpecker secret. `CLAUDE.md` and the release-manager agent described the pipeline as "test to build to release" and have been corrected.

## [2.0.0-beta.2] - 2026-08-26

### Fixed
- **Instincts store no longer depends on the launch directory** ([#1](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/1)): the default was `./instincts` resolved against whatever CWD the MCP host started the server from, so the store silently split per launch directory — four disjoint stores had accumulated with zero overlap between them, and instincts had landed in unrelated repositories. Resolution is now `INSTINCTS_PATH` → `./instincts` only when the CWD is an `mcp-context-provider` checkout → `$XDG_DATA_HOME/mcp-context-provider/instincts` → `~/.local/share/mcp-context-provider/instincts`.
- **Contexts path had the same CWD dependency**: `CONTEXTS_PATH` → `./contexts` when in a checkout → the `contexts/` directory shipped with the package. Contexts are versioned with the code, so the packaged directory is the correct fallback.
- **Server and CLI could operate on different stores**: both now resolve through `src/config/paths.ts`. `mcp-cp` no longer defaults to `./instincts`.
- **Loader rejected files whose `instincts:` key held a list** instead of a map keyed by id — a shape some `/instill` runs produced. It is now normalized like the legacy top-level array form, and a missing or unknown `version` is defaulted to `"1.0"` instead of failing the schema literal.
- **Server version was hardcoded** (`2.0.0-alpha.6` while the package was at `2.0.0-beta.1`) and is now read from `package.json`.

### Added
- **`mcp-cp import <file>`**: merge a YAML instinct file into the active store. Existing ids are never overwritten; legacy shapes are repaired on read. `--into <name>` picks the target file, `--dry-run` previews.
- **`mcp-cp path`**: print the resolved store directory and which rule produced it.
- **Startup path logging**: both resolved paths go to stderr at startup, and the server warns when the store sits inside a git working tree that is not this repository's checkout — the signal that a CWD was picked up by accident.
- **`list_instincts`** now returns `store: { path, resolved_from }`, and the HTTP `/health` payload reports both paths plus the server version. A store you cannot locate from inside a session is a store you cannot trust.

### Changed
- **`/instill` skill** ([.claude/skills/instill.md](.claude/skills/instill.md)): the documented file-edit fallback named `~/.claude/skills/instill/instincts/`, a path the server has never read — instincts written there were stranded. The skill now names the same locations the server resolves, tells you to ask `mcp-cp path`, and describes direct file edits as a last resort rather than an equivalent path.

## [2.0.0-beta.1] - 2026-05-21

### Changed
- **Phase transition: alpha → beta.** Feature set is complete (10 MCP tools, stdio + HTTP transport, full CLI, memory bridge, auto-repair loader, plugin marketplace integration, hooks). API is stabilizing — no breaking changes planned before stable.
- **README**: tool count corrected from 6 → 10 (write tools shipped in alpha.7 were never reflected in the architecture summary)
- **README**: added explicit `Status: beta` line under the title
- **CLAUDE.md**: removed pinned alpha.5 reference from header (was stale since alpha.6), now reads `(v2.0 beta)` to avoid future drift
- **Version directive** (`.claude/directives/version-management.md`): current phase pointer alpha → beta

### Fixed
- **`/instill` skill** ([.claude/skills/instill.md](.claude/skills/instill.md)): frontmatter `user_invocable` moved into `metadata` block to match the schema; description rewritten in the `Use when…` trigger format
- **`/instill` skill**: instincts directory now resolves with a global fallback. Order: (1) `INSTINCTS_PATH` env, (2) `./instincts/` only when CWD is the mcp-context-provider repo, (3) `~/.claude/skills/instill/instincts/`. Previously the skill assumed it was always running inside the repo, which broke when invoked from other projects.

## [2.0.0-alpha.10] - 2026-05-21

### Fixed
- **`anti_ai_voice` context** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): Removed non-matchable `em_dash_excessive` entry from `auto_corrections` (pattern was a plain English sentence, not a regex; logic is covered by `banned_patterns.em_dash_overuse`)
- **`anti_ai_voice` context** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): `"nachhaltig (als Buzzword)"` → `"nachhaltig"` in `tier4_german_buzzwords` — parenthetical was matched as part of the literal string
- **`anti_ai_voice` context** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): Renamed `auto_corrections` keys `"delve into"` / `"delve deeper"` → `"delve_into"` / `"delve_deeper"` for consistency with all other keys
- **`list_instincts` MCP tool** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): Added `Number.isNaN` guard for `limit` and `offset` — non-numeric inputs previously produced `NaN`, causing `slice()` to return an empty array silently
- **`list_instincts` MCP tool** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): Removed JSON pretty-print (`null, 2`) from response to reduce payload size and mitigate MCP client truncation at the ~40–50 KB limit
- **CLI `mcp-cp list` silently swallows YAML parse errors** ([#12](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/12), [#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): `listAll()` and `find()` now write a `⚠ Skipped <file>: <message>` warning to stderr instead of silently dropping invalid instinct files. `listAll()` returns `{ entries, skipped }` for programmatic access to parse failures.

### Added
- **`mcp-cp list --strict`** ([#16](https://codeberg.org/doobidoo/MCP-Context-Provider/pull/16)): New flag that exits non-zero when any instinct file fails to parse — useful for CI pipelines. Summary line now shows skipped file count with a hint to use `--strict`.

## [2.0.0-alpha.9] - 2026-04-10

### Fixed
- **`/instill` skill routing** ([#10](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/10)): The skill now delegates to the `store_instinct` MCP tool instead of writing YAML directly, ensuring every new instinct flows through the same validation and repair pipeline as the loader.
- **`memory_context` priority enum**: Changed priority from `critical` to `high` to match the Zod context schema enum — the invalid value was silently rejected on load.

### Changed
- **`.gitignore`**: excluded `contexts/linkedin_context.json` (local-only context) and timestamped `*.bak-*` backup files created by the auto-repair loader.

## [2.0.0-alpha.8] - 2026-04-10

### Fixed
- **Legacy instinct YAML files silently dropped on load** ([#10](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/10)): Earlier versions of the `/instill` skill appended new instincts as top-level YAML arrays, which the strict Zod schema silently rejected. Users lost every learned instinct without noticing — reporter had 87 entries accumulated over ~6 weeks that were never injected.

### Added
- **Auto-repair loader** (`src/engine/instinct-loader.ts`): The loader now detects and auto-corrects three classes of damage at the system boundary:
  - **Shape normalization**: top-level array → canonical `{version, instincts}` object
  - **ID synthesis**: entries without `id` get a kebab-case slug generated from the first 4 words of their rule text
  - **Collision resolution**: duplicate ids are suffixed numerically (`foo` → `foo-2`)
- **Repair reporting**: every fix is tracked in a `RepairAction[]` report returned alongside the parsed file. New methods: `loadWithRepairs()`, `repair()`. The `repair()` method persists canonical form back to disk with a `.bak` copy of the original.
- **Engine auto-repair integration**: `Engine.initialize()` now collects repairs per file and, when `autoRepair: true`, persists corrections to disk. New accessor `getFileRepairs()`.
- **`MCP_CP_AUTO_REPAIR` environment variable**: enables persistent repair mode in the server (default: `1`). Set to `0` to keep `initialize()` side-effect free (in-memory corrections only).
- **8 regression tests** (`src/__tests__/instinct-loader.test.ts`): canonical load, array normalization, id synthesis, collision resolution, entries too short to slug, content-validation-after-repair, persistent repair with `.bak` handling, no-op repair on clean files.

### Changed
- **Visible load errors on stdio startup**: the server now logs every repaired file with its actions, plus full Zod validation errors for unrecoverable files. Previously only bare filenames were shown, hiding the root cause from users.

## [2.0.0-alpha.7] - 2026-03-26

### Added
- **Instinct write tools for MCP server**: 4 new MCP tools (`store_instinct`, `approve_instinct`, `reject_instinct`, `record_outcome`) that delegate to the existing Registry class - Claude Desktop could only read instincts but not write them. Server now exposes 10 tools (was 6)
- **Claude Code Plugin Marketplace** (`.claude-plugin/`): `marketplace.json` and `plugin.json` for distribution via the Anthropic plugin marketplace and self-hosted marketplaces
  - MCP server auto-configured with `${CLAUDE_PLUGIN_ROOT}` path resolution
  - Plugin category: `code-intelligence`
  - Installable via `/plugin marketplace add doobidoo/MCP-Context-Provider`

### Fixed
- **MCP server connection failure with Claude Code**: Documented that Claude Code does not support the `cwd` field in MCP server configs — relative paths resolve from the wrong directory, causing silent connection failures. Added absolute path requirement notes to README.md and CLAUDE.md

## [2.0.0-alpha.6] - 2026-03-26

### Fixed
- **MCP SDK crash with Claude.ai**: Updated `@modelcontextprotocol/sdk` from 1.27.1 to 1.28.0 to support protocol version `2025-11-25` sent by Claude.ai - SDK 1.27.1 crashed silently on unrecognized protocol versions

### Changed
- **DokuWiki context**: Updated literal_text rules and bridge port configuration
- **MCP config**: Updated `.mcp.json` server configuration

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
- **Release Manager Agent** (`.claude/agents/codeberg-release-manager.md`): Guided version bump, changelog update, tagging, and Codeberg release workflow
- **Version Management Directive** (`.claude/directives/version-management.md`): Semver policy, two-file sync, pre-release phase progression
- **Release CI Pipeline** (`.woodpecker.yml`): Tag-triggered CI pipeline — test, build, create Codeberg release with auto pre-release detection
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
