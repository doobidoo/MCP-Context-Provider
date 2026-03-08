# MCP Context Provider v2

<div align="center">
  <img src="assets/logo.svg" alt="MCP Context Provider" width="200"/>
</div>

> **Persistent context and learned instincts for Claude Code** — static rules meet confidence-scored intelligence.

The MCP Context Provider delivers two complementary systems:

- **Contexts** (static) — Manually authored tool-specific rules (200–1000 tokens), always injected at full confidence
- **Instincts** (learned) — Distilled from sessions, confidence-scored (0.0–1.0), human-approved before activation

## What's new in v2

v2 is a **complete TypeScript rewrite** from the Python v1.x codebase. Key changes:

| | v1.x (Python) | v2.x (TypeScript) |
|---|---|---|
| Runtime | Python MCP server | Node.js MCP server |
| Rules | Static JSON contexts only | JSON contexts + YAML instincts |
| Learning | Phase 1/2/3 system | Instinct Engine with confidence scoring |
| Transport | stdio only | stdio (default) + Streamable HTTP |
| CLI | None | `mcp-cp` approval registry |
| Memory | Simulated integration | Real mcp-memory-service bridge |

## Quick Start

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
npm install && npm run build
```

Add to your `.mcp.json`:

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

Restart Claude Code. See [Getting Started](getting-started.md) for full instructions.

## Architecture

```mermaid
graph TD
    E[Engine] --> C[Contexts<br/><i>static</i>]
    E --> I[Instincts<br/><i>learned</i>]

    C --> CL["JSON *_context.json<br/>glob tool matching<br/>priority-sorted"]
    I --> IL["YAML *.instincts.yaml<br/>regex trigger patterns<br/>confidence-scored"]

    CL --> IP[InjectionPayload<br/>context_rules + instinct_rules]
    IL --> IP

    IP --> MB["Memory Bridge<br/><i>optional</i><br/>mcp-memory-service sync"]

    style E fill:#4f46e5,stroke:#3730a3,color:#fff,font-weight:bold
    style C fill:#0891b2,stroke:#0e7490,color:#fff
    style I fill:#d97706,stroke:#b45309,color:#fff
    style CL fill:#e0f2fe,stroke:#0ea5e9
    style IL fill:#fef3c7,stroke:#f59e0b
    style IP fill:#10b981,stroke:#059669,color:#fff,font-weight:bold
    style MB fill:#6366f1,stroke:#4f46e5,color:#fff
```

## Three Subsystems

| Subsystem | Purpose |
|-----------|---------|
| **Engine** | Loads, matches, and merges contexts + instincts into injection payloads |
| **CLI** (`mcp-cp`) | Approval registry for instinct lifecycle management |
| **Memory Bridge** | Syncs instincts to mcp-memory-service via HTTP API |

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
| `date_awareness` | Temporal context and scheduling awareness |

## Version

Current release: **v2.0.0**

## License

Apache License 2.0 — see [LICENSE](https://github.com/doobidoo/MCP-Context-Provider/blob/main/LICENSE)
