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

/**
 * Default cap on serialized metadata size, in the byte count the service
 * itself computes (see `asciiEscapedByteLength` below).
 *
 * mcp-memory-service's Cloudflare tier enforces a flat 10KB metadata limit
 * (`CLOUDFLARE_MAX_METADATA_SIZE_KB` in its `config/storage.py`) on the
 * background sync from local storage to the durable tier — not on the
 * initial write. A context over that limit is accepted by the first POST,
 * stored locally, and then silently dropped before it ever reaches
 * Cloudflare. 9500 is a margin under that flat cap, not a value taken from
 * the service (the service's own 9.5KB constant belongs to a different
 * code path, its update sync, and is not what this limit is enforcing).
 */
export const DEFAULT_MAX_METADATA_BYTES = 9500;

/**
 * Byte length of `JSON.stringify(value)` under Python's `json.dumps(...,
 * ensure_ascii=True)` semantics — the encoding mcp-memory-service actually
 * measures its metadata cap against. Every code point above U+007F is
 * escaped to a `\uXXXX` sequence (6 ASCII bytes); a code point outside the
 * BMP is representable in JS only as a UTF-16 surrogate pair, and Python
 * escapes each half of that pair separately, so it costs two `\uXXXX`
 * escapes (12 bytes).
 *
 * Deliberately not `Buffer.byteLength(json, 'utf-8')`: UTF-8 encodes an em
 * dash as 3 bytes and most CJK characters as 3, where the service's
 * ASCII-escaped count is 6 for both — a metadata object that fits under the
 * limit by raw UTF-8 byte count can still be over the service's real cap
 * once escaped, which is exactly the silent-drop this check exists to catch.
 */
export function asciiEscapedByteLength(json: string): number {
  let bytes = 0;
  for (const char of json) {
    // `for...of` walks a string by code point, so a surrogate pair here is
    // one iteration and `codePointAt(0)` returns the full scalar value.
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0xffff) {
      bytes += 6;
    } else {
      bytes += 12;
    }
  }
  return bytes;
}

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

export class ContextSync {
  private readonly maxMetadataBytes: number;

  constructor(
    private readonly bridge: IMemoryBridge,
    options: { maxMetadataBytes?: number } = {},
  ) {
    this.maxMetadataBytes = options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES;
  }

  /**
   * Push contexts into the memory service, replacing any earlier copy of the
   * same category. Idempotent: a re-push leaves one memory per context.
   *
   * A context whose serialized metadata would exceed `maxMetadataBytes` is
   * refused before anything is sent — see `DEFAULT_MAX_METADATA_BYTES`. This
   * class does not chunk oversized metadata; that is a follow-up.
   */
  async pushToMemory(files: LoadedContextFile[]): Promise<ContextPushResult> {
    const result: ContextPushResult = { pushed: [], skipped: [], errors: [] };

    for (const file of files) {
      const category = file.context.tool_category;

      if (file.context.metadata.sync === false) {
        result.skipped.push({ category, reason: 'metadata.sync is false' });
        continue;
      }

      const metadata = {
        payload: file.raw,
        file_name: file.fileName,
        context_version: file.context.metadata.version,
        content_sha256: sha256(file.raw),
        synced_at: new Date().toISOString(),
      };

      // What actually goes on the wire: HttpMemoryBridge.storeContext spreads
      // `metadata` and appends `context_category` and `source` before
      // serializing (see http-bridge.ts). Both count against the service's
      // cap, so both must be present in what gets measured here — measuring
      // only the object above would undercount by those two keys.
      const wireMetadata = {
        ...metadata,
        context_category: category,
        source: 'mcp-context-provider',
      };

      const metadataBytes = asciiEscapedByteLength(JSON.stringify(wireMetadata));
      if (metadataBytes > this.maxMetadataBytes) {
        result.errors.push({
          category,
          error: `metadata is ${metadataBytes} bytes, over the ${this.maxMetadataBytes}-byte Cloudflare sync limit`,
        });
        continue;
      }

      try {
        const existing = await this.bridge.searchByTags(
          [`context:${category}`],
          true,
          CONTEXT_MARKER_TAG,
        );

        let deleteFailed = false;
        for (const match of existing) {
          const ok = await this.bridge.deleteContext(match.memory.content_hash);
          if (!ok) {
            deleteFailed = true;
            break;
          }
        }

        if (deleteFailed) {
          result.errors.push({
            category,
            error: 'failed to delete existing memory before re-push',
          });
          continue;
        }

        await this.bridge.storeContext(
          category,
          contextSummary(file.context),
          ['portable'],
          metadata,
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

  /**
   * Read every context memory. Returns payloads with their recorded file
   * name and an integrity verdict; writing them is the caller's decision.
   */
  async pullFromMemory(): Promise<PulledContext[]> {
    const pulled: PulledContext[] = [];
    const pageSize = 50;
    let page = 1;

    for (;;) {
      const { memories } = await this.bridge.listContexts(page, pageSize);
      if (memories.length === 0) break;

      for (const memory of memories) {
        const payload = memory.metadata['payload'];
        const fileName = memory.metadata['file_name'];
        if (typeof payload !== 'string' || typeof fileName !== 'string') continue;
        if (payload === '' || fileName === '') continue;

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

      if (memories.length < pageSize) break;
      page += 1;
    }

    return pulled;
  }
}
