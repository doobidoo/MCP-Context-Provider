/**
 * mcp-context-provider v2.x — Instinct Engine Types
 *
 * An Instinct is a compact, learned rule (20–80 tokens) distilled from
 * sessions. Unlike static Contexts, Instincts are confidence-scored,
 * human-approved, and evolve over time via outcome tracking.
 */

// ---------------------------------------------------------------------------
// Outcome Log — tracks how an instinct performs over time
// ---------------------------------------------------------------------------

/** A single outcome entry recording the result of an instinct firing. */
export interface OutcomeEntry {
  /** ISO-8601 timestamp of when the outcome was recorded. */
  timestamp: string;

  /** What happened: positive, negative, or neutral. */
  result: 'positive' | 'negative' | 'neutral';

  /** Change in confidence caused by this outcome (e.g. +0.05, -0.10). */
  delta_confidence: number;

  /**
   * Optional free-text note from the user or system explaining
   * why this outcome occurred.
   */
  note?: string;

  /** Session ID or conversation ID where this outcome was observed. */
  session_id?: string;
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/** Who approved this instinct and how. */
export type ApprovalSource = 'human' | 'auto';

// ---------------------------------------------------------------------------
// Instinct — the core type
// ---------------------------------------------------------------------------

/** A single learned instinct as stored in YAML. */
export interface Instinct {
  /** Unique identifier, e.g. "git-conventional-commits". */
  id: string;

  /**
   * The actual rule content. Must be compact: 20–80 tokens.
   * Example: "Always use conventional commit prefixes: feat, fix, chore, docs."
   */
  rule: string;

  /** Knowledge domain, e.g. "git", "typescript", "docker", "testing". */
  domain: string;

  /** Tags for matching and categorization. */
  tags: string[];

  /**
   * Regex patterns that, when matched in user input or context,
   * trigger injection of this instinct.
   */
  trigger_patterns: string[];

  /**
   * Current confidence score (0.0–1.0).
   * Updated by outcome_log entries.
   */
  confidence: number;

  /**
   * Minimum confidence required for this instinct to be injected.
   * Below this threshold the instinct is dormant.
   * @default 0.5
   */
  min_confidence: number;

  /** Number of times this instinct has been injected into a session. */
  usage_count: number;

  /** Who approved this instinct for use. */
  approved_by: ApprovalSource;

  /**
   * Chronological log of outcomes, newest last.
   * Each entry adjusts confidence via delta_confidence.
   */
  outcome_log: OutcomeEntry[];

  // --- optional metadata ---

  /** ISO-8601 timestamp of when this instinct was first created. */
  created_at?: string;

  /** ISO-8601 timestamp of the last modification. */
  updated_at?: string;

  /** Session or conversation ID where this instinct was originally distilled. */
  source_session?: string;

  /** Whether this instinct is currently active. Dormant instincts are never injected. */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Instinct File — top-level YAML structure
// ---------------------------------------------------------------------------

/** The top-level structure of an instincts YAML file. */
export interface InstinctFile {
  /** Schema version for forward compatibility. */
  version: '1.0';

  /** Map of instinct ID → Instinct definition. */
  instincts: Record<string, Instinct>;
}

// ---------------------------------------------------------------------------
// Instinct Candidate — pre-approval extraction from /instill
// ---------------------------------------------------------------------------

/** A candidate instinct proposed by the /instill command before approval. */
export interface InstinctCandidate {
  /** Suggested ID (can be changed during approval). */
  suggested_id: string;

  /** The distilled rule text. */
  rule: string;

  /** Suggested domain. */
  domain: string;

  /** Suggested tags. */
  tags: string[];

  /** Suggested trigger patterns. */
  trigger_patterns: string[];

  /** Initial confidence suggested by the extraction model. */
  initial_confidence: number;

  /** Rationale from the model explaining why this was extracted. */
  rationale: string;

  /** Source material / session excerpt that led to this candidate. */
  source_excerpt?: string;
}

// ---------------------------------------------------------------------------
// Instinct Query — for the engine to find matching instincts
// ---------------------------------------------------------------------------

/** Parameters for querying instincts that match a given context. */
export interface InstinctQuery {
  /** Text to match against trigger_patterns. */
  input: string;

  /** Optional: only match instincts in these domains. */
  domains?: string[];

  /** Optional: only match instincts with any of these tags. */
  tags?: string[];

  /** Override the per-instinct min_confidence with a global threshold. */
  min_confidence?: number;
}

/** Result of an instinct query. */
export interface InstinctMatch {
  /** The matched instinct. */
  instinct: Instinct;

  /** Which trigger_pattern matched. */
  matched_pattern: string;

  /** Relevance score (combines confidence + pattern match quality). */
  relevance: number;
}
