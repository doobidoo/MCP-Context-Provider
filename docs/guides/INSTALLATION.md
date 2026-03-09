# Installation

## Requirements

- Node.js >= 20
- npm

## Install from Source

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install
npm run build
```

Verify:

```bash
npm test          # 61 tests should pass
npm start         # Should print "Engine loaded: N contexts, N instincts"
```

## Global CLI Installation

To make `mcp-cp` and `mcp-context-provider` available system-wide:

```bash
npm link
```

This installs two commands:

- `mcp-context-provider` — run the MCP server directly
- `mcp-cp` — manage instincts (list, approve, reject, tune)

## Claude Desktop Configuration

Update your `claude_desktop_config.json`:

| Platform | Config Location |
|----------|----------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "node",
      "args": ["/path/to/MCP-Context-Provider/dist/server/index.js"],
      "env": {
        "CONTEXTS_PATH": "/path/to/MCP-Context-Provider/contexts",
        "INSTINCTS_PATH": "/path/to/MCP-Context-Provider/instincts"
      }
    }
  }
}
```

Replace `/path/to/MCP-Context-Provider` with your actual installation path.

## Claude Code Configuration

Add to your project `.mcp.json` or global `~/.claude.json`:

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "node",
      "args": ["dist/server/index.js"],
      "env": {
        "CONTEXTS_PATH": "./contexts",
        "INSTINCTS_PATH": "./instincts"
      }
    }
  }
}
```

## Optional: HTTP Transport

For remote deployment or multi-client scenarios, use the `--http` flag:

```json
{
  "command": "node",
  "args": ["dist/server/index.js", "--http"],
  "env": {
    "MCP_SERVER_PORT": "3100"
  }
}
```

The HTTP server exposes:

- `POST /mcp` — MCP protocol endpoint (Streamable HTTP)
- `GET /health` — Health check with engine status

## Optional: Memory Bridge

Connect to [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) for instinct persistence:

```json
{
  "env": {
    "MEMORY_BRIDGE_URL": "http://127.0.0.1:8000/api",
    "MEMORY_BRIDGE_API_KEY": "your-api-key"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | `./contexts` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `./instincts` | Path to `*.instincts.yaml` files |
| `MEMORY_BRIDGE_URL` | (none) | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | (none) | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP server port (only with `--http`) |

## Optional: /instill Skill (Claude Code)

Install the instinct distillation skill globally:

```bash
mkdir -p ~/.claude/skills/instill
cp .claude/skills/instill.md ~/.claude/skills/instill/SKILL.md
```

Then use `/instill` in any Claude Code session to extract learned rules.

## Migration from v1.x

v2.0 is a complete rewrite from Python to TypeScript. Key changes:

| v1.x (Python) | v2.x (TypeScript) |
|---------------|-------------------|
| `python context_provider_server.py` | `node dist/server/index.js` |
| `CONTEXT_CONFIG_DIR` | `CONTEXTS_PATH` |
| `AUTO_LOAD_CONTEXTS` | Always auto-loads |
| DXT packaging | npm install |
| 4 MCP tools | 6 MCP tools |
| No instincts | Instinct engine with confidence scoring |
| stdio only | stdio + HTTP transport |

Context JSON files (`contexts/*_context.json`) are compatible. The v2 Zod schema is stricter:

- `auto_corrections` values must be `{pattern, replacement}` objects (not plain strings)
- `session_initialization` requires `enabled` (boolean) and `actions` fields
- `metadata.priority` only accepts `high`, `medium`, `low` (not `critical`)
- `metadata.applies_to_tools` must have at least 1 element

Restart Claude Desktop after updating the configuration.
