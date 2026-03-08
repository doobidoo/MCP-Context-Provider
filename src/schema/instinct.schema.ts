/**
 * Zod validation schema for Instinct YAML files.
 *
 * Validates structure, value ranges, and token-length constraints
 * when loading instincts from disk.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Outcome Entry
// ---------------------------------------------------------------------------

export const OutcomeEntrySchema = z.object({
  timestamp: z.string().datetime({ message: 'Must be ISO-8601 datetime' }),
  result: z.enum(['positive', 'negative', 'neutral']),
  delta_confidence: z
    .number()
    .min(-1)
    .max(1, 'delta_confidence must be between -1.0 and 1.0'),
  note: z.string().optional(),
  session_id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Single Instinct
// ---------------------------------------------------------------------------

/**
 * Rough token estimate: split by whitespace.
 * Real tokenization would use tiktoken, but for a fast gate check this suffices.
 */
function estimateTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const InstinctSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
        'id must be kebab-case (lowercase, hyphens, no leading/trailing hyphen)',
      ),

    rule: z.string().min(1),

    domain: z.string().min(1),

    tags: z.array(z.string().min(1)).min(1, 'At least one tag required'),

    trigger_patterns: z
      .array(z.string().min(1))
      .min(1, 'At least one trigger pattern required'),

    confidence: z
      .number()
      .min(0)
      .max(1, 'confidence must be between 0.0 and 1.0'),

    min_confidence: z
      .number()
      .min(0)
      .max(1, 'min_confidence must be between 0.0 and 1.0')
      .default(0.5),

    usage_count: z.number().int().nonnegative().default(0),

    approved_by: z.enum(['human', 'auto']),

    outcome_log: z.array(OutcomeEntrySchema).default([]),

    // optional metadata
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    source_session: z.string().optional(),
    active: z.boolean().default(true),
  })
  .refine(
    (inst) => {
      const tokens = estimateTokens(inst.rule);
      return tokens >= 5 && tokens <= 120;
    },
    {
      message: 'rule should be 5–120 tokens (target: 20–80)',
      path: ['rule'],
    },
  )
  .refine((inst) => inst.min_confidence <= inst.confidence, {
    message: 'min_confidence should not exceed current confidence',
    path: ['min_confidence'],
  });

// ---------------------------------------------------------------------------
// Instinct File (top-level YAML)
// ---------------------------------------------------------------------------

export const InstinctFileSchema = z.object({
  version: z.literal('1.0'),
  instincts: z.record(z.string(), InstinctSchema),
});

// ---------------------------------------------------------------------------
// Instinct Candidate (from /instill extraction)
// ---------------------------------------------------------------------------

export const InstinctCandidateSchema = z.object({
  suggested_id: z.string().min(1),
  rule: z.string().min(1),
  domain: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  trigger_patterns: z.array(z.string().min(1)).min(1),
  initial_confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  source_excerpt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types from schemas (use these if you prefer schema-first)
// ---------------------------------------------------------------------------

export type OutcomeEntryZ = z.infer<typeof OutcomeEntrySchema>;
export type InstinctZ = z.infer<typeof InstinctSchema>;
export type InstinctFileZ = z.infer<typeof InstinctFileSchema>;
export type InstinctCandidateZ = z.infer<typeof InstinctCandidateSchema>;
