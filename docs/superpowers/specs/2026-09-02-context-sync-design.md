# Context sync to the memory service

Design for [issue #7](https://codeberg.org/doobidoo/MCP-Context-Provider/issues/7).
Status: approved, ready for an implementation plan.

## Problem

Instincts sync to mcp-memory-service; contexts do not. `CONTEXTS_PATH`
defaults to the directory shipped with the package, so a hand-authored context
exists only on the machine that authored it. The v1.8 Python line could push
contexts into memory and write them back on another machine; the TypeScript
rewrite dropped both halves.

A memory stored on 2025-12-11 records the old behaviour: thirteen contexts
tagged `context-json,portable`, stored in multiple parts, recreated through a
`create_context_file` tool. Those memories still exist, so the port has real
data to compare against.

## What was measured

Four facts settled the design. Each was measured against the running service,
not assumed.

**Storing a context as memory content does not round-trip.** A 22,975-character
context comes back as 4,976 characters. The service splits content over
`max_content_length` into chunks and `GET /memories/{hash}` returns one of them.

**Reassembling the service's own chunks cannot restore the original.**
`split_content()` is called with `CONTENT_SPLIT_OVERLAP`, so adjacent chunks
share text. Concatenating them duplicates the overlap. Chunk metadata carries
`chunk_index`, `total_chunks` and `original_hash`, so the siblings are findable
— but findable is not the same as reassemblable.

**Compressing into a single memory does not fit.** The Cloudflare backend caps
content at 800 characters, tied to the BGE model's 512-token limit. With the
hybrid backend active that cap is binding. gzip+base64 of a 23 KB context is far
above it.

**Storing the file in `metadata` round-trips byte for byte.** A 22,975-character
payload in `metadata.payload` returned identical, as a single memory, with no
chunking. This is the mechanism the design uses.

## Storage model

One memory per context.

- **`content`** — a single readable line, `Context <category>: <description>`.
  This is what gets embedded, so a context stays findable by semantic search.
- **`metadata.payload`** — the exact file text, byte for byte.
- **`metadata`** — also `file_name`, `context_version` (from the context's own
  `metadata.version`), `content_sha256` of the payload, `source:
  mcp-context-provider`, `synced_at`.
- **tags** — `context-json` as the marker, `context:<tool_category>`, and
  `portable` for continuity with the v1 convention.

Metadata field names deliberately avoid `chunk_index`, `total_chunks` and
`original_hash`: those belong to the service's own auto-splitting and must not be
confused with ours.

## Components

**`IMemoryBridge`** gains `storeContext`, `listContexts` and `deleteContext`.
`searchByTags` is generalised to take the marker tag as a parameter instead of
hard-coding `instinctTag`; the existing instinct methods become thin wrappers, so
the instinct sync keeps working unchanged. `MemoryBridgeConfig` gains
`contextTag`, defaulting to `context-json`.

**`ContextSync`** (`src/bridge/context-sync.ts`) mirrors `InstinctSync`.

- `pushToMemory(contexts)` — per context: delete the existing memory found by
  `context:<category>`, then store fresh. Idempotent, the same shape as the
  instinct sync, so a re-push never duplicates.
- `pullFromMemory()` — list the `context-json` memories and return payloads with
  their category, file name, version and SHA. Reading only; writing files is the
  caller's decision.

**Engine** gains `syncContextsToMemory()` and `pullContextsFromMemory()`,
alongside the existing `syncToMemory()`.

## What gets pushed

Everything the engine has loaded.

`ContextLoader` reads its base directory flat, with no recursion, so
`contexts/private/` is never loaded and therefore never pushed. The exclusion
falls out of the existing architecture and needs no special case — but it is
covered by a test, because it is now load-bearing for privacy rather than
incidental.

For files that sit flat in `contexts/` but should still stay local, a context may
carry `metadata.sync: false` and is then skipped. The default is to sync. Two
files in the working tree are the reason this exists: `linkedin_context.json` and
`n8n_context.json` are gitignored yet loaded.

This matters because the memory service runs with
`MCP_MEMORY_STORAGE_BACKEND=hybrid`: everything stored is replicated to
Cloudflare D1 and Vectorize. A tag cannot prevent that — `HybridStorage.store()`
enqueues every memory for replication without inspecting tags — so the decision
of what leaves the machine has to be made here, before storing.

## Tools

**`sync_contexts`** — push. Reports `pushed`, `skipped` (with the reason:
`metadata.sync: false`), and `errors`.

**`restore_contexts`** — pull and write into `CONTEXTS_PATH`. Writes only files
that do not exist locally. An existing file is left untouched and reported as a
conflict, showing the local and remote `context_version`. `force: true`
overwrites, keeping a `.bak` of the previous file.

Never overwriting without `force` is a direct consequence of what happened in
this repository: a store that was silently replaced lost 229 instincts, and the
only reason they came back was a `.bak` left behind by something else.

## Error handling

A context is skipped and reported, never written, when:

- the payload's SHA-256 does not match `content_sha256`
- the JSON fails `ContextSchema` validation
- the target file exists and `force` is not set
- `file_name` is not a plain basename matching `^[a-z0-9][a-z0-9_-]*_context\.json$`

That last rule exists because `restore_contexts` writes to a path derived from
data held in the memory service. A `file_name` of `../../.ssh/authorized_keys`
must not be a way to write outside `CONTEXTS_PATH`, whatever put it there. The
name is validated as a basename and the resolved target is checked to still sit
inside `CONTEXTS_PATH` before anything is written.

Files are written atomically — temporary file, then rename — the same pattern
`InstinctLoader.save()` uses since PR #6, so an interrupted write cannot leave a
half-written context behind.

Bridge failures (unreachable service, auth failure) fail the whole operation with
the HTTP status, rather than being recorded per context: if the bridge is down,
every context would report the same error.

## Testing

A fake in-memory `IMemoryBridge` is introduced — none exists today, which is why
`InstinctSync` has no unit tests either. It is written so the instinct sync can
adopt it later.

- push and pull round-trip a context byte for byte, including the largest real
  context in the repository
- a re-push replaces rather than duplicates
- a payload whose SHA does not match is rejected and not written
- a payload that fails schema validation is rejected and not written
- an existing local file is left byte-identical without `force`
- with `force`, the file is replaced and a `.bak` holds the previous content
- `metadata.sync: false` is not pushed
- a context in a subdirectory of `CONTEXTS_PATH` is not pushed
- a `file_name` containing a path separator or traversal segment is rejected and
  writes nothing

## Deliberately not in scope

- **CLI commands.** Instincts have `mcp-cp`; contexts are managed through the MCP
  tools for now. Adding a CLI surface is a separate change if it turns out to be
  wanted.
- **Reading the v1.8 memories.** The old chunked `context-json,portable` entries
  use a different layout. They are left alone rather than migrated; the new
  format is written fresh.
- **Conflict merging.** A conflict is reported, not resolved. Deciding which of
  two diverged contexts is right is a human judgement, and the version string is
  a free-form field with no ordering guarantee.

## Residual risk

The metadata round-trip was measured against the local primary storage. That
Cloudflare replication carries a 23 KB metadata blob was read from the code —
`json.dumps(memory.metadata)` into a D1 column, with no length check or
truncation — but not verified end to end. If it turns out D1 truncates, the
fallback is deliberate chunking under our own `context-part:i/n` tags, which was
the original plan before the metadata measurement.
