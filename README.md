# MCP Context Provider

<div align="center">
  <img src="assets/MCP-CONTEXT-PROVIDER.png" alt="MCP Context Provider Architecture" width="600"/>

  *Persistent context and learned instincts for Claude Desktop and Claude Code — surviving across sessions.*
</div>

A TypeScript MCP server that gives Claude persistent **Contexts** (static tool rules) and **Instincts** (learned, confidence-scored rules distilled from sessions). No more re-establishing context in every new chat.

## Architecture

Two core concepts:

| Concept | Description | Size | Lifetime |
|---------|-------------|------|----------|
| **Context** | Static tool rules, syntax preferences, auto-corrections | 200–1000 tokens | Permanent, manually authored |
| **Instinct** | Learned rule extracted from sessions, confidence-scored | 20–80 tokens | Human-approved, evolves over time |

Four subsystems:

- **Engine** — loads, matches, and merges contexts + instincts into injection payloads
- **MCP Server** (`src/server/index.ts`) — stdio + HTTP transport, 6 MCP tools
- **CLI** (`mcp-cp`) — approval registry for instinct lifecycle management
- **Memory Bridge** — optional sync of instincts to mcp-memory-service

## Quick Start

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
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

### `/instill` Skill (Claude Code)

Install the skill globally as a symlink (stays current with `git pull`):

```bash
ln -s /path/to/mcp-context-provider/.claude/skills/instill.md ~/.claude/skills/instill.md
```

Then use `/instill` at the end of productive sessions to distill learned patterns into instinct candidates.

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_tool_context` | Get complete context for a tool category |
| `get_syntax_rules` | Get syntax-specific rules for a tool |
| `list_available_contexts` | List all loaded contexts |
| `apply_auto_corrections` | Apply correction patterns to text |
| `build_injection` | Combined context + instinct injection payload |
| `list_instincts` | List all instincts with confidence scores |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | `./contexts` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `./instincts` | Path to `*.instincts.yaml` files |
| `MEMORY_BRIDGE_URL` | — | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | — | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP server port (only with `--http`) |

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

Instincts are YAML files in `instincts/*.instincts.yaml`. They are distilled from sessions via `/instill` and require human approval.

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

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
