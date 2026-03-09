# MCP Context Provider

<div align="center">
  <img src="assets/logo.svg" alt="MCP Context Provider" width="200"/>
</div>

> **Persistent tool context + learned instincts for Claude** – eliminate context loss between sessions.

The MCP Context Provider is a **context and instinct engine** for Claude Desktop and Claude Code. Instead of re-explaining your preferred rules, naming conventions, and syntax preferences in every session, the server automatically injects them - available in all sessions without manual effort.

## What it does

- **Contexts** (static): Tool-specific rules in JSON, always injected at full confidence
- **Instincts** (learned): Compact rules distilled from sessions, confidence-scored, human-approved
- **Auto-corrections**: Syntax transformations run automatically (e.g. Markdown to DokuWiki)
- **Memory Bridge**: Syncs instincts to mcp-memory-service for persistence across machines

## Quick Start

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install && npm run build
```

Add to your Claude Desktop or Claude Code config:

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

See [Getting Started](getting-started/) for full instructions.

## Version

Current release: **v2.0.0-alpha.1**

## Architecture

```
Session Start
  → Engine loads Contexts (JSON) + Instincts (YAML)
  → MCP Server exposes 6 tools (stdio or HTTP)
  → Claude queries tools for context injection
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_tool_context` | Get complete context for a tool category |
| `get_syntax_rules` | Get syntax-specific rules |
| `list_available_contexts` | List all loaded contexts |
| `apply_auto_corrections` | Apply correction patterns to text |
| `build_injection` | Combined context + instinct injection payload |
| `list_instincts` | List instincts with confidence scores |

## Available Contexts (built-in)

| Context | What it does |
|---------|-------------|
| `dokuwiki` | Markdown to DokuWiki syntax conversion |
| `azure` | Azure resource naming conventions and compliance |
| `terraform` | Terraform snake_case, module patterns, state management |
| `git` | Conventional commits, branch naming |
| `general_preferences` | Cross-tool preferences and workflow standards |
| `applescript` | AppleScript patterns and best practices |
| `memory` | MCP Memory Service auto-store/retrieve triggers |
| `n8n` | n8n workflow automation patterns |
| `mkdocs` | MkDocs Material documentation patterns |

## Claude Code Integration

Install the `/instill` skill globally to extract instincts from any session:

```
~/.claude/skills/instill/SKILL.md
```

Manage instincts with the CLI:

```bash
mcp-cp list                        # List all instincts
mcp-cp approve <id>                # Human approval
mcp-cp tune <id> --confidence 0.8  # Tune confidence
```

## License

MIT License - see [LICENSE](https://github.com/doobidoo/MCP-Context-Provider/blob/main/LICENSE)
