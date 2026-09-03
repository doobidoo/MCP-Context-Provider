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
