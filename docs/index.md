# MCP Context Provider

<div align="center">
  <img src="assets/MCP-CONTEXT-PROVIDER.png" alt="MCP Context Provider" width="500"/>
</div>

> **Persistent tool context for Claude Desktop** – eliminate context loss between chat sessions.

The MCP Context Provider acts as a **persistent neural core** for your AI interactions. Instead of re-establishing your preferred rules, naming conventions, and syntax preferences in every new chat, the server automatically injects them at startup – available in all sessions without any manual effort.

## What it does

When you work with Claude Desktop across multiple sessions, context gets lost. You repeatedly explain the same naming conventions, syntax preferences, and workflow rules. The Context Provider solves this by maintaining a persistent configuration layer between Claude and your tools.

- **Automatic injection**: Tool-specific rules flow into every conversation at startup
- **Auto-corrections**: Syntax transformations run automatically (e.g. Markdown → DokuWiki)
- **Tool-specific rules**: Azure naming, Terraform patterns, Git conventions, DokuWiki syntax – each tool gets its own context
- **Intelligent learning**: v1.6.0+ adds memory-driven optimization and self-improving contexts (Phase 3)

## Quick Start

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
./scripts/install.sh
```

Then add to your `claude_desktop_config.json` and restart Claude Desktop. See [Quick Start](guides/QUICKSTART.md) for full instructions.

## Version

Current release: **v1.8.4**

## Architecture

```
Startup → Load Context Files → Register MCP Tools → Context Available in All Chats
```

Context files are plain JSON, stored in `contexts/`. Easy to version-control, share across teams, and extend.

## Available Contexts (built-in)

| Context | What it does |
|---------|-------------|
| `dokuwiki` | Markdown → DokuWiki syntax conversion |
| `azure` | Azure resource naming conventions and compliance |
| `terraform` | Terraform snake_case, module patterns, state management |
| `git` | Conventional commits, branch naming |
| `general_preferences` | Cross-tool preferences and workflow standards |
| `applescript` | AppleScript patterns and best practices |
| `memory` | MCP Memory Service auto-store/retrieve triggers |

## License

MIT License – see [LICENSE](https://github.com/doobidoo/MCP-Context-Provider/blob/main/LICENSE)
