# MCP Context Provider v2

<div align="center">
  <img src="assets/MCP-CONTEXT-PROVIDER.png" alt="MCP Context Provider Architecture" width="600"/>

  *Persistent context that survives across sessions. Static rules flow alongside learned instincts, creating an ever-improving knowledge core for your AI interactions.*
</div>

A TypeScript engine that provides AI models with **persistent context** and **learned instincts** across sessions. Two core concepts work together:

- **Contexts** (static) - Manually authored tool-specific rules (200-1000 tokens), always injected at full confidence
- **Instincts** (learned) - Distilled from sessions, confidence-scored (0.0-1.0), human-approved before activation

## Quick Start

### Prerequisites

- Node.js >= 20
- npm

### Installation

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider

npm install
npm run build
```

### Verify

```bash
npm run lint    # Type-check
npm test        # 61 tests across 5 suites
```

## Architecture

```
                    Engine
                   /      \
          Contexts          Instincts
         (static)          (learned)
            |                  |
    JSON *_context.json   YAML *.instincts.yaml
    glob tool matching    regex trigger patterns
    priority-sorted       confidence-scored
            |                  |
            \      merge      /
             \      |        /
          InjectionPayload
       (context_rules + instinct_rules)
                   |
            Memory Bridge (optional)
           mcp-memory-service sync
```

### Three Subsystems

| Subsystem | Purpose |
|-----------|---------|
| **Engine** | Loads, matches, and merges contexts + instincts into injection payloads |
| **CLI** (`mcp-cp`) | Approval registry for instinct lifecycle management |
| **Memory Bridge** | Syncs instincts to mcp-memory-service via HTTP API |

## Contexts

Static tool-specific rules stored as JSON in `/contexts`. The engine discovers all `*_context.json` files automatically.

### Tool Pattern Matching

Contexts are matched to tools using glob-style patterns:

| Pattern | Matches |
|---------|---------|
| `*` | All tools |
| `git:*` | All git tools (`git:commit`, `git:push`, ...) |
| `bash:git` | Only `bash:git` (exact) |
| `git` | Category-level: matches `git:commit`, `git:push`, etc. |

### Context Structure

```json
{
  "tool_category": "git",
  "description": "Git commit conventions and workflow patterns",
  "metadata": {
    "version": "1.0.0",
    "priority": "high",
    "applies_to_tools": ["git:*", "bash:git"]
  },
  "syntax_rules": { ... },
  "preferences": { ... },
  "auto_corrections": { ... }
}
```

Contexts are sorted by priority (`high` > `medium` > `low`) when multiple match.

## Instincts

Learned rules distilled from sessions, stored as YAML in `/instincts`.

### Instinct Structure

```yaml
version: "1.0"
instincts:
  - id: git-conventional-commits
    rule: "Use conventional commit format: type(scope): description"
    domain: git
    tags: [commit, convention]
    trigger_patterns:
      - "git commit"
      - "commit message"
    confidence: 0.85
    min_confidence: 0.5
    active: true
    approved_by: human
    outcome_log:
      - timestamp: "2026-03-08T10:00:00Z"
        event: approved
        delta_confidence: 0.1
```

### Key Properties

- **Confidence** (0.0-1.0): How reliable this instinct is, adjusted by outcomes
- **min_confidence**: Threshold below which the instinct won't fire
- **approved_by**: Must be `human` for activation (or `auto` for draft)
- **outcome_log**: Tracks every approval, rejection, and outcome event with confidence deltas

### The `/instill` Skill

Use the `/instill` Claude Code skill to extract instincts from your current session:

1. Analyzes session for recurring patterns
2. Extracts candidate instincts with quality gates (20-80 tokens, non-trivial)
3. Presents candidates for your approval
4. Persists approved instincts to YAML

## CLI: Approval Registry (`mcp-cp`)

Zero-dependency ANSI-formatted CLI for managing the instinct lifecycle.

```bash
# List all instincts with confidence bars
mcp-cp list

# Show detailed view of an instinct
mcp-cp show git-conventional-commits

# Human approval (activates the instinct)
mcp-cp approve git-conventional-commits

# Reject (deactivates, lowers confidence by 0.3)
mcp-cp reject git-conventional-commits

# Tune parameters
mcp-cp tune git-conventional-commits --confidence 0.9
mcp-cp tune git-conventional-commits --min-confidence 0.6
mcp-cp tune git-conventional-commits --tags "commit,git,convention"

# Record outcomes (adjusts confidence)
mcp-cp outcome git-conventional-commits + "Worked well in PR review"
mcp-cp outcome git-conventional-commits - "Too strict for hotfix commits"

# Remove an instinct entirely
mcp-cp remove git-conventional-commits
```

## Engine API

```typescript
import { Engine } from 'mcp-context-provider';

const engine = new Engine({
  contextsPath: './contexts',
  instinctsPath: './instincts',
});

await engine.initialize();

// Build injection payload for a specific tool + input
const payload = engine.buildInjection('git:commit', 'writing a commit message');
// → { context_rules: [...], instinct_rules: [...] }
```

## Memory Bridge (Optional)

Syncs instincts bidirectionally with [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) for persistent storage, semantic discovery, and cross-session learning.

```typescript
const engine = new Engine({
  contextsPath: './contexts',
  instinctsPath: './instincts',
  memoryBridge: {
    baseUrl: 'http://127.0.0.1:8000/api',
    apiKey: process.env.MCP_API_KEY,
    enabled: true,
  },
});

await engine.initialize();
await engine.connectMemory();   // Health check + connect
await engine.syncToMemory();    // Push instincts to memory service
await engine.discoverInstincts('typescript patterns'); // Semantic search
```

### Bridge Capabilities

- **Push/Pull Sync**: Upsert instincts from YAML to memory and back
- **Orphan Detection**: Find memories without corresponding YAML files
- **Semantic Discovery**: Search for related instincts by meaning, not just keywords
- **Tagged Storage**: Instincts stored with `instinct`, `instinct-id:<id>`, domain, and custom tags

## Project Structure

```
src/
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
    sync.ts           Bidirectional YAML <-> Memory sync
  cli/                Approval Registry CLI (mcp-cp)
    index.ts          CLI entry point + argument parser
    registry.ts       approve/reject/tune/outcome/remove operations
    formatter.ts      ANSI terminal formatting

instincts/            YAML instinct files (*.instincts.yaml)
contexts/             JSON context files (*_context.json)
.claude/skills/       Claude Code skills
  instill.md          /instill - distill instincts from session
```

## Development

```bash
npm run build       # Compile TypeScript
npm run dev         # Watch mode
npm run lint        # Type-check (tsc --noEmit)
npm test            # Run tests (vitest)
npm run test:watch  # Watch mode tests
```

### Tech Stack

- **TypeScript** (strict mode, ES2022, Node16 modules)
- **Zod** for runtime schema validation
- **yaml** for YAML parsing
- **vitest** for testing
- Zero runtime dependencies beyond `yaml` and `zod`

## Migration from v1.x

v2 is a complete rewrite from Python to TypeScript. Key changes:

| v1.x (Python) | v2.x (TypeScript) |
|---|---|
| Python MCP server | TypeScript engine library |
| JSON context files only | JSON contexts + YAML instincts |
| Static rules | Learned rules with confidence scoring |
| Phase 1/2/3 learning system | Instinct Engine with Memory Bridge |
| DXT packaging | npm package |
| `pip install` | `npm install` |

**Context files from v1.x** (`*_context.json`) are fully compatible with v2 - just copy them to the `contexts/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-context`
3. Make your changes with tests
4. Run `npm test` and `npm run lint`
5. Submit a pull request

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
