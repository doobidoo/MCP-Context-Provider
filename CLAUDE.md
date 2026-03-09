# CLAUDE.md — mcp-context-provider v2.x

> Clean rewrite from Python v1.8.x to TypeScript.

## Architecture

Two core concepts:

- **Contexts** (static): 200–1000 tokens, manually authored, always injected at full confidence
- **Instincts** (learned): 20–80 tokens, distilled from sessions, confidence-scored (0.0–1.0), human-approved

Four subsystems:

- **Engine** — loads, matches, and merges contexts + instincts into injection payloads
- **MCP Server** (`src/server/index.ts`) — stdio + HTTP transport, 6 MCP tools
- **CLI** (`mcp-cp`) — approval registry for instinct lifecycle management
- **Memory Bridge** — syncs instincts to mcp-memory-service via HTTP API

## Project Structure

```
src/
  server/             MCP Server (stdio + HTTP transport)
    index.ts          Entry point, tool handlers, transport selection
  types/              TypeScript type definitions
    instinct.ts       Instinct, OutcomeEntry, InstinctCandidate, InstinctQuery
    context.ts        Context, StoreTrigger, RetrieveTrigger, ContextMetadata
    index.ts          Re-exports
  schema/             Zod validation schemas
    instinct.schema.ts
    context.schema.ts
  engine/             Core engines
    engine.ts         Unified Engine (contexts + instincts + memory bridge)
    context-loader.ts JSON context discovery + validation
    context-matcher.ts Tool-pattern matching with glob support
    instinct-loader.ts YAML load/save with Zod validation
    instinct-matcher.ts Regex trigger-pattern matching
  bridge/             Memory Bridge (mcp-memory-service integration)
    types.ts          IMemoryBridge interface, config, response types
    http-bridge.ts    HTTP implementation (fetch-based, zero deps)
    sync.ts           Bidirectional YAML ↔ Memory sync
  cli/                Approval Registry CLI (mcp-cp)
    index.ts          CLI entry point + argument parser
    registry.ts       approve/reject/tune/outcome/remove operations
    formatter.ts      ANSI terminal formatting

instincts/            YAML instinct files (*.instincts.yaml)
contexts/             JSON context files (*_context.json)
.claude/skills/       Claude Code skills
  instill.md          /instill — distill instincts from session
```

## Commands

```bash
# Build & Test
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm run lint      # Type-check only
npm test          # Run tests (vitest)

# Run MCP Server
npm start              # stdio transport (default)
npm run start:http     # HTTP transport on port 3100

# CLI — Instinct Registry
mcp-cp list                          # List all instincts
mcp-cp show <id>                     # Detail view
mcp-cp approve <id>                  # Human approval
mcp-cp reject <id>                   # Deactivate
mcp-cp tune <id> --confidence 0.8    # Tune parameters
mcp-cp outcome <id> + "note"         # Record positive outcome
```

## MCP Server

The server exposes 6 tools via MCP protocol:

| Tool | Description |
|------|-------------|
| `get_tool_context` | Get complete context for a tool category |
| `get_syntax_rules` | Get syntax-specific rules for a tool |
| `list_available_contexts` | List all loaded contexts |
| `apply_auto_corrections` | Apply correction patterns to text |
| `build_injection` | Combined context + instinct injection payload |
| `list_instincts` | List all instincts with confidence scores |

### Transport Modes

**stdio** (default) — for Claude Desktop and Claude Code:
```json
{
  "command": "node",
  "args": ["dist/server/index.js"],
  "env": {
    "CONTEXTS_PATH": "./contexts",
    "INSTINCTS_PATH": "./instincts"
  }
}
```

**HTTP** — for remote deployment or multi-client scenarios:
```json
{
  "command": "node",
  "args": ["dist/server/index.js", "--http"],
  "env": {
    "MCP_SERVER_PORT": "3100"
  }
}
```

Endpoints: `POST /mcp` (MCP protocol), `GET /health` (status check)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | `./contexts` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `./instincts` | Path to `*.instincts.yaml` files |
| `MEMORY_BRIDGE_URL` | (none) | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | (none) | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP server port (only with `--http`) |

## Key Types

- `Instinct` — Learned rule with confidence scoring + outcome tracking
- `Context` — Static context with tool-matching + triggers
- `Engine` — Unified coordinator for contexts + instincts + memory bridge
- `IMemoryBridge` — Interface for memory service integration
- `Registry` — Programmatic instinct lifecycle management

## Conventions

- IDs: kebab-case (`git-conventional-commits`)
- Confidence: 0.0–1.0, default min_confidence: 0.5
- YAML files: `*.instincts.yaml` extension
- JSON context files: `*_context.json`
- All instincts require human approval (`approved_by: human`)
- Rules must be 20–80 tokens (Zod enforced: 5–120 soft range)
- Memory Bridge uses `X-API-Key` header for auth

## Skills

- `/instill` — distill instincts from a session (global skill, works in any project)
