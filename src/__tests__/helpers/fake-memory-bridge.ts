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

  async findContexts(category: string): Promise<MemorySearchResult[]> {
    return this.searchByTags([`context:${category}`], true, 'context-json');
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
