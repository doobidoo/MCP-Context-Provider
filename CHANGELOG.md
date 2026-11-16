# Changelog

All notable changes to the MCP Context Provider project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0-beta.4] - 2026-11-15

### Added
- **Context sync to the memory service** ([#7](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/7)): `sync_contexts` pushes every loaded context into mcp-memory-service, `restore_contexts` pulls them back and writes them into `CONTEXTS_PATH`. This existed in the v1.8 Python line and was dropped in the TypeScript rewrite. One memory per context: a one-line summary as the searchable content, the exact file text in `metadata.payload` — measured to round-trip byte for byte, where storing the file as memory content does not (the service splits it into overlapping chunks and returns one of them). Existing files are never overwritten without `force`, which keeps a `.bak`. A context opts out with `metadata.sync: false`, and contexts in subdirectories of `CONTEXTS_PATH` are never loaded and so never pushed. The round trip holds for contexts within the memory service's Cloudflare metadata limit; a context over that limit is refused at push time rather than silently dropped (see Fixed, below).

### Fixed
- **A second sync of unchanged content deleted the remote copy**: a push replaces a memory by deleting it and storing the same content again. The memory service hashes content only, and since 12.4.0 it refuses to re-create content it has a delete on record for unless the client sends `restore_deleted: true`. The bridge never sent it, so the store came back 409 right after the delete had gone through: the instinct or context was gone from the service and every later push failed the same way. Both store calls now send the flag. Content deleted on the service side therefore returns on the next push, which is what a push from the local files means.
- **The project `.mcp.json` pointed the bridge at a port nothing listens on**: it had `http://127.0.0.1:8001/api`, while the memory service defaults to port 8000 and so does `DEFAULT_BRIDGE_CONFIG`. The file now defaults to `http://127.0.0.1:8000/api` and takes `MEMORY_BRIDGE_URL` from the environment when it is set, so a local instance on HTTPS or another port needs no edit to a tracked file. The doc comment on `MemoryBridgeConfig.baseUrl` said 8001 as well.
- **A restore did not reach the running engine**: `Engine.initialize()` runs once at startup and nothing watches the contexts directory, so after `restore_contexts` wrote a file the engine kept serving — and pushing back — the text it had read before. On a second machine, a `restore_contexts --force` followed by a `sync_contexts` in the same session pushed the older local text over the newer remote copy, inverting what the feature promises. A pull that actually wrote something now re-reads the contexts directory, so both the injected contexts and the files `sync_contexts` pushes reflect what is on disk.
- **A conflict did not say what conflicted**: the design has `restore_contexts` report an existing file as a conflict "showing the local and remote `context_version`", but `ContextWriter` skipped it with a bare "file exists" and never read the version it already had in hand. The skip reason now names both — the remote version from the memory, the local one read from the file on disk, each falling back to `unknown` when it is missing or the local file is not parseable.
- **A pulled context's identity was never cross-checked**: `ContextWriter` validated the payload against the schema but never compared the `tool_category` inside it with the category the memory was stored under, and the no-overwrite guard is keyed on the file name while the engine keys a context by `tool_category`. A memory carrying any fresh, valid `file_name` was therefore written without `force` and then injected into sessions as instructions under whatever category it declared inside. A payload whose `tool_category` does not match the recorded category is now refused, with both values in the reason.
- **Two contexts declaring the same `tool_category` collided silently**: `ContextLoader.loadAll` keys its map by category, so the second file to load simply replaced the first, with directory order deciding the winner and nothing said about it. The collision is now reported in `errors`, naming both files. Which file wins is unchanged.
- **A service that ignored paging hung the session**: `ContextSync.pullFromMemory` left its loop only on a short page, so a service answering every request with a full page looped without end, growing an array, inside an MCP tool call. The pull now stops after `MAX_PULL_PAGES` (20) full pages — 1000 contexts at the page size it uses, against a store that holds tens — and throws rather than returning a truncated set that would look complete to the writer.
- **A failed list call looked like an empty store**: `HttpMemoryBridge.listContexts` returned `{ memories: [], total: 0 }` on any non-OK response, and the pull loop reads an empty page as "no more contexts". A 500 on the first page made `restore_contexts` report "nothing to restore"; a 500 on page three of five silently returned a partial set. It now throws with the HTTP status, the way `storeContext` already did, and the `restore_contexts` handler surfaces that as a tool error.
- **A rejected memory store looked like a success**: the memory service can answer a `/memories` POST with HTTP 200 and `{ success: false, content_hash: null }` — for example when its own semantic-duplicate detection rejects the content — and `HttpMemoryBridge.storeContext`/`storeInstinct` checked only the HTTP status, so `sync_contexts` and `sync_instincts` reported the item as pushed while nothing was stored. Found while verifying `sync_contexts` end to end against the live service: two synthetic contexts with near-identical summaries triggered the service's dedup and one push silently vanished. The response body is now checked for `success` and a string `content_hash`; a rejection now surfaces through the existing per-item `errors` list instead of being counted as pushed.
- **A context over the Cloudflare metadata limit synced without error and then vanished**: the memory service's Cloudflare tier enforces a flat 10KB cap on memory metadata (`CLOUDFLARE_MAX_METADATA_SIZE_KB`), but only on the background sync from local storage to the durable tier — the initial write still succeeds. Four contexts in this repository are over that line (dokuwiki 10.0KB, anti_ai_voice 13.9KB, n8n 18.4KB, azure 23.0KB): `sync_contexts` reported them pushed, they landed in local storage, and were then silently dropped before reaching Cloudflare. `ContextSync.pushToMemory` now measures the metadata it is about to send — including the `context_category` and `source` keys the bridge appends before serializing, which count against the limit too — the way the service itself measures it: as Python's `json.dumps(..., ensure_ascii=True)` would encode it, where every non-ASCII code point costs 6 bytes (12 for one outside the Basic Multilingual Plane) rather than its raw UTF-8 byte count. A first pass at this fix measured raw UTF-8 bytes and both undercounted non-ASCII-heavy metadata and missed those two appended keys — a context under the real cap by raw byte count could still be over it once escaped, the same silent-drop shape as the original bug, just for a narrower band of inputs; no context in this repository is in that band today. A context over the limit is now refused before anything is sent (default 9500 bytes, a margin under the service's flat cap — not a value taken from the service itself), reporting the actual size and the limit in `errors` instead. The limit is a constructor option, so a deployment without the Cloudflare tier can raise or disable it. Chunking oversized metadata is out of scope here.
- **A failed lookup let a push leave the old copy behind**: a push finds the memory it is about to replace by tag, deletes it and stores the new one. `HttpMemoryBridge.searchByTags` answered a failed search with an empty list, which reads as "nothing to replace": the store went through and, once the summary had changed, the old copy stayed next to the new one, for `restore_contexts` to pick up. It now throws with the HTTP status, and the push reports that item as an error and stores nothing. This applies to `sync_instincts` as well.
- **A custom context tag made every push miss its previous copy**: the bridge stores and lists contexts under `contextTag` from its config, but `ContextSync` searched with the literal `context-json`. The lookup now goes through `findContexts` on the bridge, which uses the configured tag.
- **A push accepted file names a restore refuses**: the loader takes any `*_context.json`, the writer only lowercase basenames. `MyProject_context.json` was reported as pushed and could never be written back. Such a name is now refused at push time with the rule in the error.
- **A restore replaced an existing file it could not read**: `ContextWriter` treated every failed read as "file missing", so a context that existed but was unreadable was overwritten without `force` and without a `.bak`. Only `ENOENT` counts as missing now; any other read error skips the item and says why.
- **Two overlapping restores could overwrite each other**: both saw the target missing and both renamed into place, and within one process they shared a temp file name. An unforced write now links the temp file into place, which fails if the target appeared in the meantime, and temp names are random.
- **A restore into a directory that did not exist yet wrote nothing**: on a new machine with a fresh `CONTEXTS_PATH` every write failed with `ENOENT`. The directory is now created.

## [2.0.0-beta.3] - 2026-09-02

### Changed
- **The instinct store has exactly one source**: the engine and the CLI read `learned.instincts.yaml` and nothing else. Previously every `*.instincts.yaml` in the store directory was merged together, which made "which file is this instinct in" unanswerable and let a second file drift in unnoticed. Any other instinct file in the directory is now reported by name at startup and by `mcp-cp list`, together with the `mcp-cp import` command that merges it — present and visible, never silently mixed in.
- **`mcp-cp import` always writes to the canonical file**; the `--into <name>` flag is gone, because importing into any other name produced a file the engine would never read.

### Fixed
- **A test passed locally and failed in CI**: the durability test for an unreadable store used `chmod 000`, which root ignores. Woodpecker runs the suite as root in a `node:20` container, so the read succeeded there, `append()` did not throw, and the test failed — while passing for any normal user. It now puts a directory where the store file belongs, which fails with `EISDIR` for every uid.
- **A store that could not be parsed was silently replaced by an empty one**: `InstinctLoader.append()` and the `store_instinct` handler both fell back to `{version, instincts: {}}` on *any* load failure and then saved that over the existing file. One transient parse failure was enough to discard a whole store — a 232-instinct store was wiped down to a single entry this way. Loading now falls back to an empty file only on `ENOENT`; an existing file that cannot be read or parsed raises an error naming the file instead of overwriting it.
- **Writes are atomic**: `InstinctLoader.save()` writes to a temporary file and renames it into place, so an interrupted or concurrent write can no longer leave a half-written store on disk for the next load to choke on.
- **The whole pipeline failed to compile**: the `validate-json` step's one-liner contained `echo "Checking: $(basename $f)"`, and YAML read the `: ` inside it as a mapping separator, so the command parsed as a map instead of a string. Every run — push and pull request alike — ended as `error` before a single step executed. Rewritten as a block scalar. This had been latent since the step was written; nothing ran it until the repository was enabled at ci.codeberg.org.
- **The Woodpecker UI's "Run pipeline" button did nothing**: `manual` was missing from the top-level event filter, so a hand-triggered run was skipped in full — the same class of defect as the missing `tag` event, and just as silent. Added.
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
