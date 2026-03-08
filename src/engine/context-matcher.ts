/**
 * Match tools against loaded contexts.
 *
 * Unlike instincts (which are confidence-scored), contexts are
 * always injected at full confidence when their applies_to_tools
 * patterns match.
 */

import type { Context, ContextMatch, ContextQuery, StoreTrigger } from '../types/context.js';

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export class ContextMatcher {
  /**
   * Find all contexts whose applies_to_tools patterns match the query tool.
   * Returns matches sorted by priority (high → low).
   */
  match(
    contexts: Map<string, Context>,
    query: ContextQuery,
  ): ContextMatch[] {
    const minPriority = PRIORITY_ORDER[query.min_priority ?? 'low'] ?? 1;
    const matches: ContextMatch[] = [];

    for (const context of contexts.values()) {
      // Category filter
      if (
        query.categories?.length &&
        !query.categories.includes(context.tool_category)
      ) {
        continue;
      }

      // Priority filter
      const priority = context.metadata.priority ?? 'medium';
      if ((PRIORITY_ORDER[priority] ?? 2) < minPriority) continue;

      // Tool pattern matching
      const matchedPattern = this.findMatchingTool(
        context.metadata.applies_to_tools,
        query.tool,
      );
      if (!matchedPattern) continue;

      matches.push({ context, matched_pattern: matchedPattern, priority });
    }

    return matches.sort(
      (a, b) =>
        (PRIORITY_ORDER[b.priority] ?? 2) - (PRIORITY_ORDER[a.priority] ?? 2),
    );
  }

  /**
   * Get all auto-corrections that apply to a given tool.
   * Merges corrections from all matching contexts.
   */
  getAutoCorrections(
    contexts: Map<string, Context>,
    tool: string,
  ): Array<{ name: string; pattern: string; replacement: string }> {
    const matches = this.match(contexts, { tool });
    const corrections: Array<{
      name: string;
      pattern: string;
      replacement: string;
    }> = [];

    for (const { context } of matches) {
      if (!context.auto_convert || !context.auto_corrections) continue;

      for (const [name, correction] of Object.entries(
        context.auto_corrections,
      )) {
        corrections.push({
          name,
          pattern: correction.pattern,
          replacement: correction.replacement,
        });
      }
    }

    return corrections;
  }

  /**
   * Get all store triggers that apply to a given tool.
   */
  getStoreTriggers(
    contexts: Map<string, Context>,
    tool: string,
  ) {
    const matches = this.match(contexts, { tool });
    const triggers: Array<{ context: string; name: string; trigger: StoreTrigger }> = [];

    for (const { context } of matches) {
      if (!context.auto_store_triggers) continue;
      for (const [name, trigger] of Object.entries(
        context.auto_store_triggers,
      )) {
        triggers.push({ context: context.tool_category, name, trigger });
      }
    }

    return triggers;
  }

  private findMatchingTool(
    patterns: string[],
    tool: string,
  ): string | undefined {
    for (const pattern of patterns) {
      if (this.toolMatches(pattern, tool)) return pattern;
    }
    return undefined;
  }

  /**
   * Match a tool against an applies_to_tools pattern.
   *
   * Supports:
   * - Exact match: "git" matches "git"
   * - Wildcard: "*" matches everything
   * - Prefix wildcard: "git:*" matches "git:commit", "git:push"
   * - Namespace match: "bash:git" matches "bash:git"
   */
  private toolMatches(pattern: string, tool: string): boolean {
    if (pattern === '*') return true;
    if (pattern === tool) return true;

    // "git:*" pattern — match any tool starting with "git:"
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1); // "git:"
      return tool.startsWith(prefix);
    }

    // "git" matches "git:commit" (category-level match)
    if (!pattern.includes(':') && tool.startsWith(`${pattern}:`)) {
      return true;
    }

    return false;
  }
}
