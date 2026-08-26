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
| **Instinct** | Learned rule extracted from sessions, confidence-scored | 20–80 tokens | Human-approved, evolves over time |

Four subsystems:

- **Engine** — loads, matches, and merges contexts + instincts into injection payloads
- **MCP Server** (`src/server/index.ts`) — stdio + HTTP transport, 10 MCP tools
- **CLI** (`mcp-cp`) — approval registry for instinct lifecycle management
- **Memory Bridge** — optional sync of instincts to mcp-memory-service

## Quick Start

```bash
git clone https://codeberg.org/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install
npm run build
```

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

Add to `~/.mcp.json`:

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
/plugin marketplace add codeberg/doobidoo/MCP-Context-Provider
/plugin install context-provider
```

This auto-configures the MCP server with correct paths — no manual `.mcp.json` editing needed.

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | packaged `contexts/` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `~/.local/share/mcp-context-provider/instincts` | Path to `*.instincts.yaml` files — see [Store Location](#store-location) |
| `MEMORY_BRIDGE_URL` | — | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | — | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP server port (only with `--http`) |

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

Existing ids are never overwritten — a merge only adds. Legacy file shapes
(top-level array, or `instincts:` as a list) are normalized on read.

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

Instincts are YAML files named `*.instincts.yaml` in the resolved store (see
[Store Location](#store-location)). They are distilled from sessions via
`/instill` and require human approval.

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
mcp-cp path
mcp-cp import <file> [--into <name>] [--dry-run]
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

No. `/instill` is a **Claude Code skill** (`.claude/skills/instill.md`) and only works in the Claude Code CLI. Claude Desktop does not have a skill system.

However, you can achieve the same result in Claude Desktop:

1. **MCP tools work in both** - The `list_instincts` and `build_injection` tools are available in Claude Desktop via the MCP server.
2. **For the instill workflow**, create a Claude Desktop **Project** and paste the instill instructions as Custom Instructions. Claude Desktop can then use `desktop-commander` or similar MCP servers to write YAML files.

The reason `/instill` is not exposed as an MCP tool: it is an **interactive, multi-step workflow** (analyze conversation, present candidates, await user decision, write YAML). MCP tools return a single response and cannot drive multi-turn interactions.

### Do `learned.instincts.yaml` files contain sensitive data?

Potentially yes. Instincts distilled from work sessions may contain internal hostnames, customer names, infrastructure details, or operational procedures.

This is why the default store is a user-level directory outside any repository
(`~/.local/share/mcp-context-provider/instincts`) and why the server warns when
the resolved store sits inside an unrelated git working tree. If you do point
`INSTINCTS_PATH` at a checkout, add `instincts/learned.instincts.yaml` to that
repository's `.gitignore` and **review its contents before pushing**.

### What is the difference between Contexts and Instincts?

| | Contexts | Instincts |
|---|---|---|
| **Format** | JSON (`*_context.json`) | YAML (`*.instincts.yaml`) |
| **Source** | Manually authored | Distilled from sessions via `/instill` |
| **Size** | 200-1000 tokens | 20-80 tokens |
| **Matching** | Tool-pattern globs | Regex trigger patterns |
| **Lifecycle** | Static, versioned | Confidence-scored, evolves over time |
| **Approval** | None needed | Requires `approved_by: human` |

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
