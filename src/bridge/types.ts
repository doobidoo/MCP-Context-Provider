/**
 * Memory Bridge types — interface between Instinct Engine
 * and mcp-memory-service.
 */

// ---------------------------------------------------------------------------
// Memory Service response shapes
// ---------------------------------------------------------------------------

/** A memory as returned by the memory service API. */
export interface MemoryRecord {
  content: string;
  content_hash: string;
  tags: string[];
  memory_type: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
  created_at_iso: string;
  updated_at: number | null;
  updated_at_iso: string | null;
}

/** A search result from the memory service. */
export interface MemorySearchResult {
  memory: MemoryRecord;
  similarity_score: number;
  relevance_reason: string;
}

// ---------------------------------------------------------------------------
// Bridge configuration
// ---------------------------------------------------------------------------

export interface MemoryBridgeConfig {
  /** Base URL of the memory service HTTP API. @default "http://127.0.0.1:8001/api" */
  baseUrl: string;

  /** API key for authentication (sent as X-API-Key header). */
  apiKey?: string;

  /** Whether the bridge is enabled. @default true */
  enabled: boolean;

  /** Timeout for HTTP requests in ms. @default 5000 */
  timeout: number;

  /** Tag prefix used to identify instinct memories. @default "instinct" */
  instinctTag: string;
}

export const DEFAULT_BRIDGE_CONFIG: MemoryBridgeConfig = {
  baseUrl: 'http://127.0.0.1:8000/api',
  enabled: true,
  timeout: 5000,
  instinctTag: 'instinct',
};

// ---------------------------------------------------------------------------
// Bridge interface
// ---------------------------------------------------------------------------

/** Abstract interface for memory operations on instincts. */
export interface IMemoryBridge {
  /** Check if the memory service is reachable. */
  healthCheck(): Promise<boolean>;

  /** Store an instinct as a memory. Returns content_hash. */
  storeInstinct(instinctId: string, content: string, tags: string[], metadata: Record<string, unknown>): Promise<string>;

  /** Search for instinct-related memories by semantic query. */
  searchInstincts(query: string, limit?: number): Promise<MemorySearchResult[]>;

  /** Search for instinct memories by tags. */
  searchByTags(tags: string[], matchAll?: boolean): Promise<MemorySearchResult[]>;

  /** Delete an instinct memory by content hash. */
  deleteInstinct(contentHash: string): Promise<boolean>;

  /** Get all stored instinct memories. */
  listInstincts(page?: number, pageSize?: number): Promise<{ memories: MemoryRecord[]; total: number }>;
}
