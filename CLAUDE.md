# CLAUDE.md — mcp-context-provider v2.x

> Clean rewrite from Python v1.8.x to TypeScript.

## Architecture

Two core concepts:

- **Contexts** (static): 200–1000 tokens, manually authored, always injected at full confidence
- **Instincts** (learned): 20–80 tokens, distilled from sessions, confidence-scored (0.0–1.0), human-approved

Three subsystems:

- **Engine** — loads, matches, and merges contexts + instincts into injection payloads
- **CLI** (`mcp-cp`) — approval registry for instinct lifecycle management
- **Memory Bridge** — syncs instincts to mcp-memory-service via HTTP API

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
    sync.ts           Bidirectional YAML ↔ Memory sync
  cli/                Approval Registry CLI (mcp-cp)
    index.ts          CLI entry point + argument parser
    registry.ts       approve/reject/tune/outcome/remove operations
    formatter.ts      ANSI terminal formatting

instincts/            YAML instinct files (*.instincts.yaml)
contexts/             JSON context files (*_context.json, from v1.8.x)
.claude/skills/       Claude Code skills
  instill.md          /instill — distill instincts from session
```

## Commands

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm run lint      # Type-check only
npm test          # Run tests (vitest)

# CLI
mcp-cp list                          # List all instincts
mcp-cp show <id>                     # Detail view
mcp-cp approve <id>                  # Human approval
mcp-cp reject <id>                   # Deactivate
mcp-cp tune <id> --confidence 0.8    # Tune parameters
mcp-cp outcome <id> + "note"         # Record positive outcome
```

## Key Types

- `Instinct` — Learned rule with confidence scoring + outcome tracking
- `Context` — Static context with tool-matching + triggers
- `Engine` — Unified coordinator for contexts + instincts + memory bridge
- `IMemoryBridge` — Interface for memory service integration
- `Registry` — Programmatic instinct lifecycle management

## Conventions

- IDs: kebab-case (`git-conventional-commits`)
- Confidence: 0.0–1.0, default min_confidence: 0.5
- YAML files: `*.instincts.yaml` extension
- JSON context files: `*_context.json`
- All instincts require human approval (`approved_by: human`)
- Rules must be 20–80 tokens (Zod enforced: 5–120 soft range)
- Memory Bridge uses `X-API-Key` header for auth

## Memory Bridge Config

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
await engine.connectMemory();
await engine.syncToMemory();
```
