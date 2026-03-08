/**
 * Zod validation schema for Context JSON files.
 *
 * Validates structural fields strictly while allowing
 * domain-specific sections to pass through.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

const PrioritySchema = z.enum(['high', 'medium', 'low']);

export const StoreTriggerSchema = z.object({
  patterns: z.array(z.string().min(1)).min(1),
  action: z.string().min(1),
  tags: z.array(z.string().min(1)),
  priority: PrioritySchema.optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
});

export const RetrieveTriggerSchema = z.object({
  patterns: z.array(z.string().min(1)).min(1),
  action: z.string().min(1),
  search_tags: z.array(z.string()).optional(),
  additional_tags: z.array(z.string()).optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  extract_timeframe: z.boolean().optional(),
  use_context: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Auto-corrections
// ---------------------------------------------------------------------------

export const AutoCorrectionSchema = z.object({
  pattern: z.string().min(1),
  replacement: z.string(),
});

// ---------------------------------------------------------------------------
// Session Initialization
// ---------------------------------------------------------------------------

export const StartupActionSchema = z.object({
  action: z.string().min(1),
  parameters: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  store_as: z.string().optional(),
  message: z.string().optional(),
});

export const SessionInitializationSchema = z.object({
  enabled: z.boolean(),
  actions: z.object({
    on_startup: z.array(StartupActionSchema),
    greeting_format: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const ContextMetadataSchema = z.object({
  version: z.string().min(1),
  last_updated: z.string().optional(),
  applies_to_tools: z.array(z.string().min(1)).min(1),
  priority: PrioritySchema.optional(),
  inheritance: z
    .enum(['fallback_for_unspecified_tools', 'override', 'merge'])
    .optional(),
  author: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Context (top-level)
// ---------------------------------------------------------------------------

/**
 * The Context schema validates structural fields strictly.
 * Domain-specific sections (syntax_rules, preferences, etc.) are
 * allowed through via passthrough() — they remain as-is without
 * validation since their shape varies per tool_category.
 */
export const ContextSchema = z
  .object({
    tool_category: z.string().min(1),
    description: z.string().min(1),
    auto_convert: z.boolean().default(false),
    metadata: ContextMetadataSchema,

    // Triggers (optional)
    auto_store_triggers: z.record(StoreTriggerSchema).optional(),
    auto_retrieve_triggers: z.record(RetrieveTriggerSchema).optional(),
    auto_corrections: z.record(AutoCorrectionSchema).optional(),
    session_initialization: SessionInitializationSchema.optional(),

    // Domain-specific sections validated loosely
    syntax_rules: z.record(z.unknown()).optional(),
    preferences: z.record(z.unknown()).optional(),
    workflow_patterns: z.record(z.unknown()).optional(),
    best_practices: z.record(z.unknown()).optional(),
    hooks: z.record(z.unknown()).optional(),
    common_commands: z.record(z.string()).optional(),
  })
  .passthrough(); // Allow additional domain-specific keys

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ContextZ = z.infer<typeof ContextSchema>;
export type ContextMetadataZ = z.infer<typeof ContextMetadataSchema>;
export type StoreTriggerZ = z.infer<typeof StoreTriggerSchema>;
export type RetrieveTriggerZ = z.infer<typeof RetrieveTriggerSchema>;
