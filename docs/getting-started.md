# Getting Started

## Prerequisites

- **Node.js** >= 20
- **npm**

## Installation

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install
npm run build
```

## Verify

```bash
npm run lint    # Type-check (should produce no errors)
npm test        # Run all tests (82 tests across 6 suites)
```

## Configure Claude Code

Add the context provider to your `.mcp.json` (in your home directory or project root):

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "node",
      "args": ["dist/server/index.js"],
      "cwd": "/path/to/MCP-Context-Provider",
      "env": {
        "CONTEXTS_PATH": "./contexts",
        "INSTINCTS_PATH": "./instincts"
      }
    }
  }
}
```

!!! tip "Paths"
    `CONTEXTS_PATH` and `INSTINCTS_PATH` are resolved relative to `cwd`. You can also use absolute paths.

## Restart Claude Code

After updating `.mcp.json`, restart Claude Code. The MCP server will load all contexts and instincts automatically.

## Verify it works

In a new Claude Code session, the context provider tools should be available. Try:

- `server_info` — shows loaded contexts, instincts, and connection status
- `list_contexts` — lists all available context categories
- `list_instincts` — lists all loaded instincts

## Optional: Memory Bridge

To sync instincts with [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service), add environment variables:

```json
{
  "env": {
    "CONTEXTS_PATH": "./contexts",
    "INSTINCTS_PATH": "./instincts",
    "MEMORY_BRIDGE_URL": "http://127.0.0.1:8000/api",
    "MEMORY_BRIDGE_API_KEY": "your-api-key"
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXTS_PATH` | `./contexts` | Path to `*_context.json` files |
| `INSTINCTS_PATH` | `./instincts` | Path to `*.instincts.yaml` files |
| `MEMORY_BRIDGE_URL` | _(none)_ | Memory service base URL (enables bridge) |
| `MEMORY_BRIDGE_API_KEY` | _(none)_ | API key for memory service |
| `MCP_SERVER_PORT` | `3100` | HTTP port (only with `--http`) |

## Migration from v1.x

If you're upgrading from the Python v1.x version:

1. Your existing `*_context.json` files in `contexts/` are **fully compatible** — no changes needed
2. Replace the Python command in your config with the Node command above
3. Remove Python-specific env vars (`CONTEXT_CONFIG_DIR`, `AUTO_LOAD_CONTEXTS`)
4. v1 tools like `get_tool_context` are replaced by `build_injection`, `get_context`, etc.
