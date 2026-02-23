# Contexts Reference

All built-in contexts are stored as JSON files in the `contexts/` directory. Each context is automatically loaded at Claude Desktop startup when `AUTO_LOAD_CONTEXTS=true` is set.

## Overview

| Context File | Category | Purpose |
|---|---|---|
| `dokuwiki_context.json` | `dokuwiki` | Markdown → DokuWiki auto-conversion |
| `azure_context.json` | `azure` | Azure resource naming conventions |
| `terraform_context.json` | `terraform` | Terraform patterns and best practices |
| `git_context.json` | `git` | Conventional commits and branch naming |
| `general_preferences_context.json` | `general_preferences` | Cross-tool preferences and standards |
| `memory_context.json` | `memory` | MCP Memory Service auto-store/retrieve |
| `python_mcp_memory_context.json` | `python-mcp-memory` | MCP Memory Service development patterns |
| `shodh_memory_context.json` | `memory` | SHODH episodic memory management |
| `applescript_context.json` | `applescript` | AppleScript patterns |
| `n8n_context.json` | `n8n` | n8n workflow automation |
| `ios_shortcuts_context.json` | `ios_shortcuts` | iOS Shortcuts integration |
| `response_shortcodes_context.json` | `response_shortcodes` | G/I Cycle shortcodes (`/GRADE`, `/I`) |

---

## Memory Contexts

The Context Provider ships with three memory-related contexts covering different layers of the memory ecosystem.

---

### `memory_context.json` – MCP Memory Auto-Trigger

**Category**: `memory`  
**Purpose**: Proactive storage and retrieval rules for the [MCP Memory Service](https://github.com/doobidoo/mcp-memory-service). Defines when Claude should automatically store memories and when to proactively retrieve them based on conversation patterns.

**Session Initialization**: On startup, loads recent activity (last 24h) and retrieves any open tasks tagged `in-progress`, `active`, or `follow-up`.

**Auto-Store Triggers** — Claude stores a memory when it detects:

| Trigger | Example Patterns | Tags Applied |
|---|---|---|
| Decisions | "I decided to", "We agreed that", "Let's go with" | `decision`, `{project}` |
| Technical solutions | "The fix was", "The solution is", "To resolve this" | `solution`, `technical` |
| Completed activities | "I completed", "I implemented", "I resolved" | `activity`, `completed` |
| Future tasks | "I need to", "TODO:", "Remember to" | `todo`, `in-progress` |
| Preferences | "I prefer", "I always", "My preference is" | `preference`, `personal` |
| Learning moments | "I learned that", "It turns out", "The issue was" | `learning`, `insight` |

**Auto-Retrieve Triggers** — Claude retrieves memories when it detects:

- Temporal queries: "What did I do last week", "Yesterday", "Earlier today"
- Continuation: "Continue with", "Where were we", "Pick up where"
- Problem solving: "How did I fix", "What was the solution for"

**Smart Tagging**: Automatically detects project names, tool names (Terraform, Docker, Azure, Git, Python, etc.), and adds temporal tags (day, month, year).

---

### `python_mcp_memory_context.json` – MCP Memory Service Development

**Category**: `python-mcp-memory`  
**Purpose**: Specialized context for **developing and extending the MCP Memory Service itself**. Provides FastAPI patterns, MCP protocol conventions, storage backend configurations, and Cloudflare integration rules. Activate this when working on the [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) codebase.

**Session Initialization**: Loads last 7 days of MCP Memory Service development activity, retrieves architecture and backend config context, and surfaces any open `mcp-memory-service` tasks.

**Auto-Store Triggers**:

| Trigger | Example Patterns | Tags Applied |
|---|---|---|
| MCP protocol changes | "tool handler", "JSON-RPC", "stdio transport" | `mcp-protocol`, `mcp-memory-service` |
| Storage backend config | "Cloudflare backend", "SQLite-vec", "Vectorize index" | `storage-backend`, `configuration` |
| Cloudflare setup | "CLOUDFLARE_API_TOKEN", "Workers AI", "D1 setup" | `cloudflare`, `setup` |
| Hybrid backend | "dual storage", "background sync", "graceful fallback" | `hybrid-backend`, `sync` |
| FastAPI implementation | "API endpoint", "async route", "SSE events" | `fastapi`, `api` |
| Troubleshooting solutions | "fixed by", "root cause", "resolved by" | `troubleshooting`, `solution` |

**Auto-Retrieve Triggers**:

- Backend errors → searches `cloudflare`, `storage-backend`, `troubleshooting`
- MCP connection issues → searches `mcp-protocol`, `connection`
- Async errors → searches `async`, `troubleshooting`, `python`
- Performance issues → searches `performance`, `optimization`

**Code Style Rules**:

```python
# Type hints required, async preferred, Python 3.10+
async def handle_store_memory(arguments: dict) -> list[TextContent]:
    ...
```

**Preferences**: `uv` as package manager, `pytest` for tests, `black` formatter, `ruff` linter, Google docstrings, 80% minimum test coverage.

---

### `shodh_memory_context.json` – SHODH Episodic Memory

**Category**: `memory`  
**Purpose**: Context rules for the [SHODH Cloudflare Memory](https://github.com/doobidoo/shodh-memory) backend — a separate memory system focused on episodic memory with emotional metadata, credibility scoring, and associative retrieval. Used as the backend for the SecondBrain app.

**Key Differentiators vs. `memory_context.json`**:

- **Episodic grouping**: Related memories are grouped into episodes (30min timeout)
- **Emotional metadata**: Auto-detects valence/arousal from conversation patterns (joy, frustration, satisfaction, concern)
- **Credibility scoring**: Each memory gets a credibility score (user-stated=1.0, ai-generated=0.7, inferred=0.5)
- **Typed memories**: Observation, Decision, Learning, Error, Discovery, Pattern, Context, Task

**Memory Types**:

| Type | When Used |
|---|---|
| `Decision` | "decided to", "we agreed", "going with" |
| `Learning` | "I learned", "lesson learned", "key insight" |
| `Error` | "fixed the", "resolved by", "workaround is" |
| `Discovery` | "I discovered", "it turns out", "TIL" |
| `Pattern` | "best practice", "always do", "rule of thumb" |
| `Task` | "TODO:", "don't forget", "action item" |
| `Context` | "working on", "focusing on", "today's goal" |
| `Observation` | "I noticed", "worth noting" |

**Proactive Context**: Calls `proactive_context` on every message with a surface threshold of 0.65 — memories are surfaced automatically without explicit retrieval requests.

---

## Other Built-in Contexts

### `dokuwiki_context.json`
Handles automatic Markdown → DokuWiki syntax conversion. Converts headers (`# Title` → `====== Title ======`), code blocks (`` ``` `` → `<code>`), links, tables, and note blocks. See [Examples](EXAMPLES.md) for detailed conversion examples.

### `azure_context.json`
Enforces Azure resource naming conventions, required tags (Environment, Owner, CostCenter), security defaults (TLS 1.2, HTTPS-only), and location normalization (`West Europe` → `westeurope`).

### `terraform_context.json`
Enforces snake_case variable names, required descriptions, validation blocks, module structure, and proper tagging patterns for Azure Terraform deployments.

### `git_context.json`
Enforces Conventional Commits format (`feat:`, `fix:`, `chore:`), branch naming conventions (`feature/`, `bugfix/`, `hotfix/`), and pull request template standards.

### `general_preferences_context.json`
Cross-tool preferences including the G/I Cycle trigger (`/GRADE` → `/I` for iterative output improvement) and general response style preferences.

### `response_shortcodes_context.json`
Defines shortcodes for structured output review:

- `/GRADE` — grades output with point deductions
- `/I` — improves output, addressing deductions
- `/GRADE ANALYSIS` — meta-level analysis of reasoning quality

---

## Adding Custom Contexts

Create a new file `contexts/{toolname}_context.json` following the structure below, then restart Claude Desktop:

```json
{
  "tool_category": "toolname",
  "description": "What this context does",
  "auto_convert": false,
  "syntax_rules": {},
  "preferences": {},
  "auto_corrections": {},
  "auto_store_triggers": {},
  "auto_retrieve_triggers": {},
  "session_initialization": {
    "enabled": false
  },
  "metadata": {
    "version": "1.0.0",
    "applies_to_tools": ["toolname"],
    "priority": "medium"
  }
}
```

See the [Developer Guide](guides/DEVELOPER_GUIDE.md) for full field documentation.
