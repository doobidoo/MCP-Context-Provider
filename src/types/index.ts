/**
 * Public type exports for mcp-context-provider v2.x
 */

// Instinct types
export type {
  OutcomeEntry,
  ApprovalSource,
  Instinct,
  InstinctFile,
  InstinctCandidate,
  InstinctQuery,
  InstinctMatch,
} from './instinct.js';

// Context types
export type {
  StoreTrigger,
  RetrieveTrigger,
  AutoCorrection,
  StartupAction,
  SessionInitialization,
  ContextMetadata,
  Context,
  ContextQuery,
  ContextMatch,
} from './context.js';
