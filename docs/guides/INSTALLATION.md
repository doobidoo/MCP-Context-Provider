# Installation

## Requirements

- Node.js >= 20
- npm

## Install & Build

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

## Global Installation (Recommended)

The Context Provider is designed to work **across all your projects** - it provides persistent rules for tools like Git, Terraform, Azure, DokuWiki regardless of which repo you're in. Global installation is the recommended setup.

```bash
cd MCP-Context-Provider
npm link
```

This installs two global commands:

- `mcp-context-provider` — run the MCP server directly
- `mcp-cp` — manage instincts (list, approve, reject, tune)

### Configure for Claude Code (Global)

Add to your global `~/.claude.json` under `mcpServers`:

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

Replace `/path/to/MCP-Context-Provider` with your actual installation path. This makes the context provider available in **every Claude Code session**, regardless of which project you open.

### Configure for Claude Desktop (Global)

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

Restart Claude Desktop after saving the configuration.

## Per-Project Installation (Alternative)

If you only want the context provider in a specific project, add a `.mcp.json` to your project root:

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

## The `/instill` Skill

`/instill` is a Claude Code skill that **extracts learned rules (instincts) from your current session**. When you notice Claude making the same mistakes, or you keep correcting the same patterns, `/instill` captures those as reusable instincts.

### What it does

1. **Analyzes your session** for repeated corrections, explicit preferences, workflow patterns
2. **Extracts candidates** as compact rules (20-80 tokens each)
3. **Presents them for review** with an interactive prompt:

```
## Instinct Candidates (3 found)

### 1. `no-em-dash`
> domain: writing | confidence: 0.7

**Rule:** "Never use em-dash (—). Use colon, comma, semicolon, or rephrase."
**Triggers:** `—`, `em-dash`

### 2. `terraform-snake-case`
> domain: terraform | confidence: 0.8

**Rule:** "All Terraform resource names must use snake_case, never camelCase."
**Triggers:** `resource`, `terraform`

**Reply with:** a (accept all) | 1,2 (accept specific) | e1 (edit) | r (reject all)
```

4. **Saves accepted instincts** to `instincts/learned.instincts.yaml`
5. Instincts are automatically injected in future sessions when their trigger patterns match

### Install globally

The skill must be installed as a **global Claude Code skill** to work across all projects:

```bash
mkdir -p ~/.claude/skills/instill
cp .claude/skills/instill.md ~/.claude/skills/instill/SKILL.md
```

!!! note "Skill directory structure"
    Global skills require the path `~/.claude/skills/<name>/SKILL.md` — a flat file like `~/.claude/skills/instill.md` will **not** be recognized.

After installation, `/instill` is available in every Claude Code session. Type `/instill` to extract instincts, or `/instill git` to focus on a specific domain.

### Manage instincts

Use the `mcp-cp` CLI to manage saved instincts:

```bash
mcp-cp list                          # List all instincts with confidence
mcp-cp show <id>                     # Detail view
mcp-cp approve <id>                  # Human approval (required for activation)
mcp-cp reject <id>                   # Deactivate an instinct
mcp-cp tune <id> --confidence 0.8    # Adjust confidence score
mcp-cp outcome <id> + "worked well"  # Record positive outcome
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

Connect to [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) for instinct persistence across machines:

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
