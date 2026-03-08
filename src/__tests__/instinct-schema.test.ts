import { describe, it, expect } from 'vitest';
import { InstinctSchema, InstinctFileSchema, InstinctCandidateSchema } from '../schema/instinct.schema.js';

describe('InstinctSchema', () => {
  const validInstinct = {
    id: 'git-conventional-commits',
    rule: 'Use conventional commit prefixes feat fix chore docs refactor test ci for all commit messages',
    domain: 'git',
    tags: ['git', 'commits'],
    trigger_patterns: ['git commit', 'commit message'],
    confidence: 0.85,
    min_confidence: 0.5,
    usage_count: 12,
    approved_by: 'human' as const,
    outcome_log: [],
  };

  it('accepts a valid instinct', () => {
    const result = InstinctSchema.safeParse(validInstinct);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const minimal = {
      id: 'test-rule',
      rule: 'Always run tests before committing code to the repository branch',
      domain: 'testing',
      tags: ['test'],
      trigger_patterns: ['test'],
      confidence: 0.7,
      approved_by: 'human' as const,
    };

    const result = InstinctSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_confidence).toBe(0.5);
      expect(result.data.usage_count).toBe(0);
      expect(result.data.outcome_log).toEqual([]);
      expect(result.data.active).toBe(true);
    }
  });

  it('rejects invalid id format (must be kebab-case)', () => {
    const bad = { ...validInstinct, id: 'NotKebab' };
    const result = InstinctSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects single-char id', () => {
    const bad = { ...validInstinct, id: 'x' };
    const result = InstinctSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside 0-1 range', () => {
    const tooHigh = { ...validInstinct, confidence: 1.5 };
    expect(InstinctSchema.safeParse(tooHigh).success).toBe(false);

    const tooLow = { ...validInstinct, confidence: -0.1 };
    expect(InstinctSchema.safeParse(tooLow).success).toBe(false);
  });

  it('rejects rule that is too short (< 5 tokens)', () => {
    const bad = { ...validInstinct, rule: 'Use tabs' };
    const result = InstinctSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty tags array', () => {
    const bad = { ...validInstinct, tags: [] };
    expect(InstinctSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty trigger_patterns array', () => {
    const bad = { ...validInstinct, trigger_patterns: [] };
    expect(InstinctSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects min_confidence exceeding confidence', () => {
    const bad = { ...validInstinct, confidence: 0.3, min_confidence: 0.8 };
    const result = InstinctSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts valid outcome_log entries', () => {
    const withOutcomes = {
      ...validInstinct,
      outcome_log: [
        {
          timestamp: '2026-03-07T18:30:00Z',
          result: 'positive' as const,
          delta_confidence: 0.05,
          note: 'Worked well',
        },
        {
          timestamp: '2026-03-07T19:00:00Z',
          result: 'negative' as const,
          delta_confidence: -0.1,
        },
      ],
    };
    expect(InstinctSchema.safeParse(withOutcomes).success).toBe(true);
  });

  it('rejects invalid approved_by value', () => {
    const bad = { ...validInstinct, approved_by: 'bot' };
    expect(InstinctSchema.safeParse(bad).success).toBe(false);
  });
});

describe('InstinctFileSchema', () => {
  it('accepts a valid instinct file', () => {
    const file = {
      version: '1.0',
      instincts: {
        'test-rule': {
          id: 'test-rule',
          rule: 'Always run tests before committing code to the repository branch',
          domain: 'testing',
          tags: ['test'],
          trigger_patterns: ['test'],
          confidence: 0.7,
          min_confidence: 0.5,
          usage_count: 0,
          approved_by: 'human' as const,
          outcome_log: [],
        },
      },
    };
    expect(InstinctFileSchema.safeParse(file).success).toBe(true);
  });

  it('rejects wrong version', () => {
    const bad = { version: '2.0', instincts: {} };
    expect(InstinctFileSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts empty instincts map', () => {
    const empty = { version: '1.0', instincts: {} };
    expect(InstinctFileSchema.safeParse(empty).success).toBe(true);
  });
});

describe('InstinctCandidateSchema', () => {
  it('accepts a valid candidate', () => {
    const candidate = {
      suggested_id: 'use-vitest',
      rule: 'Prefer vitest over jest for TypeScript projects with ESM module support needed',
      domain: 'testing',
      tags: ['testing', 'vitest'],
      trigger_patterns: ['test.*setup', 'vitest'],
      initial_confidence: 0.7,
      rationale: 'User corrected test framework choice twice',
    };
    expect(InstinctCandidateSchema.safeParse(candidate).success).toBe(true);
  });
});
