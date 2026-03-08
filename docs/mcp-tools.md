# MCP Tools Reference

The MCP Context Provider v2 exposes **13 tools** (plus 2 conditional) over the Model Context Protocol. All tools return JSON responses.

## Core Query Tools

These are the primary tools for retrieving context and instinct rules.

### `build_injection`

Build a complete injection payload of context rules and instinct rules for a given tool and input.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | string | Yes | Tool name or pattern (e.g. `git:commit`, `bash`) |
| `input` | string | No | Input text to match instincts against |

**Example response:**

```json
{
  "context_rules": [
    {
      "source": "context",
      "id": "git",
      "confidence": 1.0,
      "rules": { "commit_format": "type(scope): description" }
    }
  ],
  "instinct_rules": [
    {
      "source": "instinct",
      "id": "git-conventional",
      "confidence": 0.85,
      "rule": "Use conventional commit format"
    }
  ],
  "estimated_tokens": 450
}
```

---

### `match_contexts`

Find all contexts whose `applies_to_tools` patterns match a given tool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | string | Yes | Tool name to match against context patterns |
| `categories` | string[] | No | Filter by specific categories |
| `min_priority` | `high` \| `medium` \| `low` | No | Minimum priority filter |

---

### `match_instincts`

Find all instincts whose trigger patterns match a given input text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | Yes | Input text to match against instinct triggers |
| `domains` | string[] | No | Filter by domains |
| `tags` | string[] | No | Filter by tags |
| `min_confidence` | number (0–1) | No | Minimum confidence threshold |

---

## Read / List Tools

Tools for inspecting loaded contexts and instincts.

### `list_contexts`

List all loaded context categories with their descriptions and tool patterns.

_No parameters._

**Returns** an array of context summaries:

```json
[
  {
    "tool_category": "git",
    "description": "Git commit conventions",
    "applies_to_tools": ["git:*", "bash:git"],
    "priority": "high"
  }
]
```

---

### `get_context`

Get the full context definition for a specific tool category.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | Yes | The `tool_category` to look up |

---

### `list_instincts`

List all loaded instincts with their IDs, domains, confidence, and active status.

_No parameters._

**Returns** an array of instinct summaries:

```json
[
  {
    "id": "git-conventional",
    "rule": "Use conventional commit format",
    "domain": "git",
    "tags": ["commit", "convention"],
    "confidence": 0.85,
    "active": true,
    "approved_by": "human",
    "usage_count": 5
  }
]
```

---

### `get_auto_corrections`

Get all auto-correction rules that apply to a given tool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | string | Yes | Tool name to get corrections for |

!!! note
    Auto-corrections are only returned for contexts that have `auto_convert: true` set.

---

## Instinct Registry Tools

Tools for managing the instinct lifecycle: approving, rejecting, tuning, and recording outcomes.

### `instinct_approve`

Approve an instinct for use. Sets `approved_by` to `human` and activates it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Instinct ID (kebab-case) |

---

### `instinct_reject`

Reject an instinct. Deactivates it and reduces confidence by 0.3.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Instinct ID (kebab-case) |

---

### `instinct_tune`

Tune an instinct's parameters (confidence, rule text, tags, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Instinct ID (kebab-case) |
| `confidence` | number (0–1) | No | New confidence value |
| `min_confidence` | number (0–1) | No | New minimum confidence threshold |
| `rule` | string | No | Updated rule text |
| `tags` | string[] | No | Updated tags |
| `trigger_patterns` | string[] | No | Updated trigger patterns |
| `active` | boolean | No | Set active status |

---

### `instinct_outcome`

Record an outcome for an instinct, adjusting its confidence score.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Instinct ID (kebab-case) |
| `result` | `positive` \| `negative` \| `neutral` | Yes | Outcome result |
| `delta` | number (-1 to 1) | Yes | Confidence delta to apply |
| `note` | string | No | Optional note about the outcome |

---

## Memory Bridge Tools

These tools are **conditionally registered** — they only appear if the Memory Bridge is connected (i.e., `MEMORY_BRIDGE_URL` is set and reachable).

### `memory_sync`

Sync all local instincts to the memory service.

_No parameters._

Performs a bidirectional sync:

- Pushes local YAML instincts to memory
- Tags memories with `instinct`, `instinct-id:<id>`, domain tags

---

### `memory_discover`

Search the memory service for instincts semantically related to input text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | Yes | Semantic search query |
| `limit` | number | No | Max results to return (default: 5) |

---

## Server Info

### `server_info`

Get server status: loaded contexts, instincts, errors, and memory bridge status.

_No parameters._

**Returns:**

```json
{
  "version": "2.0.0",
  "contexts_loaded": 8,
  "instincts_loaded": 3,
  "errors": [],
  "memory_connected": false
}
```

---

## Error Handling

All tools use a consistent error format:

```json
{
  "error": "Context not found: unknown-category"
}
```

Error responses include `isError: true` in the MCP response metadata.
