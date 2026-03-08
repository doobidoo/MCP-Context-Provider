import { describe, it, expect } from 'vitest';
import { InstinctMatcher } from '../engine/instinct-matcher.js';
import type { InstinctFile } from '../types/instinct.js';

function makeFile(overrides: Record<string, Partial<InstinctFile['instincts'][string]>> = {}): InstinctFile {
  const defaults = {
    'git-commits': {
      id: 'git-commits',
      rule: 'Use conventional commit prefixes feat fix chore docs for all commits',
      domain: 'git',
      tags: ['git', 'commits'],
      trigger_patterns: ['git commit', 'commit message', 'commit.*convention'],
      confidence: 0.85,
      min_confidence: 0.5,
      usage_count: 10,
      approved_by: 'human' as const,
      outcome_log: [],
    },
    'ts-strict': {
      id: 'ts-strict',
      rule: 'Always enable strictNullChecks in TypeScript projects for better safety',
      domain: 'typescript',
      tags: ['typescript', 'strict'],
      trigger_patterns: ['tsconfig', 'strictNullChecks', 'null.*check'],
      confidence: 0.72,
      min_confidence: 0.5,
      usage_count: 5,
      approved_by: 'human' as const,
      outcome_log: [],
    },
    'low-confidence': {
      id: 'low-confidence',
      rule: 'This instinct has low confidence and should not match by default rules',
      domain: 'misc',
      tags: ['misc'],
      trigger_patterns: ['anything'],
      confidence: 0.3,
      min_confidence: 0.5,
      usage_count: 1,
      approved_by: 'auto' as const,
      outcome_log: [],
    },
    'inactive-rule': {
      id: 'inactive-rule',
      rule: 'This instinct is deactivated and should never match any input query',
      domain: 'misc',
      tags: ['misc'],
      trigger_patterns: ['always'],
      confidence: 0.9,
      min_confidence: 0.5,
      usage_count: 0,
      approved_by: 'human' as const,
      active: false,
      outcome_log: [],
    },
  };

  const instincts: Record<string, InstinctFile['instincts'][string]> = {};
  for (const [key, val] of Object.entries(defaults)) {
    instincts[key] = { ...val, ...overrides[key] } as InstinctFile['instincts'][string];
  }

  return { version: '1.0', instincts };
}

describe('InstinctMatcher', () => {
  const matcher = new InstinctMatcher();

  it('matches by regex trigger pattern', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'write a git commit message' });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.instinct.id).toBe('git-commits');
    expect(matches[0]!.matched_pattern).toBe('git commit');
  });

  it('matches regex patterns like commit.*convention', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'what commit conventions should I use?' });

    expect(matches.some((m) => m.instinct.id === 'git-commits')).toBe(true);
  });

  it('excludes instincts below min_confidence', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'anything goes' });

    expect(matches.some((m) => m.instinct.id === 'low-confidence')).toBe(false);
  });

  it('excludes inactive instincts', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'always match this' });

    expect(matches.some((m) => m.instinct.id === 'inactive-rule')).toBe(false);
  });

  it('filters by domain', () => {
    const file = makeFile();
    const matches = matcher.match(file, {
      input: 'git commit message and tsconfig setup',
      domains: ['typescript'],
    });

    expect(matches.every((m) => m.instinct.domain === 'typescript')).toBe(true);
  });

  it('filters by tags', () => {
    const file = makeFile();
    const matches = matcher.match(file, {
      input: 'git commit and tsconfig',
      tags: ['strict'],
    });

    expect(matches.every((m) => m.instinct.tags.includes('strict'))).toBe(true);
  });

  it('returns empty for no matches', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'completely unrelated topic about cooking' });

    expect(matches).toEqual([]);
  });

  it('sorts by relevance (confidence) descending', () => {
    const file = makeFile();
    const matches = matcher.match(file, { input: 'git commit and tsconfig strictNullChecks' });

    for (let i = 1; i < matches.length; i++) {
      expect(matches[i]!.relevance).toBeLessThanOrEqual(matches[i - 1]!.relevance);
    }
  });

  it('respects global min_confidence override', () => {
    const file = makeFile();
    const matches = matcher.match(file, {
      input: 'git commit and tsconfig',
      min_confidence: 0.8,
    });

    expect(matches.every((m) => m.instinct.confidence >= 0.8)).toBe(true);
  });
});
