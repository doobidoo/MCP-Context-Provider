/**
 * mcp-context-provider v2.x — Context Engine Types
 *
 * A Context is a static, manually-authored rule set (200–1000 tokens)
 * that is always injected at full confidence when its tool_category
 * or applies_to_tools patterns match.
 *
 * Migrated from v1.8.x JSON schema.
 */

// ---------------------------------------------------------------------------
// Triggers — pattern-based automation
// ---------------------------------------------------------------------------

/** An auto-store trigger that captures patterns and stores to memory. */
export interface StoreTrigger {
  /** Regex or literal patterns to match against user input. */
  patterns: string[];

  /** Action to take: "store_memory", "store_with_metadata", etc. */
  action: string;

  /** Tags to apply to the stored memory. Supports {template} placeholders. */
  tags: string[];

  /** Priority for this trigger: "high", "medium", "low". */
  priority?: 'high' | 'medium' | 'low';

  /** Minimum confidence to fire this trigger (0.0–1.0). */
  confidence_threshold?: number;
}

/** An auto-retrieve trigger that fetches memories based on patterns. */
export interface RetrieveTrigger {
  /** Regex or literal patterns to match. */
  patterns: string[];

  /** Action to take: "recall_memory", "search_by_tag", "search_and_suggest", etc. */
  action: string;

  /** Tags to search for in memory. */
  search_tags?: string[];

  /** Additional tags to filter results. */
  additional_tags?: string[];

  /** Minimum confidence to fire (0.0–1.0). */
  confidence_threshold?: number;

  /** Extract timeframe from the matched input. */
  extract_timeframe?: boolean;

  /** Use surrounding conversation as additional search context. */
  use_context?: boolean;
}

// ---------------------------------------------------------------------------
// Auto-corrections
// ---------------------------------------------------------------------------

/** A regex-based auto-correction rule. */
export interface AutoCorrection {
  /** Regex pattern to match. */
  pattern: string;

  /** Replacement string (supports capture group refs: $1, $2). */
  replacement: string;
}

// ---------------------------------------------------------------------------
// Session Initialization
// ---------------------------------------------------------------------------

/** A single startup action. */
export interface StartupAction {
  /** Action identifier: "recall_memory", "search_by_tag", "search_memory", "notify". */
  action: string;

  /** Parameters to pass to the action. */
  parameters?: Record<string, unknown>;

  /** Human-readable description of what this action does. */
  description?: string;

  /** Store the result under this key for later reference. */
  store_as?: string;

  /** Message to display (for "notify" actions). */
  message?: string;
}

/** Session initialization configuration. */
export interface SessionInitialization {
  /** Whether session init is enabled. */
  enabled: boolean;

  /** Actions to execute. */
  actions: {
    on_startup: StartupAction[];
    greeting_format?: string;
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/** Context metadata for versioning and tool matching. */
export interface ContextMetadata {
  /** Schema version of this context file. */
  version: string;

  /** ISO-8601 timestamp of last update. */
  last_updated?: string;

  /**
   * Which tools this context applies to.
   * Supports glob-like patterns: "git:*", "bash:git", "*" (all tools).
   */
  applies_to_tools: string[];

  /** Injection priority: "high" > "medium" > "low". */
  priority?: 'high' | 'medium' | 'low';

  /** Inheritance strategy. */
  inheritance?: 'fallback_for_unspecified_tools' | 'override' | 'merge';

  /** Author identifier. */
  author?: string;
}

// ---------------------------------------------------------------------------
// Context — the core type
// ---------------------------------------------------------------------------

/**
 * A single context definition.
 *
 * The structural fields (tool_category, metadata, triggers) are strongly typed.
 * Domain-specific sections (syntax_rules, preferences, workflow_patterns, etc.)
 * remain flexible via Record<string, unknown> — they vary per tool_category
 * and are opaque to the engine.
 */
export interface Context {
  /** Primary tool category identifier, e.g. "git", "memory", "docker". */
  tool_category: string;

  /** Human-readable description. */
  description: string;

  /** Whether to auto-apply corrections from auto_corrections rules. */
  auto_convert: boolean;

  /** Context metadata for matching and versioning. */
  metadata: ContextMetadata;

  // --- Triggers (optional) ---

  /** Pattern-based auto-store triggers for memory. */
  auto_store_triggers?: Record<string, StoreTrigger>;

  /** Pattern-based auto-retrieve triggers from memory. */
  auto_retrieve_triggers?: Record<string, RetrieveTrigger>;

  /** Regex-based text auto-corrections. */
  auto_corrections?: Record<string, AutoCorrection>;

  /** Session initialization configuration. */
  session_initialization?: SessionInitialization;

  // --- Domain-specific content (opaque to engine) ---

  /** Tool-specific syntax rules (format varies by domain). */
  syntax_rules?: Record<string, unknown>;

  /** Tool-specific preferences. */
  preferences?: Record<string, unknown>;

  /** Workflow patterns and templates. */
  workflow_patterns?: Record<string, unknown>;

  /** Best practices and guidelines. */
  best_practices?: Record<string, unknown>;

  /** Hook configurations (pre-commit, etc.). */
  hooks?: Record<string, unknown>;

  /** Common command shortcuts. */
  common_commands?: Record<string, string>;

  /**
   * Any additional domain-specific sections.
   * v1.8.x contexts use many different section names (global_preferences,
   * code_style, security, naming_conventions, etc.) — these are captured
   * via the index signature.
   */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Context Query — for the engine to find matching contexts
// ---------------------------------------------------------------------------

/** Parameters for querying which contexts apply to a given tool. */
export interface ContextQuery {
  /** The tool being used, e.g. "bash:git", "memory", "docker". */
  tool: string;

  /** Optional: only return contexts with these categories. */
  categories?: string[];

  /** Optional: only return contexts with this priority or higher. */
  min_priority?: 'high' | 'medium' | 'low';
}

/** Result of a context query. */
export interface ContextMatch {
  /** The matched context. */
  context: Context;

  /** Which applies_to_tools pattern matched. */
  matched_pattern: string;

  /** Effective priority (for ordering when multiple contexts match). */
  priority: 'high' | 'medium' | 'low';
}
