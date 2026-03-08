/**
 * HTTP-based Memory Bridge implementation.
 *
 * Connects to mcp-memory-service via its REST API.
 * Uses Node.js built-in fetch() — no extra dependencies.
 */

import type {
  IMemoryBridge,
  MemoryBridgeConfig,
  MemoryRecord,
  MemorySearchResult,
} from './types.js';
import { DEFAULT_BRIDGE_CONFIG } from './types.js';

export class HttpMemoryBridge implements IMemoryBridge {
  private readonly config: MemoryBridgeConfig;

  constructor(config?: Partial<MemoryBridgeConfig>) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const res = await this.fetch('/health');
      return res.ok;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------

  async storeInstinct(
    instinctId: string,
    content: string,
    tags: string[],
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const allTags = this.instinctTags(instinctId, tags);

    const body = {
      content,
      tags: allTags,
      memory_type: 'instinct',
      metadata: {
        ...metadata,
        instinct_id: instinctId,
        source: 'mcp-context-provider',
      },
    };

    const res = await this.fetch('/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to store instinct: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { content_hash: string };
    return data.content_hash;
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async searchInstincts(
    query: string,
    limit = 10,
  ): Promise<MemorySearchResult[]> {
    const res = await this.fetch('/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        n_results: limit,
        similarity_threshold: 0.3,
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results: MemorySearchResult[] };

    // Filter to only instinct memories
    return data.results.filter((r) =>
      r.memory.tags.includes(this.config.instinctTag),
    );
  }

  async searchByTags(
    tags: string[],
    matchAll = false,
  ): Promise<MemorySearchResult[]> {
    const allTags = [this.config.instinctTag, ...tags];

    const res = await this.fetch('/search/by-tag', {
      method: 'POST',
      body: JSON.stringify({
        tags: allTags,
        match_all: matchAll,
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results: MemorySearchResult[] };
    return data.results;
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async deleteInstinct(contentHash: string): Promise<boolean> {
    const res = await this.fetch(`/memories/${contentHash}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  async listInstincts(
    page = 1,
    pageSize = 50,
  ): Promise<{ memories: MemoryRecord[]; total: number }> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      tag: this.config.instinctTag,
    });

    const res = await this.fetch(`/memories?${params.toString()}`);

    if (!res.ok) return { memories: [], total: 0 };

    const data = (await res.json()) as {
      memories: MemoryRecord[];
      total: number;
    };
    return data;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /** Build the standard tag set for an instinct memory. */
  private instinctTags(instinctId: string, extraTags: string[]): string[] {
    return [
      this.config.instinctTag,
      `instinct-id:${instinctId}`,
      ...extraTags,
    ];
  }

  /** Fetch wrapper with auth headers and timeout. */
  private async fetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    return fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    });
  }
}
