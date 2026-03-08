/**
 * Instinct Sync — bidirectional YAML ↔ Memory synchronization.
 *
 * Ensures instincts exist both as local YAML files (source of truth)
 * and as memories in mcp-memory-service (cross-session retrieval).
 */

import type { Instinct } from '../types/instinct.js';
import type { IMemoryBridge } from './types.js';

// ---------------------------------------------------------------------------
// Sync result types
// ---------------------------------------------------------------------------

export interface SyncResult {
  /** Instincts pushed to memory (new or updated). */
  pushed: string[];

  /** Instincts found in memory but not in YAML (orphans). */
  orphaned: string[];

  /** Instincts that failed to sync. */
  errors: Array<{ id: string; error: string }>;

  /** Total instincts in YAML. */
  yamlCount: number;

  /** Total instinct memories in service. */
  memoryCount: number;
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

export class InstinctSync {
  constructor(private readonly bridge: IMemoryBridge) {}

  /**
   * Push all local YAML instincts to memory service.
   * Upserts: if an instinct already exists (by tag), it's updated.
   */
  async pushToMemory(instincts: Instinct[]): Promise<SyncResult> {
    const result: SyncResult = {
      pushed: [],
      orphaned: [],
      errors: [],
      yamlCount: instincts.length,
      memoryCount: 0,
    };

    for (const instinct of instincts) {
      try {
        // Check if already exists
        const existing = await this.bridge.searchByTags(
          [`instinct-id:${instinct.id}`],
          true,
        );

        // Delete old version if exists
        for (const match of existing) {
          await this.bridge.deleteInstinct(match.memory.content_hash);
        }

        // Store fresh
        const content = this.serializeInstinct(instinct);
        await this.bridge.storeInstinct(
          instinct.id,
          content,
          [instinct.domain, ...instinct.tags],
          {
            confidence: instinct.confidence,
            min_confidence: instinct.min_confidence,
            usage_count: instinct.usage_count,
            approved_by: instinct.approved_by,
            active: instinct.active ?? true,
            trigger_patterns: instinct.trigger_patterns,
          },
        );

        result.pushed.push(instinct.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ id: instinct.id, error: msg });
      }
    }

    // Check memory count
    const memList = await this.bridge.listInstincts(1, 1);
    result.memoryCount = memList.total;

    return result;
  }

  /**
   * Find instinct memories in the service that don't exist in local YAML.
   */
  async findOrphans(localIds: Set<string>): Promise<string[]> {
    const orphans: string[] = [];
    let page = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const { memories, total } = await this.bridge.listInstincts(page, pageSize);

      for (const mem of memories) {
        const idTag = mem.tags.find((t) => t.startsWith('instinct-id:'));
        if (idTag) {
          const id = idTag.replace('instinct-id:', '');
          if (!localIds.has(id)) {
            orphans.push(id);
          }
        }
      }

      hasMore = page * pageSize < total;
      page++;
    }

    return orphans;
  }

  /**
   * Search memory service for instincts semantically related to input.
   * Useful for discovering relevant instincts from other sessions.
   */
  async discoverRelated(
    input: string,
    limit = 5,
  ): Promise<Array<{ id: string; rule: string; confidence: number; similarity: number }>> {
    const results = await this.bridge.searchInstincts(input, limit);

    return results.map((r) => {
      const metadata = r.memory.metadata as Record<string, unknown>;
      const idTag = r.memory.tags.find((t) => t.startsWith('instinct-id:'));

      return {
        id: idTag?.replace('instinct-id:', '') ?? 'unknown',
        rule: r.memory.content,
        confidence: (metadata.confidence as number) ?? 0,
        similarity: r.similarity_score,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Serialize an instinct into a compact string for memory storage.
   * The rule text is the primary content; metadata goes in the metadata field.
   */
  private serializeInstinct(instinct: Instinct): string {
    return [
      `[${instinct.id}] (${instinct.domain})`,
      instinct.rule,
      `triggers: ${instinct.trigger_patterns.join(', ')}`,
    ].join('\n');
  }
}
