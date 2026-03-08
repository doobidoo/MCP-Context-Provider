/**
 * mcp-context-provider v2.x
 *
 * Context & Instinct Engine for Claude Code.
 */

// Types
export * from './types/index.js';

// Schemas — Instinct (Zod)
export {
  OutcomeEntrySchema,
  InstinctSchema,
  InstinctFileSchema,
  InstinctCandidateSchema,
} from './schema/instinct.schema.js';

// Schemas — Context (Zod)
export {
  ContextSchema,
  ContextMetadataSchema,
  StoreTriggerSchema,
  RetrieveTriggerSchema,
  AutoCorrectionSchema,
  SessionInitializationSchema,
} from './schema/context.schema.js';

// Engine
export { Engine, type EngineConfig, type InjectionPayload, type InjectionRule } from './engine/engine.js';
export { ContextLoader } from './engine/context-loader.js';
export { ContextMatcher } from './engine/context-matcher.js';
export { InstinctLoader } from './engine/instinct-loader.js';
export { InstinctMatcher } from './engine/instinct-matcher.js';

// Memory Bridge
export { HttpMemoryBridge } from './bridge/http-bridge.js';
export { InstinctSync, type SyncResult } from './bridge/sync.js';
export type { IMemoryBridge, MemoryBridgeConfig, MemoryRecord, MemorySearchResult } from './bridge/types.js';
export { DEFAULT_BRIDGE_CONFIG } from './bridge/types.js';
