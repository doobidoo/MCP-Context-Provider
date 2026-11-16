# MCP Context Provider

> **Status:** beta — feature-complete, API stabilizing. See [CHANGELOG.md](CHANGELOG.md) for the latest release.

  https://github.com/user-attachments/assets/d9c6c325-00f1-44d9-a805-b1d6588c0acf
  
  *Persistent context and learned instincts for Claude Desktop and Claude Code — surviving across sessions.*

A TypeScript MCP server that gives Claude persistent **Contexts** (static tool rules) and **Instincts** (learned, confidence-scored rules distilled from sessions). No more re-establishing context in every new chat.

## Architecture

Two core concepts:

| Concept | Description | Size | Lifetime |
|---------|-------------|------|----------|
| **Context** | Static tool rules, syntax preferences, auto-corrections | 200–1000 tokens | Permanent, manually authored |
| **Instinct** | Learned rule extracted from sessions, confidence-scored | 20–80 tokens | Inactive until approved, evolves over time |

Four subsystems:

- **Engine** — loads, matches, and merges contexts + instincts into injection payloads
- **MCP Server** (`src/server/index.ts`) — stdio + HTTP transport
- **CLI** (`mcp-cp`) — approval registry for instinct lifecycle management
- **Memory Bridge** — optional sync of instincts and contexts to mcp-memory-service

## Quick Start

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install
npm run build
npm link   # optional: puts mcp-cp and mcp-context-provider on your PATH
```

Without `npm link`, run the CLI as `node dist/cli/index.js` wherever this
README says `mcp-cp`.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "node",
      "args": ["/path/to/mcp-context-provider/dist/server/index.js"],
      "env": {
        "CONTEXTS_PATH": "/path/to/mcp-context-provider/contexts",
        "INSTINCTS_PATH": "/path/to/mcp-context-provider/instincts"
      }
    }
  }
}
```

### Claude Code (global)

Add to `~/.claude.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "node",
      "args": ["/path/to/mcp-context-provider/dist/server/index.js"],
      "env": {
        "CONTEXTS_PATH": "/path/to/mcp-context-provider/contexts",
        "INSTINCTS_PATH": "/path/to/mcp-context-provider/instincts"
      }
    }
  }
}
```

> **Important:** Use absolute paths for both `args` and `env` values. Claude Code does not support the `cwd` field in MCP server configs — relative paths will resolve from the wrong directory and the server will fail to connect.

### Claude Code Plugin (Marketplace)

Install directly from the marketplace:

```bash
/plugin marketplace add doobidoo/MCP-Context-Provider
/plugin install context-provider@mcp-context-provider
```

The plugin registers the MCP server with paths inside the plugin directory, so
there is no config file to edit. Two things to know:

- **Build it once.** The repository does not ship the compiled server
  (`dist/` is not checked in), and the plugin starts
  `dist/server/index.js`. Run `npm install && npm run build` in the installed
  plugin directory, below `~/.claude/plugins/`, then restart Claude Code.
  Repeat after a plugin update.
- **The store is in the plugin directory.** The plugin sets `INSTINCTS_PATH` to
  its own `instincts/` folder instead of the user-level default described under
  [Store Location](#store-location). `list_instincts` reports the path in use.

### `/instill` Skill (Claude Code)

Install the skill globally (stays current with `git pull`):

```bash
mkdir -p ~/.claude/skills/instill
ln -s /path/to/mcp-context-provider/.claude/skills/instill.md ~/.claude/skills/instill/SKILL.md
```

Then use `/instill` at the end of productive sessions to distill learned patterns into instinct candidates.

### Auto-Trigger Hook (Optional)

The instill-trigger hook automatically detects mistakes during a session and nudges Claude to suggest `/instill` when a threshold is reached. It monitors:

- **User corrections** (UserPromptSubmit) — "no not that", "that's wrong", "still broken", etc.
- **Tool failures** (PostToolUse) — non-zero exit codes, tracebacks, permission errors

Install the hook:

```bash
cp hooks/instill-trigger.js ~/.claude/hooks/core/instill-trigger.js
```

Register in `~/.claude/settings.json` under both `UserPromptSubmit` and `PostToolUse`:

```json
{
  "type": "command",
  "command": "node --no-warnings \"~/.claude/hooks/core/instill-trigger.js\"",
  "timeout": 3
}
```

**Scoring:** Corrections weighted 1.5x, tool failures 0.5x. Combined threshold: 3.0. Max 1 nudge per session. All tunable via `CONFIG` object in the hook file.

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_tool_context` | Get complete context for a tool category |
| `get_syntax_rules` | Get syntax-specific rules for a tool |
| `list_available_contexts` | List all loaded contexts |
| `apply_auto_corrections` | Apply correction patterns to text |
| `build_injection` | Combined context + instinct injection payload |
| `list_instincts` | List all instincts with confidence scores, plus the resolved store path |
| `store_instinct` | Store a new instinct candidate (inactive until approved) |
| `approve_instinct` | Approve an instinct for active use (sets `approved_by` to `human`) |
| `reject_instinct` | Deactivate an instinct and lower its confidence |
| `record_outcome` | Record a positive, negative, or neutral outcome for an instinct |
| `sync_instincts` | Push all local instincts to the memory service (requires the memory bridge) |
| `sync_contexts` | Push all loaded contexts to the memory service |
| `restore_contexts` | Pull contexts from the memory service into `CONTEXTS_PATH` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | packaged `contexts/` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `~/.local/share/mcp-context-provider/instincts` | Directory holding `learned.instincts.yaml` — see [Store Location](#store-location) |
| `MEMORY_BRIDGE_URL` | — | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | — | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP server port (only with `--http`) |
| `MCP_CP_AUTO_REPAIR` | `1` | Write a repaired instinct file back to disk (a `.bak` is kept). Set to `0` to repair in memory only |

## Store Location

The instincts store never depends on the directory the MCP host happened to launch
the server from. It resolves in this order:

1. `INSTINCTS_PATH` — explicit override, always wins
2. `./instincts` — only when the working directory is an `mcp-context-provider`
   checkout (the development case)
3. `$XDG_DATA_HOME/mcp-context-provider/instincts` — when `XDG_DATA_HOME` is set
4. `~/.local/share/mcp-context-provider/instincts` — the default

Contexts resolve the same way, except the fallback is the `contexts/` directory
shipped with the package: contexts are authored and versioned with the code,
instincts are learned user data.

To see which store is active:

```bash
mcp-cp path                     # prints the resolved directory
node dist/server/index.js       # logs both paths to stderr at startup
```

The resolved path is also part of the `list_instincts` response (`store.path`,
`store.resolved_from`) and of the `/health` payload in HTTP mode.

If the resolved store sits inside a git working tree that is not this
repository's checkout, the server warns at startup — that is the signal it
picked up a working directory by accident and that learned instincts are about
to be committed somewhere they do not belong.

Merging a store from elsewhere:

```bash
mcp-cp import /path/to/learned.instincts.yaml --dry-run   # preview
mcp-cp import /path/to/learned.instincts.yaml             # merge
```

The merge always targets the canonical `learned.instincts.yaml`.

Existing ids are never overwritten — a merge only adds. Legacy file shapes
(top-level array, or `instincts:` as a list) are normalized on read.

## Context Sync

Contexts can be pushed to mcp-memory-service and written back on another
machine. Requires `MEMORY_BRIDGE_URL`.

- `sync_contexts` — push every loaded context. One memory per context: a
  one-line summary as the searchable content, the exact file text in
  `metadata.payload`.
- `restore_contexts` — pull them and write into `CONTEXTS_PATH`. Files that
  already exist are left untouched and reported; `force: true` overwrites and
  keeps a `.bak`.

A context is not pushed if its `metadata.sync` is `false`. Contexts in
subdirectories of `CONTEXTS_PATH` are never loaded and therefore never pushed
— that is where private, machine-local contexts belong.

A push replaces the remote copy by deleting it and storing the same content
again. From 12.4.0 on, mcp-memory-service refuses to re-create content it has a
delete on record for unless the client asks for it; the bridge sends
`restore_deleted: true` with every store, so repeated syncs of unchanged
content keep exactly one memory per context. Verified against
mcp-memory-service 12.10.0.

If the service runs on HTTPS with a certificate from a private CA (mkcert, for
example), point Node at the CA file with `NODE_EXTRA_CA_CERTS`, and set
`MEMORY_BRIDGE_API_KEY` when the service requires a key.

A context whose serialized metadata exceeds mcp-memory-service's Cloudflare
sync limit is refused at push time, with the size and limit named in the
error, rather than being accepted locally and silently dropped before it
reaches the durable tier.

## Context Files

Contexts are JSON files in `contexts/*_context.json`. Each file matches one or more tools via glob patterns and injects static rules.

```json
{
  "tool_category": "git",
  "description": "Git workflow rules",
  "auto_convert": false,
  "metadata": {
    "version": "1.0.0",
    "applies_to_tools": ["git:*", "Bash"],
    "priority": "high"
  },
  "syntax_rules": { ... },
  "auto_corrections": {
    "fix-1": { "pattern": "...", "replacement": "..." }
  }
}
```

Add a new context by dropping a `*_context.json` file in `contexts/` and restarting the server.

## Instincts

Instincts live in exactly one file, `learned.instincts.yaml`, inside the
resolved store (see [Store Location](#store-location)). They are distilled from
sessions via `/instill`. A candidate stored through `store_instinct` starts
inactive and is injected only after `approve_instinct` or `mcp-cp approve`.

Any other `*.instincts.yaml` in that directory is **not** read. It is reported
by name at startup and by `mcp-cp list`, together with the `mcp-cp import`
command that merges it — so a second file can never drift into the store
unnoticed, and no instinct is ever loaded from a file you did not intend.

```yaml
version: "1.0"

instincts:
  my-rule:
    id: my-rule
    rule: "Compact, actionable rule (20–80 tokens)."
    domain: git
    tags: [git, workflow]
    trigger_patterns:
      - "git commit"
    confidence: 0.75
    min_confidence: 0.5
    approved_by: human
    active: true
    created_at: "2026-03-10T00:00:00Z"
    outcome_log: []
```

Manage instincts with the CLI:

```bash
mcp-cp list
mcp-cp show <id>
mcp-cp approve <id>
mcp-cp reject <id>
mcp-cp tune <id> --confidence 0.8
mcp-cp outcome <id> + "worked well"
mcp-cp remove <id>
mcp-cp path
mcp-cp import <file> [--dry-run]
```

## Development

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm run lint      # Type-check only
npm test          # Run tests (vitest)
npm start         # stdio transport
npm run start:http  # HTTP transport on port 3100
```

## FAQ

### Can I use `/instill` in Claude Desktop?

Not as a slash command: `/instill` ships as a **Claude Code skill**
(`.claude/skills/instill.md`). The instinct lifecycle itself is available in
Claude Desktop, because it runs through the MCP server:

1. **All MCP tools work in both clients.** `store_instinct` saves a candidate
   as inactive, `approve_instinct` activates it, `reject_instinct` and
   `record_outcome` maintain it. No file editing is involved, and the server
   validates every entry.
2. **For the analysis step**, create a Claude Desktop **Project** and paste the
   instructions from `instill.md` as Custom Instructions. Claude then proposes
   candidates from the conversation and stores the ones you accept with
   `store_instinct`.

Do not let a client write `learned.instincts.yaml` directly when the MCP tools
are reachable. Hand-written YAML is where malformed store files have come from.

The analysis is a skill and not an MCP tool because it is an **interactive,
multi-step workflow** (read the conversation, present candidates, wait for your
decision). An MCP tool returns one response and cannot drive that exchange.

### Do `learned.instincts.yaml` files contain sensitive data?

Potentially yes. Instincts distilled from work sessions may contain internal hostnames, customer names, infrastructure details, or operational procedures.

This is why the default store is a user-level directory outside any repository
(`~/.local/share/mcp-context-provider/instincts`) and why the server warns when
the resolved store sits inside an unrelated git working tree. If you do point
`INSTINCTS_PATH` at a checkout, add `instincts/learned.instincts.yaml` to that
repository's `.gitignore` and **review its contents before pushing**. The Quick
Start examples point it at this repository's `instincts/` folder, where the
file is already ignored. Leaving `INSTINCTS_PATH` out selects the user-level
default, unless the server is started from inside this checkout, where
`./instincts` still wins (see [Store Location](#store-location)).

The same applies to the Memory Bridge: `sync_instincts` sends the rule text,
trigger patterns and tags of every instinct to the configured
mcp-memory-service. Only sync to a service you trust with that content.

### What is the difference between Contexts and Instincts?

| | Contexts | Instincts |
|---|---|---|
| **Format** | JSON (`*_context.json`) | YAML (`learned.instincts.yaml`) |
| **Source** | Manually authored | Distilled from sessions via `/instill` |
| **Size** | 200-1000 tokens | 20-80 tokens (target; 5-120 accepted) |
| **Matching** | Tool-pattern globs | Regex trigger patterns |
| **Lifecycle** | Static, versioned | Confidence-scored, evolves over time |
| **Approval** | None needed | Candidates start inactive until approved |

What decides whether an instinct is injected is `active` and its confidence
against `min_confidence`. `approved_by` records who approved it (`human` or
`auto`) and is not checked at injection time. An entry added to the YAML by
hand without `active: false` is therefore live immediately; `active` defaults
to `true`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
