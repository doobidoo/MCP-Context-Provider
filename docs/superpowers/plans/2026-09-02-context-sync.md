# Context Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push context files into mcp-memory-service and write them back onto another machine, byte for byte.

**Architecture:** One memory per context. The exact file text lives in `metadata.payload`, so it round-trips without chunking; `content` is a one-line summary so the context stays findable by semantic search. A new `ContextSync` mirrors the existing `InstinctSync`, and a separate `ContextWriter` owns every disk write because that is where path traversal and overwrite risk live.

**Tech Stack:** TypeScript (ESM, NodeNext), Zod, vitest, Node built-in `fetch`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-context-sync-design.md`

## Global Constraints

- Node `>=20`. ESM only: every relative import ends in `.js`, including from `.ts` sources.
- Zero new runtime dependencies.
- `npm run lint` is `tsc --noEmit` and must stay clean; the repo compiles under `strict` with `noUncheckedIndexedAccess`, so index access needs `!` or a guard.
- Tests are vitest with `globals: false` — import `describe`, `it`, `expect` explicitly from `vitest`.
- No emoji in code, comments, commit messages or docs.
- Commit messages: Conventional Commits, imperative subject, no AI/assistant attribution and no `Co-Authored-By` for tooling.
- Marker tag for contexts: `context-json`. Per-context tag: `context:<tool_category>`. Also tag `portable`.
- Payload metadata keys are `payload`, `file_name`, `context_version`, `content_sha256`, `source`, `synced_at`. Never `chunk_index`, `total_chunks` or `original_hash` — those belong to the memory service's own auto-splitting.
- Valid context file name: `^[a-z0-9][a-z0-9_-]*_context\.json$`, basename only.
- Never overwrite a context file without an explicit `force`, and keep a `.bak` when forcing.
- All file writes go through temp-file-then-rename, matching `InstinctLoader.save()`.

---

## File Structure

**Created:**
- `src/bridge/context-sync.ts` — push/pull orchestration against the bridge. No disk access.
- `src/bridge/context-writer.ts` — the only code that writes context files. Name validation, containment check, atomic write, `.bak` on force.
- `src/__tests__/helpers/fake-memory-bridge.ts` — in-memory `IMemoryBridge` test double.
- `src/__tests__/context-sync.test.ts` — push/pull behaviour.
- `src/__tests__/context-writer.test.ts` — write, refuse, force, traversal.

**Modified:**
- `src/schema/context.schema.ts` — `metadata.sync` field.
- `src/types/context.ts` — `ContextMetadata.sync`, plus the `LoadedContextFile` type.
- `src/engine/context-loader.ts` — retain file name and raw text per context.
- `src/bridge/types.ts` — `contextTag` config, three interface methods, marker parameter on `searchByTags`.
- `src/bridge/http-bridge.ts` — implement them.
- `src/engine/engine.ts` — `syncContextsToMemory()`, `pullContextsFromMemory()`, expose loaded context files.
- `src/server/index.ts` — `sync_contexts` and `restore_contexts` tools.
- `README.md`, `CLAUDE.md`, `CHANGELOG.md`.

Two units are deliberately separate: `ContextSync` talks to the bridge and never touches the filesystem; `ContextWriter` touches the filesystem and never talks to the bridge. The security-critical rules (name validation, containment, no silent overwrite) are then testable without a bridge at all.

---

### Task 1: Loader retains file name, raw text, and the sync flag

`loadAll()` returns `Map<string, Context>`, which loses both the source file name and the original bytes. The storage model needs both: `file_name` goes into metadata, and `payload` must be the exact file text, not a re-serialised object. Zod also strips unknown metadata keys, so `metadata.sync` has to be declared or it silently disappears.

**Files:**
- Modify: `src/schema/context.schema.ts` (`ContextMetadataSchema`)
- Modify: `src/types/context.ts` (`ContextMetadata`, new `LoadedContextFile`)
- Modify: `src/engine/context-loader.ts` (`LoadResult`, `loadAll`)
- Test: `src/__tests__/context-loader-files.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LoadedContextFile { fileName: string; raw: string; context: Context }`, exported from `src/types/context.ts`; `LoadResult.files: LoadedContextFile[]` from `src/engine/context-loader.ts`; `ContextMetadata.sync?: boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/context-loader-files.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextLoader } from '../engine/context-loader.js';

let dir: string;

const gitContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-loader-files-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ContextLoader.loadAll — file provenance', () => {
  it('returns the source file name and the exact raw text', async () => {
    const raw = JSON.stringify(gitContext, null, 2) + '\n';
    await writeFile(join(dir, 'git_context.json'), raw, 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('git_context.json');
    expect(files[0]!.raw).toBe(raw);
    expect(files[0]!.context.tool_category).toBe('git');
  });

  it('keeps metadata.sync instead of stripping it', async () => {
    const withFlag = {
      ...gitContext,
      metadata: { ...gitContext.metadata, sync: false },
    };
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(withFlag), 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files[0]!.context.metadata.sync).toBe(false);
  });

  it('leaves metadata.sync undefined when the file does not set it', async () => {
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files[0]!.context.metadata.sync).toBeUndefined();
  });

  it('does not descend into subdirectories', async () => {
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');
    await mkdir(join(dir, 'private'));
    await writeFile(
      join(dir, 'private', 'secret_context.json'),
      JSON.stringify({ ...gitContext, tool_category: 'secret' }),
      'utf-8',
    );

    const { files, contexts } = await new ContextLoader(dir).loadAll();

    expect(files.map((f) => f.fileName)).toEqual(['git_context.json']);
    expect(contexts.has('secret')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/context-loader-files.test.ts`
Expected: FAIL — `files` is undefined on the load result.

- [ ] **Step 3: Declare the sync flag in the schema**

In `src/schema/context.schema.ts`, inside `ContextMetadataSchema`, after the `author` line:

```typescript
  author: z.string().optional(),

  /**
   * Opt out of pushing this context to the memory service. Absent or true
   * means it syncs. Declared here because Zod strips unknown metadata keys,
   * so an undeclared flag would vanish on parse and read as "sync me".
   */
  sync: z.boolean().optional(),
```

- [ ] **Step 4: Mirror the field on the type**

In `src/types/context.ts`, inside `interface ContextMetadata`, add:

```typescript
  /** Opt out of memory-service sync. Absent means sync. */
  sync?: boolean;
```

And add this exported type at the end of the same file:

```typescript
/** A context together with where it came from on disk. */
export interface LoadedContextFile {
  /** Basename of the source file, e.g. "git_context.json". */
  fileName: string;

  /** The file's exact text, as read. Not a re-serialisation. */
  raw: string;

  /** The parsed, validated context. */
  context: Context;
}
```

- [ ] **Step 5: Return the files from the loader**

In `src/engine/context-loader.ts`: extend the imports and the result shape, then populate it.

```typescript
import type { Context, LoadedContextFile } from '../types/context.js';
```

```typescript
export interface LoadResult {
  /** Successfully loaded contexts keyed by tool_category. */
  contexts: Map<string, Context>;

  /** The same contexts with their source file name and raw text. */
  files: LoadedContextFile[];

  /** Files that failed to load, with error details. */
  errors: Array<{ file: string; error: string }>;
}
```

Inside `loadAll()`, declare `const files: LoadedContextFile[] = [];` next to the existing `contexts` map, push an entry wherever a context is currently added to the map — the raw string is already in hand there from `readFile` — and include `files` in the returned object. Keep `contexts` exactly as it is; existing callers must not change.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/context-loader-files.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 112 tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/schema/context.schema.ts src/types/context.ts src/engine/context-loader.ts src/__tests__/context-loader-files.test.ts
git commit -m "feat: retain context file provenance and the sync flag

The loader returned only a Map keyed by tool_category, which loses the
source file name and the original bytes. The memory-service sync needs
both: the file name goes into the stored metadata, and the payload has to
be the exact file text rather than a re-serialisation that may differ in
key order or whitespace.

metadata.sync is declared in the schema because Zod strips unknown keys.
An undeclared flag would disappear on parse and a context marked as
do-not-sync would read as sync-me."
```

---

### Task 2: Bridge surface for contexts

`searchByTags` hard-codes `instinctTag` as the marker, so contexts cannot be looked up. Generalise the marker to a parameter and add the three context methods.

**Files:**
- Modify: `src/bridge/types.ts`
- Modify: `src/bridge/http-bridge.ts`
- Test: `src/__tests__/http-bridge-contexts.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: on `IMemoryBridge` — `storeContext(category: string, content: string, tags: string[], metadata: Record<string, unknown>): Promise<string>`, `listContexts(page?: number, pageSize?: number): Promise<{ memories: MemoryRecord[]; total: number }>`, `deleteContext(contentHash: string): Promise<boolean>`, and `searchByTags(tags: string[], matchAll?: boolean, marker?: string): Promise<MemorySearchResult[]>`. On `MemoryBridgeConfig` — `contextTag: string`, default `'context-json'`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/http-bridge-contexts.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpMemoryBridge } from '../bridge/http-bridge.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpMemoryBridge — contexts', () => {
  it('stores a context tagged as context-json with its category', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return Promise.resolve(jsonResponse({ content_hash: 'abc123' }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    const hash = await bridge.storeContext(
      'git',
      'Context git: Git workflow rules',
      ['portable'],
      { payload: '{}', file_name: 'git_context.json' },
    );

    expect(hash).toBe('abc123');
    expect(calls[0]!.url).toBe('https://memory.test/api/memories');
    expect(calls[0]!.body['tags']).toEqual(['context-json', 'context:git', 'portable']);
    expect(calls[0]!.body['memory_type']).toBe('context');
    expect((calls[0]!.body['metadata'] as Record<string, unknown>)['file_name']).toBe(
      'git_context.json',
    );
  });

  it('lists contexts filtered by the context marker tag', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      return Promise.resolve(jsonResponse({ memories: [], total: 0 }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.listContexts(2, 25);

    expect(urls[0]).toContain('tag=context-json');
    expect(urls[0]).toContain('page=2');
    expect(urls[0]).toContain('page_size=25');
  });

  it('searchByTags uses the given marker instead of the instinct tag', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ results: [] }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.searchByTags(['context:git'], true, 'context-json');

    expect(bodies[0]!['tags']).toEqual(['context-json', 'context:git']);
    expect(bodies[0]!['match_all']).toBe(true);
  });

  it('searchByTags still defaults to the instinct marker', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ results: [] }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.searchByTags(['instinct-id:foo']);

    expect(bodies[0]!['tags']).toEqual(['instinct', 'instinct-id:foo']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/http-bridge-contexts.test.ts`
Expected: FAIL — `bridge.storeContext is not a function`.

- [ ] **Step 3: Extend config and interface**

In `src/bridge/types.ts`, add to `MemoryBridgeConfig` after `instinctTag`:

```typescript
  /** Tag prefix used to identify context memories. @default "context-json" */
  contextTag: string;
```

Add to `DEFAULT_BRIDGE_CONFIG`:

```typescript
  contextTag: 'context-json',
```

Change the `searchByTags` signature in `IMemoryBridge` and add the context methods:

```typescript
  /**
   * Search memories by tags. `marker` is the leading tag that scopes the
   * search; it defaults to the instinct tag so existing callers are unchanged.
   */
  searchByTags(tags: string[], matchAll?: boolean, marker?: string): Promise<MemorySearchResult[]>;

  /** Store a context as a memory. Returns content_hash. */
  storeContext(category: string, content: string, tags: string[], metadata: Record<string, unknown>): Promise<string>;

  /** Get all stored context memories. */
  listContexts(page?: number, pageSize?: number): Promise<{ memories: MemoryRecord[]; total: number }>;

  /** Delete a context memory by content hash. */
  deleteContext(contentHash: string): Promise<boolean>;
```

- [ ] **Step 4: Implement on the HTTP bridge**

In `src/bridge/http-bridge.ts`, change `searchByTags` to take the marker:

```typescript
  async searchByTags(
    tags: string[],
    matchAll = false,
    marker: string = this.config.instinctTag,
  ): Promise<MemorySearchResult[]> {
    const allTags = [marker, ...tags];
```

Leave the rest of that method as it is. Then add:

```typescript
  async storeContext(
    category: string,
    content: string,
    tags: string[],
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const body = {
      content,
      tags: [this.config.contextTag, `context:${category}`, ...tags],
      memory_type: 'context',
      metadata: {
        ...metadata,
        context_category: category,
        source: 'mcp-context-provider',
      },
    };

    const res = await this.fetch('/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to store context: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { content_hash: string };
    return data.content_hash;
  }

  async listContexts(
    page = 1,
    pageSize = 50,
  ): Promise<{ memories: MemoryRecord[]; total: number }> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      tag: this.config.contextTag,
    });

    const res = await this.fetch(`/memories?${params.toString()}`);
    if (!res.ok) return { memories: [], total: 0 };

    return (await res.json()) as { memories: MemoryRecord[]; total: number };
  }

  async deleteContext(contentHash: string): Promise<boolean> {
    const res = await this.fetch(`/memories/${contentHash}`, { method: 'DELETE' });
    return res.ok;
  }
```

Note: `storeContext` returns `data.content_hash`, but a chunked store returns a different shape. Contexts are stored with a one-line `content`, far below any split threshold, so this path never chunks. Do not add chunk handling here.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/http-bridge-contexts.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 116 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/bridge/types.ts src/bridge/http-bridge.ts src/__tests__/http-bridge-contexts.test.ts
git commit -m "feat: add context methods to the memory bridge

searchByTags hard-coded the instinct tag as its marker, so contexts could
not be looked up at all. The marker is a parameter now, defaulting to the
instinct tag so every existing caller behaves exactly as before.

storeContext, listContexts and deleteContext mirror the instinct methods."
```

---

### Task 3: Fake bridge for tests

No test double exists, which is why `InstinctSync` has no unit tests. Write one that both syncs can use.

**Files:**
- Create: `src/__tests__/helpers/fake-memory-bridge.ts`
- Test: covered by Tasks 4 and 5; this task's gate is that it compiles and satisfies the interface.

**Interfaces:**
- Consumes: `IMemoryBridge`, `MemoryRecord`, `MemorySearchResult` from `src/bridge/types.js`.
- Produces: `class FakeMemoryBridge implements IMemoryBridge`, with `records: Map<string, MemoryRecord>` and `storeCalls: number` public for assertions.

- [ ] **Step 1: Write the fake**

```typescript
// src/__tests__/helpers/fake-memory-bridge.ts
import { createHash } from 'node:crypto';
import type {
  IMemoryBridge,
  MemoryRecord,
  MemorySearchResult,
} from '../../bridge/types.js';

/**
 * In-memory IMemoryBridge for tests. Stores whole records so a test can
 * assert on tags and metadata, and counts stores so a re-push can be checked
 * for duplication.
 */
export class FakeMemoryBridge implements IMemoryBridge {
  readonly records = new Map<string, MemoryRecord>();
  storeCalls = 0;
  healthy = true;

  async healthCheck(): Promise<boolean> {
    return this.healthy;
  }

  private put(content: string, tags: string[], type: string, metadata: Record<string, unknown>): string {
    const hash = createHash('sha256')
      .update(content + JSON.stringify(tags) + String(this.storeCalls))
      .digest('hex');
    const now = Date.now() / 1000;
    this.records.set(hash, {
      content,
      content_hash: hash,
      tags,
      memory_type: type,
      metadata,
      created_at: now,
      created_at_iso: new Date(now * 1000).toISOString(),
      updated_at: null,
      updated_at_iso: null,
    });
    this.storeCalls += 1;
    return hash;
  }

  private byTags(tags: string[], matchAll: boolean): MemoryRecord[] {
    return [...this.records.values()].filter((r) =>
      matchAll ? tags.every((t) => r.tags.includes(t)) : tags.some((t) => r.tags.includes(t)),
    );
  }

  async storeInstinct(
    instinctId: string,
    content: string,
    tags: string[],
    metadata: Record<string, unknown>,
  ): Promise<string> {
    return this.put(content, ['instinct', `instinct-id:${instinctId}`, ...tags], 'instinct', metadata);
  }

  async storeContext(
    category: string,
    content: string,
    tags: string[],
    metadata: Record<string, unknown>,
  ): Promise<string> {
    return this.put(
      content,
      ['context-json', `context:${category}`, ...tags],
      'context',
      { ...metadata, context_category: category, source: 'mcp-context-provider' },
    );
  }

  async searchInstincts(_query: string, _limit = 5): Promise<MemorySearchResult[]> {
    return [];
  }

  async searchByTags(
    tags: string[],
    matchAll = false,
    marker = 'instinct',
  ): Promise<MemorySearchResult[]> {
    return this.byTags([marker, ...tags], matchAll).map((memory) => ({
      memory,
      similarity_score: 1,
      relevance_reason: 'tag match',
    }));
  }

  async deleteInstinct(contentHash: string): Promise<boolean> {
    return this.records.delete(contentHash);
  }

  async deleteContext(contentHash: string): Promise<boolean> {
    return this.records.delete(contentHash);
  }

  async listInstincts(page = 1, pageSize = 50): Promise<{ memories: MemoryRecord[]; total: number }> {
    return this.page(this.byTags(['instinct'], true), page, pageSize);
  }

  async listContexts(page = 1, pageSize = 50): Promise<{ memories: MemoryRecord[]; total: number }> {
    return this.page(this.byTags(['context-json'], true), page, pageSize);
  }

  private page(
    all: MemoryRecord[],
    page: number,
    pageSize: number,
  ): { memories: MemoryRecord[]; total: number } {
    const start = (page - 1) * pageSize;
    return { memories: all.slice(start, start + pageSize), total: all.length };
  }
}
```

- [ ] **Step 2: Verify it satisfies the interface**

Run: `npm run lint`
Expected: clean. A missing or mistyped method fails here — that is this step's whole purpose. If `IMemoryBridge` has members this fake does not implement, add them; do not widen the interface.

- [ ] **Step 3: Confirm vitest does not treat the helper as a suite**

Run: `npm test`
Expected: still 116 tests, no new file collected. `vitest.config.ts` includes `src/**/*.test.ts`, and this file is not `*.test.ts`, so it is imported rather than collected.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/helpers/fake-memory-bridge.ts
git commit -m "test: add an in-memory bridge double

No double existed, which is why the instinct sync has no unit tests. This
one keeps whole records so tests can assert on tags and metadata, and
counts stores so a re-push can be checked for duplication rather than
just for success."
```

---

### Task 4: ContextSync.pushToMemory

**Files:**
- Create: `src/bridge/context-sync.ts`
- Test: `src/__tests__/context-sync.test.ts`

**Interfaces:**
- Consumes: `LoadedContextFile` (Task 1), `storeContext`/`searchByTags`/`deleteContext` (Task 2), `FakeMemoryBridge` (Task 3).
- Produces: `class ContextSync` with `constructor(bridge: IMemoryBridge)` and `pushToMemory(files: LoadedContextFile[]): Promise<ContextPushResult>`; `interface ContextPushResult { pushed: string[]; skipped: Array<{ category: string; reason: string }>; errors: Array<{ category: string; error: string }> }`; `function contextSummary(context: Context): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/context-sync.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ContextSync } from '../bridge/context-sync.js';
import { FakeMemoryBridge } from './helpers/fake-memory-bridge.js';
import type { Context, LoadedContextFile } from '../types/context.js';

let bridge: FakeMemoryBridge;
let sync: ContextSync;

function context(category: string, sync?: boolean): Context {
  return {
    tool_category: category,
    description: `${category} rules`,
    auto_convert: false,
    metadata: {
      version: '1.2.0',
      applies_to_tools: [`${category}:*`],
      ...(sync === undefined ? {} : { sync }),
    },
  };
}

function loaded(category: string, syncFlag?: boolean): LoadedContextFile {
  const ctx = context(category, syncFlag);
  return {
    fileName: `${category}_context.json`,
    raw: JSON.stringify(ctx, null, 2) + '\n',
    context: ctx,
  };
}

beforeEach(() => {
  bridge = new FakeMemoryBridge();
  sync = new ContextSync(bridge);
});

describe('ContextSync.pushToMemory', () => {
  it('stores the exact raw text in metadata.payload', async () => {
    const file = loaded('git');
    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual(['git']);
    const record = [...bridge.records.values()][0]!;
    expect(record.metadata['payload']).toBe(file.raw);
    expect(record.metadata['file_name']).toBe('git_context.json');
    expect(record.metadata['context_version']).toBe('1.2.0');
    expect(record.metadata['content_sha256']).toBe(
      createHash('sha256').update(file.raw).digest('hex'),
    );
  });

  it('puts a one-line summary in content, not the payload', async () => {
    await sync.pushToMemory([loaded('git')]);

    const record = [...bridge.records.values()][0]!;
    expect(record.content).toBe('Context git: git rules');
    expect(record.content).not.toContain('applies_to_tools');
  });

  it('tags the memory with the marker and the category', async () => {
    await sync.pushToMemory([loaded('git')]);

    const record = [...bridge.records.values()][0]!;
    expect(record.tags).toContain('context-json');
    expect(record.tags).toContain('context:git');
    expect(record.tags).toContain('portable');
  });

  it('replaces rather than duplicates on a re-push', async () => {
    await sync.pushToMemory([loaded('git')]);
    await sync.pushToMemory([loaded('git')]);

    expect(bridge.records.size).toBe(1);
    expect(bridge.storeCalls).toBe(2);
  });

  it('skips a context with metadata.sync false', async () => {
    const result = await sync.pushToMemory([loaded('git', false), loaded('memory')]);

    expect(result.pushed).toEqual(['memory']);
    expect(result.skipped).toEqual([
      { category: 'git', reason: 'metadata.sync is false' },
    ]);
    expect(bridge.records.size).toBe(1);
  });

  it('pushes when metadata.sync is explicitly true', async () => {
    const result = await sync.pushToMemory([loaded('git', true)]);
    expect(result.pushed).toEqual(['git']);
  });

  it('records a per-context error without aborting the rest', async () => {
    const failing = new FakeMemoryBridge();
    failing.storeContext = async (category: string) => {
      if (category === 'git') throw new Error('boom');
      return 'hash';
    };
    const result = await new ContextSync(failing).pushToMemory([
      loaded('git'),
      loaded('memory'),
    ]);

    expect(result.pushed).toEqual(['memory']);
    expect(result.errors).toEqual([{ category: 'git', error: 'boom' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/context-sync.test.ts`
Expected: FAIL — cannot find module `../bridge/context-sync.js`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/bridge/context-sync.ts
/**
 * Bidirectional sync of context files with mcp-memory-service.
 *
 * One memory per context. `content` is a one-line summary so the context
 * stays findable by semantic search; the exact file text lives in
 * `metadata.payload`, which round-trips byte for byte. Storing the file as
 * memory content does not round-trip: the service splits content over its
 * backend limit into overlapping chunks and returns one of them.
 *
 * This class never touches the filesystem. Writing pulled contexts to disk
 * is ContextWriter's job.
 */

import { createHash } from 'node:crypto';
import type { Context, LoadedContextFile } from '../types/context.js';
import type { IMemoryBridge } from './types.js';

export const CONTEXT_MARKER_TAG = 'context-json';

export interface ContextPushResult {
  /** Categories stored. */
  pushed: string[];
  /** Categories deliberately not stored, with the reason. */
  skipped: Array<{ category: string; reason: string }>;
  /** Categories whose store failed. */
  errors: Array<{ category: string; error: string }>;
}

/** The single line that gets embedded, and therefore searched. */
export function contextSummary(context: Context): string {
  return `Context ${context.tool_category}: ${context.description}`;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export class ContextSync {
  constructor(private readonly bridge: IMemoryBridge) {}

  /**
   * Push contexts into the memory service, replacing any earlier copy of the
   * same category. Idempotent: a re-push leaves one memory per context.
   */
  async pushToMemory(files: LoadedContextFile[]): Promise<ContextPushResult> {
    const result: ContextPushResult = { pushed: [], skipped: [], errors: [] };

    for (const file of files) {
      const category = file.context.tool_category;

      if (file.context.metadata.sync === false) {
        result.skipped.push({ category, reason: 'metadata.sync is false' });
        continue;
      }

      try {
        const existing = await this.bridge.searchByTags(
          [`context:${category}`],
          true,
          CONTEXT_MARKER_TAG,
        );
        for (const match of existing) {
          await this.bridge.deleteContext(match.memory.content_hash);
        }

        await this.bridge.storeContext(
          category,
          contextSummary(file.context),
          ['portable'],
          {
            payload: file.raw,
            file_name: file.fileName,
            context_version: file.context.metadata.version,
            content_sha256: sha256(file.raw),
            synced_at: new Date().toISOString(),
          },
        );

        result.pushed.push(category);
      } catch (e) {
        result.errors.push({
          category,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/context-sync.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 123 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/bridge/context-sync.ts src/__tests__/context-sync.test.ts
git commit -m "feat: push contexts to the memory service

One memory per context: a one-line summary as content so semantic search
still finds it, and the exact file text in metadata.payload. Storing the
file as memory content does not round-trip - the service splits content
over its backend limit into overlapping chunks and hands back one of them.

Push deletes the earlier copy of a category before storing, so a re-push
replaces rather than duplicates. metadata.sync false opts a context out."
```

---

### Task 5: ContextSync.pullFromMemory

**Files:**
- Modify: `src/bridge/context-sync.ts`
- Modify: `src/__tests__/context-sync.test.ts`

**Interfaces:**
- Consumes: `listContexts` (Task 2), `sha256` (Task 4).
- Produces: `pullFromMemory(): Promise<PulledContext[]>` and `interface PulledContext { category: string; fileName: string; version: string; payload: string; integrityOk: boolean }`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/context-sync.test.ts`:

```typescript
describe('ContextSync.pullFromMemory', () => {
  it('returns the payload byte for byte', async () => {
    const file = loaded('git');
    await sync.pushToMemory([file]);

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(1);
    expect(pulled[0]!.category).toBe('git');
    expect(pulled[0]!.fileName).toBe('git_context.json');
    expect(pulled[0]!.version).toBe('1.2.0');
    expect(pulled[0]!.payload).toBe(file.raw);
    expect(pulled[0]!.integrityOk).toBe(true);
  });

  it('flags a payload whose stored hash does not match', async () => {
    await sync.pushToMemory([loaded('git')]);
    const record = [...bridge.records.values()][0]!;
    record.metadata['content_sha256'] = 'deadbeef';

    const pulled = await sync.pullFromMemory();

    expect(pulled[0]!.integrityOk).toBe(false);
  });

  it('ignores memories that carry no payload', async () => {
    await bridge.storeContext('stray', 'Context stray: no payload', [], {});

    const pulled = await sync.pullFromMemory();

    expect(pulled).toEqual([]);
  });

  it('pages through more contexts than one page holds', async () => {
    const files = Array.from({ length: 120 }, (_, i) => loaded(`cat${i}`));
    await sync.pushToMemory(files);

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/context-sync.test.ts -t pullFromMemory`
Expected: FAIL — `sync.pullFromMemory is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/bridge/context-sync.ts`:

```typescript
export interface PulledContext {
  /** tool_category the memory was stored under. */
  category: string;
  /** File name recorded at push time. Validated before any write. */
  fileName: string;
  /** metadata.version of the stored context. */
  version: string;
  /** The context file's text. */
  payload: string;
  /** Whether the payload still hashes to the stored content_sha256. */
  integrityOk: boolean;
}
```

And the method, inside the class:

```typescript
  /**
   * Read every context memory. Returns payloads with their recorded file
   * name and an integrity verdict; writing them is the caller's decision.
   */
  async pullFromMemory(): Promise<PulledContext[]> {
    const pulled: PulledContext[] = [];
    const pageSize = 50;
    let page = 1;

    for (;;) {
      const { memories, total } = await this.bridge.listContexts(page, pageSize);
      if (memories.length === 0) break;

      for (const memory of memories) {
        const payload = memory.metadata['payload'];
        const fileName = memory.metadata['file_name'];
        if (typeof payload !== 'string' || typeof fileName !== 'string') continue;

        const category =
          typeof memory.metadata['context_category'] === 'string'
            ? memory.metadata['context_category']
            : '';
        const version =
          typeof memory.metadata['context_version'] === 'string'
            ? memory.metadata['context_version']
            : '';
        const expected = memory.metadata['content_sha256'];

        pulled.push({
          category,
          fileName,
          version,
          payload,
          integrityOk: typeof expected === 'string' && sha256(payload) === expected,
        });
      }

      if (page * pageSize >= total) break;
      page += 1;
    }

    return pulled;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/context-sync.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 127 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/bridge/context-sync.ts src/__tests__/context-sync.test.ts
git commit -m "feat: pull contexts back out of the memory service

Reading only: payloads come back with the file name recorded at push time
and an integrity verdict from the stored SHA-256. Whether any of it is
written to disk is the caller's decision, not this class's."
```

---

### Task 6: ContextWriter — the only code that writes context files

The file name comes out of the memory service, so it is untrusted input to a write. This unit owns validation, containment, refusal and `.bak`, and needs no bridge to test.

**Files:**
- Create: `src/bridge/context-writer.ts`
- Test: `src/__tests__/context-writer.test.ts`

**Interfaces:**
- Consumes: `PulledContext` (Task 5), `ContextSchema` from `src/schema/context.schema.js`.
- Produces: `class ContextWriter` with `constructor(contextsPath: string)` and `write(pulled: PulledContext[], options?: { force?: boolean }): Promise<ContextWriteResult>`; `interface ContextWriteResult { written: string[]; skipped: Array<{ fileName: string; reason: string }>; }`; `const VALID_CONTEXT_FILENAME: RegExp`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/context-writer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextWriter } from '../bridge/context-writer.js';
import type { PulledContext } from '../bridge/context-sync.js';

let dir: string;
let writer: ContextWriter;

const validContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

function pulled(over: Partial<PulledContext> = {}): PulledContext {
  return {
    category: 'git',
    fileName: 'git_context.json',
    version: '1.2.0',
    payload: JSON.stringify(validContext, null, 2) + '\n',
    integrityOk: true,
    ...over,
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-writer-'));
  writer = new ContextWriter(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ContextWriter.write', () => {
  it('writes a context that does not exist locally', async () => {
    const p = pulled();
    const result = await writer.write([p]);

    expect(result.written).toEqual(['git_context.json']);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(p.payload);
  });

  it('leaves an existing file byte-identical without force', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');

    const result = await writer.write([pulled()]);

    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([
      { fileName: 'git_context.json', reason: 'file exists (use force to overwrite)' },
    ]);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(original);
  });

  it('overwrites with force and keeps a .bak of the previous file', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');

    const p = pulled();
    const result = await writer.write([p], { force: true });

    expect(result.written).toEqual(['git_context.json']);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(p.payload);
    expect(await readFile(join(dir, 'git_context.json.bak'), 'utf-8')).toBe(original);
  });

  it('refuses a payload whose integrity check failed', async () => {
    const result = await writer.write([pulled({ integrityOk: false })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toBe('integrity check failed');
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a payload that is not a valid context', async () => {
    const result = await writer.write([pulled({ payload: '{"nope":true}' })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('schema');
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a payload that is not JSON at all', async () => {
    const result = await writer.write([pulled({ payload: 'not json' })]);

    expect(result.written).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it.each([
    '../escape_context.json',
    'sub/dir_context.json',
    '/absolute_context.json',
    '..%2fescape_context.json',
    'Capital_context.json',
    'no-suffix.json',
    '_context.json',
  ])('refuses the file name %s and writes nothing', async (fileName) => {
    const result = await writer.write([pulled({ fileName })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toBe('invalid file name');
    expect(await readdir(dir)).toEqual([]);
  });

  it('leaves no temp file behind after a successful write', async () => {
    await writer.write([pulled()]);

    expect(await readdir(dir)).toEqual(['git_context.json']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/context-writer.test.ts`
Expected: FAIL — cannot find module `../bridge/context-writer.js`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/bridge/context-writer.ts
/**
 * Writes pulled contexts to disk. The only place in the codebase that does.
 *
 * The file name arrives from the memory service, which makes it untrusted
 * input to a filesystem write. It is validated as a basename, and the
 * resolved target is checked to still sit inside the contexts directory,
 * before anything is written. A `file_name` of "../../.ssh/authorized_keys"
 * must not be a way out of that directory, whatever put it there.
 *
 * Writes are atomic (temp file, then rename) and never silent: an existing
 * file is left alone unless `force` is set, and forcing keeps a `.bak`.
 */

import { copyFile, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ContextSchema } from '../schema/context.schema.js';
import type { PulledContext } from './context-sync.js';

/** Context file names this writer accepts. Basename only, lowercase. */
export const VALID_CONTEXT_FILENAME = /^[a-z0-9][a-z0-9_-]*_context\.json$/;

export interface ContextWriteResult {
  /** File names written. */
  written: string[];
  /** File names not written, with the reason. */
  skipped: Array<{ fileName: string; reason: string }>;
}

export class ContextWriter {
  constructor(private readonly contextsPath: string) {}

  async write(
    pulled: PulledContext[],
    options: { force?: boolean } = {},
  ): Promise<ContextWriteResult> {
    const result: ContextWriteResult = { written: [], skipped: [] };
    const force = options.force === true;

    for (const item of pulled) {
      const skip = (reason: string): void => {
        result.skipped.push({ fileName: item.fileName, reason });
      };

      if (!VALID_CONTEXT_FILENAME.test(item.fileName)) {
        skip('invalid file name');
        continue;
      }

      const target = resolve(this.contextsPath, item.fileName);
      if (!target.startsWith(resolve(this.contextsPath) + sep)) {
        // Belt and braces: the regex already rules out separators.
        skip('invalid file name');
        continue;
      }

      if (!item.integrityOk) {
        skip('integrity check failed');
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(item.payload);
      } catch (e) {
        skip(`payload is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const validation = ContextSchema.safeParse(parsed);
      if (!validation.success) {
        skip(`payload failed schema validation: ${validation.error.issues[0]?.message ?? 'invalid'}`);
        continue;
      }

      const exists = await readFile(target, 'utf-8').then(
        () => true,
        () => false,
      );

      if (exists && !force) {
        skip('file exists (use force to overwrite)');
        continue;
      }

      if (exists) {
        await copyFile(target, `${target}.bak`);
      }

      const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
      try {
        await writeFile(tmp, item.payload, 'utf-8');
        await rename(tmp, target);
      } catch (e) {
        await unlink(tmp).catch(() => undefined);
        skip(`write failed: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      result.written.push(item.fileName);
    }

    return result;
  }
}
```

Note `join` is imported but the containment check uses `resolve`; drop the `join` import if `tsc` flags it as unused.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/context-writer.test.ts`
Expected: PASS, 15 tests (the `it.each` block contributes 7).

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 142 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/bridge/context-writer.ts src/__tests__/context-writer.test.ts
git commit -m "feat: write pulled contexts to disk, carefully

The file name arrives from the memory service, so it is untrusted input to
a filesystem write. It is validated as a lowercase basename and the
resolved target is checked to still sit inside the contexts directory
before anything is written.

An existing file is left alone unless force is set, and forcing keeps a
.bak. Writes go through temp-file-then-rename. A payload that fails its
integrity check or the context schema is refused, not written."
```

---

### Task 7: Engine wiring

**Files:**
- Modify: `src/engine/engine.ts`
- Test: `src/__tests__/engine-context-sync.test.ts`

**Interfaces:**
- Consumes: `ContextSync` (Tasks 4, 5), `ContextWriter` (Task 6), `LoadResult.files` (Task 1).
- Produces: on `Engine` — `getContextFiles(): LoadedContextFile[]`, `syncContextsToMemory(): Promise<ContextPushResult | null>`, `pullContextsFromMemory(options?: { force?: boolean }): Promise<ContextWriteResult | null>`. Both async methods return `null` when the bridge is not configured or not connected, matching `syncToMemory()`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/engine-context-sync.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../engine/engine.js';

let dir: string;

const gitContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-engine-ctx-'));
  await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('Engine context sync', () => {
  it('exposes loaded context files with their provenance', async () => {
    const engine = new Engine({ contextsPath: dir, instinctsPath: join(dir, 'none') });
    await engine.initialize();

    const files = engine.getContextFiles();
    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('git_context.json');
  });

  it('returns null from both directions when no bridge is configured', async () => {
    const engine = new Engine({ contextsPath: dir, instinctsPath: join(dir, 'none') });
    await engine.initialize();

    expect(await engine.syncContextsToMemory()).toBeNull();
    expect(await engine.pullContextsFromMemory()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/engine-context-sync.test.ts`
Expected: FAIL — `engine.getContextFiles is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/engine/engine.ts`, add imports:

```typescript
import { ContextSync, type ContextPushResult } from '../bridge/context-sync.js';
import { ContextWriter, type ContextWriteResult } from '../bridge/context-writer.js';
import type { LoadedContextFile } from '../types/context.js';
```

Add a field beside the existing `contexts` field:

```typescript
  private contextFiles: LoadedContextFile[] = [];
  private contextSync?: ContextSync;
```

In `initialize()`, where `this.contexts = contextResult.contexts;` already runs, add:

```typescript
    this.contextFiles = contextResult.files;
```

Wherever `InstinctSync` is constructed for the bridge, construct `ContextSync` from the same bridge alongside it, so both are available once the bridge exists.

Then add the three methods next to `syncToMemory()`:

```typescript
  /** The loaded contexts with their source file name and raw text. */
  getContextFiles(): LoadedContextFile[] {
    return this.contextFiles;
  }

  /** Push all loaded contexts to the memory service. */
  async syncContextsToMemory(): Promise<ContextPushResult | null> {
    if (!this.contextSync || !this.memoryConnected) return null;
    return this.contextSync.pushToMemory(this.contextFiles);
  }

  /** Pull contexts from the memory service and write them to CONTEXTS_PATH. */
  async pullContextsFromMemory(
    options: { force?: boolean } = {},
  ): Promise<ContextWriteResult | null> {
    if (!this.contextSync || !this.memoryConnected) return null;
    const pulled = await this.contextSync.pullFromMemory();
    return new ContextWriter(this.config.contextsPath).write(pulled, options);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/engine-context-sync.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm run lint && npm test`
Expected: `tsc` clean, 144 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/engine/engine.ts src/__tests__/engine-context-sync.test.ts
git commit -m "feat: wire context sync into the engine

syncContextsToMemory and pullContextsFromMemory sit beside the existing
syncToMemory and follow its contract: null when the bridge is not
configured or not connected, rather than an empty result that reads like
success."
```

---

### Task 8: MCP tools, docs and changelog

**Files:**
- Modify: `src/server/index.ts`
- Modify: `README.md`, `CLAUDE.md`, `CHANGELOG.md`
- Test: manual, against the running memory service — the tool handlers are thin and the logic below them is covered by Tasks 4 to 7.

**Interfaces:**
- Consumes: `syncContextsToMemory`, `pullContextsFromMemory` (Task 7).
- Produces: MCP tools `sync_contexts` and `restore_contexts`.

- [ ] **Step 1: Declare the tools**

In `src/server/index.ts`, in the `ListToolsRequestSchema` handler's `tools` array, after the `sync_instincts` entry:

```typescript
    {
      name: 'sync_contexts',
      description:
        'Push all loaded contexts to mcp-memory-service. A context with metadata.sync false is skipped. Requires the memory bridge to be configured and connected.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'restore_contexts',
      description:
        'Pull contexts from mcp-memory-service and write them into CONTEXTS_PATH. Existing files are left untouched unless force is true, which keeps a .bak of the previous file.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          force: {
            type: 'boolean',
            description: 'Overwrite existing context files, keeping a .bak (default false)',
          },
        },
      },
    },
```

- [ ] **Step 2: Handle the calls**

In the `CallToolRequestSchema` switch, after the `sync_instincts` case:

```typescript
    case 'sync_contexts': {
      if (!MEMORY_BRIDGE_URL) {
        return { content: [{ type: 'text', text: 'Error: MEMORY_BRIDGE_URL not configured' }] };
      }
      const connected = await engine.connectMemory();
      if (!connected) {
        return { content: [{ type: 'text', text: 'Error: memory bridge not reachable' }] };
      }
      const result = await engine.syncContextsToMemory();
      if (!result) {
        return { content: [{ type: 'text', text: 'Error: sync failed (bridge not initialized)' }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({
          pushed: result.pushed.length,
          skipped: result.skipped.length,
          errors: result.errors.length,
          details: result,
        }) }],
      };
    }

    case 'restore_contexts': {
      if (!MEMORY_BRIDGE_URL) {
        return { content: [{ type: 'text', text: 'Error: MEMORY_BRIDGE_URL not configured' }] };
      }
      const connected = await engine.connectMemory();
      if (!connected) {
        return { content: [{ type: 'text', text: 'Error: memory bridge not reachable' }] };
      }
      const force = args?.['force'] === true;
      const result = await engine.pullContextsFromMemory({ force });
      if (!result) {
        return { content: [{ type: 'text', text: 'Error: pull failed (bridge not initialized)' }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({
          written: result.written.length,
          skipped: result.skipped.length,
          force,
          details: result,
        }) }],
      };
    }
```

- [ ] **Step 3: Build and check the tool list**

Run: `npm run lint && npm run build`
Then: `env -u INSTINCTS_PATH node dist/server/index.js </dev/null 2>&1 | head -5`
Expected: startup lines as before, no crash. The tool count in the README table goes from 10 to 12 in Step 5.

- [ ] **Step 4: Exercise both tools against the running service**

The memory service is at `https://127.0.0.1:8000/api` with a self-signed mkcert certificate; `NODE_EXTRA_CA_CERTS` must point at `~/Library/Application Support/mkcert/rootCA.pem` for the bridge to connect.

Call `sync_contexts` through the MCP client, then `restore_contexts` into an empty scratch `CONTEXTS_PATH`, and diff the result against the real contexts directory. Expected: every file byte-identical, `skipped` naming only contexts with `metadata.sync: false`.

Record the actual counts in the commit message. Do not claim it worked without this diff.

- [ ] **Step 5: Update the docs**

In `README.md`, add both tools to the MCP Tools table:

```markdown
| `sync_contexts` | Push all loaded contexts to the memory service |
| `restore_contexts` | Pull contexts from the memory service into `CONTEXTS_PATH` |
```

And add this section after **Store Location**:

```markdown
## Context Sync

Contexts can be pushed to mcp-memory-service and written back on another
machine. Requires `MEMORY_BRIDGE_URL`.

- `sync_contexts` — push every loaded context. One memory per context: a
  one-line summary as the searchable content, the exact file text in
  `metadata.payload`.
- `restore_contexts` — pull them and write into `CONTEXTS_PATH`. Files that
  already exist are left untouched and reported; `force: true` overwrites and
  keeps a `.bak`.

A context is not pushed if its `metadata.sync` is `false`. Contexts in
subdirectories of `CONTEXTS_PATH` are never loaded and therefore never pushed
— that is where private, machine-local contexts belong.
```

In `CLAUDE.md`, add both tools to the MCP Server table and note `src/bridge/context-sync.ts` and `src/bridge/context-writer.ts` in the Project Structure block.

- [ ] **Step 6: Update the changelog**

Under `## [Unreleased]`, add an `### Added` section:

```markdown
### Added
- **Context sync to the memory service** ([#7](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/7)): `sync_contexts` pushes every loaded context into mcp-memory-service, `restore_contexts` pulls them back and writes them into `CONTEXTS_PATH`. This existed in the v1.8 Python line and was dropped in the TypeScript rewrite. One memory per context: a one-line summary as the searchable content, the exact file text in `metadata.payload` — measured to round-trip byte for byte, where storing the file as memory content does not (the service splits it into overlapping chunks and returns one of them). Existing files are never overwritten without `force`, which keeps a `.bak`. A context opts out with `metadata.sync: false`, and contexts in subdirectories of `CONTEXTS_PATH` are never loaded and so never pushed.
```

- [ ] **Step 7: Commit**

```bash
git add src/server/index.ts README.md CLAUDE.md CHANGELOG.md
git commit -m "feat: add sync_contexts and restore_contexts MCP tools

Closes #7. Verified against the running memory service: pushed N contexts,
restored them into an empty CONTEXTS_PATH and diffed every file
byte-identical."
```

Replace `N` with the number from Step 4. If the diff was not clean, do not commit this message.

---

## Self-Review

**Spec coverage.** Storage model — Tasks 2 and 4. Bridge surface — Task 2. `ContextSync` — Tasks 4 and 5. What gets pushed, including the flat-file opt-out and the structural subdirectory exclusion — Tasks 1 and 4, tested in both. Tools — Task 8. Error handling, including the file-name rule the spec's self-review added — Task 6. Testing list — every bullet maps to a test in Tasks 1, 4, 5 or 6, except "including the largest real context in the repository", which Task 8 Step 4 covers as an end-to-end diff rather than a unit test. Out-of-scope items stay out: no CLI commands, no v1.8 memory migration, no conflict merging.

**Placeholders.** None. Every code step carries the code. The one deliberate blank is `N` in Task 8's final commit message, which is a measured count and is called out as such.

**Type consistency.** `LoadedContextFile { fileName, raw, context }` is defined in Task 1 and used with those names in Tasks 4, 7. `PulledContext { category, fileName, version, payload, integrityOk }` is defined in Task 5 and consumed with those names in Task 6. `ContextPushResult` and `ContextWriteResult` are returned by Tasks 4/6 and re-exported through the engine in Task 7 under the same names. `searchByTags(tags, matchAll, marker)` is widened in Task 2 and called with the marker in Task 4. `sha256` is defined in Task 4 and reused in Task 5.

One consistency risk is flagged rather than hidden: Task 2's `storeContext` and Task 3's `FakeMemoryBridge.storeContext` both prepend `context-json` and `context:<category>` to the tags. If Task 2's implementation changes that tag order, Task 3's fake and Task 4's assertions must change with it.
