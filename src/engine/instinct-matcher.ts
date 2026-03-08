/**
 * Match user input against loaded instincts.
 */

import type {
  Instinct,
  InstinctFile,
  InstinctMatch,
  InstinctQuery,
} from '../types/instinct.js';

export class InstinctMatcher {
  /**
   * Find all instincts whose trigger_patterns match the query input.
   * Returns matches sorted by relevance (confidence * pattern specificity).
   */
  match(file: InstinctFile, query: InstinctQuery): InstinctMatch[] {
    const threshold = query.min_confidence ?? 0;
    const matches: InstinctMatch[] = [];

    for (const instinct of Object.values(file.instincts)) {
      if (!this.isEligible(instinct, query, threshold)) continue;

      const matchedPattern = this.findMatchingPattern(
        instinct.trigger_patterns,
        query.input,
      );
      if (!matchedPattern) continue;

      matches.push({
        instinct,
        matched_pattern: matchedPattern,
        relevance: instinct.confidence,
      });
    }

    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  private isEligible(
    instinct: Instinct,
    query: InstinctQuery,
    threshold: number,
  ): boolean {
    // Must be active
    if (instinct.active === false) return false;

    // Must meet confidence threshold
    const effectiveMin = Math.max(instinct.min_confidence, threshold);
    if (instinct.confidence < effectiveMin) return false;

    // Domain filter
    if (query.domains?.length && !query.domains.includes(instinct.domain)) {
      return false;
    }

    // Tag filter
    if (
      query.tags?.length &&
      !query.tags.some((t) => instinct.tags.includes(t))
    ) {
      return false;
    }

    return true;
  }

  private findMatchingPattern(
    patterns: string[],
    input: string,
  ): string | undefined {
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(input)) return pattern;
      } catch {
        // Invalid regex — treat as literal substring match
        if (input.toLowerCase().includes(pattern.toLowerCase())) {
          return pattern;
        }
      }
    }
    return undefined;
  }
}
