/**
 * Unified Context + Instinct Engine.
 *
 * The Engine is the central coordinator that:
 * 1. Loads contexts (static, from JSON) and instincts (learned, from YAML)
 * 2. Matches them against tool/input queries
 * 3. Returns merged injection payloads
 */

import type { Context, ContextMatch, ContextQuery } from '../types/context.js';
import type {
  Instinct,
  InstinctFile,
  InstinctMatch,
  InstinctQuery,
} from '../types/instinct.js';
import type { IMemoryBridge, MemoryBridgeConfig } from '../bridge/types.js';
import { HttpMemoryBridge } from '../bridge/http-bridge.js';
import { InstinctSync, type SyncResult } from '../bridge/sync.js';
import { ContextLoader, type LoadResult } from './context-loader.js';
import { ContextMatcher } from './context-matcher.js';
import { InstinctLoader } from './instinct-loader.js';
import { InstinctMatcher } from './instinct-matcher.js';

// ---------------------------------------------------------------------------
// Injection Payload — what gets injected into a session
// ---------------------------------------------------------------------------

/** A single injectable rule (from either a Context or an Instinct). */
export interface InjectionRule {
  /** Where this rule came from. */
  source: 'context' | 'instinct';

  /** Identifier (tool_category for contexts, id for instincts). */
  id: string;

  /** The content to inject. For contexts: full section. For instincts: rule text. */
  content: string;

  /** Confidence level. Contexts are always 1.0. */
  confidence: number;

  /** Which pattern triggered the match. */
  matched_by: string;
}

/** Full injection payload for a session/query. */
export interface InjectionPayload {
  /** Rules from matched contexts. */
  context_rules: InjectionRule[];

  /** Rules from matched instincts. */
  instinct_rules: InjectionRule[];

  /** Total estimated token count. */
  estimated_tokens: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface EngineConfig {
  /** Path to context JSON files (contexts/ directory). */
  contextsPath: string;

  /** Path to instinct YAML files (instincts/ directory). */
  instinctsPath: string;

  /** Memory Bridge configuration. Omit to disable memory bridge. */
  memoryBridge?: Partial<MemoryBridgeConfig>;
}

export class Engine {
  private readonly contextLoader: ContextLoader;
  private readonly contextMatcher: ContextMatcher;
  private readonly instinctLoader: InstinctLoader;
  private readonly instinctMatcher: InstinctMatcher;
  private readonly memoryBridge: IMemoryBridge | null;
  private readonly instinctSync: InstinctSync | null;

  private contexts: Map<string, Context> = new Map();
  private instinctFiles: Map<string, InstinctFile> = new Map();
  private loadErrors: LoadResult['errors'] = [];
  private memoryConnected = false;

  constructor(private readonly config: EngineConfig) {
    this.contextLoader = new ContextLoader(config.contextsPath);
    this.contextMatcher = new ContextMatcher();
    this.instinctLoader = new InstinctLoader(config.instinctsPath);
    this.instinctMatcher = new InstinctMatcher();

    // Initialize memory bridge if configured
    if (config.memoryBridge) {
      this.memoryBridge = new HttpMemoryBridge(config.memoryBridge);
      this.instinctSync = new InstinctSync(this.memoryBridge);
    } else {
      this.memoryBridge = null;
      this.instinctSync = null;
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Load all contexts and instincts from disk. */
  async initialize(): Promise<{
    contextsLoaded: number;
    instinctsLoaded: number;
    errors: LoadResult['errors'];
  }> {
    // Load contexts
    const contextResult = await this.contextLoader.loadAll();
    this.contexts = contextResult.contexts;
    this.loadErrors = contextResult.errors;

    // Load instincts (try all .instincts.yaml files)
    let instinctCount = 0;
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.config.instinctsPath);
      const yamlFiles = files.filter((f) => f.endsWith('.instincts.yaml'));

      for (const file of yamlFiles) {
        try {
          const instinctFile = await this.instinctLoader.load(file);
          this.instinctFiles.set(file, instinctFile);
          instinctCount += Object.keys(instinctFile.instincts).length;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.loadErrors.push({ file, error: msg });
        }
      }
    } catch {
      // instincts directory may not exist yet — that's fine
    }

    return {
      contextsLoaded: this.contexts.size,
      instinctsLoaded: instinctCount,
      errors: this.loadErrors,
    };
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /** Match contexts for a given tool. */
  matchContexts(query: ContextQuery): ContextMatch[] {
    return this.contextMatcher.match(this.contexts, query);
  }

  /** Match instincts for a given input. */
  matchInstincts(query: InstinctQuery): InstinctMatch[] {
    const allMatches: InstinctMatch[] = [];
    for (const file of this.instinctFiles.values()) {
      allMatches.push(...this.instinctMatcher.match(file, query));
    }
    return allMatches.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Build a complete injection payload for a tool + input combination.
   * This is the main entry point for session injection.
   */
  buildInjection(tool: string, input: string): InjectionPayload {
    // 1. Match contexts (always full confidence)
    const contextMatches = this.matchContexts({ tool });
    const context_rules: InjectionRule[] = contextMatches.map((m) => ({
      source: 'context' as const,
      id: m.context.tool_category,
      content: JSON.stringify(m.context),
      confidence: 1.0,
      matched_by: m.matched_pattern,
    }));

    // 2. Match instincts (confidence-scored)
    const instinctMatches = this.matchInstincts({ input });
    const instinct_rules: InjectionRule[] = instinctMatches.map((m) => ({
      source: 'instinct' as const,
      id: m.instinct.id,
      content: m.instinct.rule,
      confidence: m.instinct.confidence,
      matched_by: m.matched_pattern,
    }));

    // 3. Estimate tokens
    const estimateTokens = (text: string) =>
      text.split(/\s+/).filter(Boolean).length;
    const estimated_tokens =
      context_rules.reduce((sum, r) => sum + estimateTokens(r.content), 0) +
      instinct_rules.reduce((sum, r) => sum + estimateTokens(r.content), 0);

    return { context_rules, instinct_rules, estimated_tokens };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Get all loaded contexts. */
  getContexts(): ReadonlyMap<string, Context> {
    return this.contexts;
  }

  /** Get a specific context by tool_category. */
  getContext(category: string): Context | undefined {
    return this.contexts.get(category);
  }

  /** Get all loaded instinct files. */
  getInstinctFiles(): ReadonlyMap<string, InstinctFile> {
    return this.instinctFiles;
  }

  /** Get all individual instincts across all files. */
  getAllInstincts(): Instinct[] {
    const all: Instinct[] = [];
    for (const file of this.instinctFiles.values()) {
      all.push(...Object.values(file.instincts));
    }
    return all;
  }

  /** Get load errors from initialization. */
  getLoadErrors(): ReadonlyArray<{ file: string; error: string }> {
    return this.loadErrors;
  }

  /** Get auto-corrections for a tool. */
  getAutoCorrections(tool: string) {
    return this.contextMatcher.getAutoCorrections(this.contexts, tool);
  }

  // -------------------------------------------------------------------------
  // Memory Bridge
  // -------------------------------------------------------------------------

  /** Check if memory bridge is connected. */
  isMemoryConnected(): boolean {
    return this.memoryConnected;
  }

  /** Connect to memory service (health check). */
  async connectMemory(): Promise<boolean> {
    if (!this.memoryBridge) return false;

    this.memoryConnected = await this.memoryBridge.healthCheck();
    return this.memoryConnected;
  }

  /** Sync all local instincts to memory service. */
  async syncToMemory(): Promise<SyncResult | null> {
    if (!this.instinctSync || !this.memoryConnected) return null;
    return this.instinctSync.pushToMemory(this.getAllInstincts());
  }

  /** Discover instincts from memory that match a semantic query. */
  async discoverInstincts(
    input: string,
    limit = 5,
  ): Promise<Array<{ id: string; rule: string; confidence: number; similarity: number }>> {
    if (!this.instinctSync || !this.memoryConnected) return [];
    return this.instinctSync.discoverRelated(input, limit);
  }

  /** Get the raw memory bridge for advanced operations. */
  getMemoryBridge(): IMemoryBridge | null {
    return this.memoryBridge;
  }
}
