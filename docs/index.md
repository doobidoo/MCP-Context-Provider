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
npm link   # recommended: makes mcp-cp and mcp-context-provider available globally
```

Add to your **global** Claude Code config (`~/.claude.json`) or Claude Desktop config:

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

Global installation is recommended - the context provider works across all projects. See [Installation](guides/INSTALLATION.md) for full instructions.

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

## The `/instill` Skill

`/instill` analyzes your Claude Code session and extracts **instincts** - compact, reusable rules that prevent you from repeating the same corrections across sessions.

**Example:** You keep telling Claude "don't use em-dash". After running `/instill`, it captures this as an instinct that automatically triggers whenever Claude writes text.

Install globally (one-time setup):

```bash
mkdir -p ~/.claude/skills/instill
cp .claude/skills/instill.md ~/.claude/skills/instill/SKILL.md
```

Then use `/instill` in any session. Manage saved instincts with the CLI:

```bash
mcp-cp list                        # List all instincts with confidence scores
mcp-cp approve <id>                # Human approval (required for activation)
mcp-cp tune <id> --confidence 0.8  # Adjust confidence
```

See [Installation - The /instill Skill](guides/INSTALLATION.md#the-instill-skill) for details.

## License

MIT License - see [LICENSE](https://github.com/doobidoo/MCP-Context-Provider/blob/main/LICENSE)
