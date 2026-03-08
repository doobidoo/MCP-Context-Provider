import { describe, it, expect } from 'vitest';
import { ContextMatcher } from '../engine/context-matcher.js';
import type { Context } from '../types/context.js';

function makeContexts(): Map<string, Context> {
  const map = new Map<string, Context>();

  map.set('git', {
    tool_category: 'git',
    description: 'Git-specific context rules',
    auto_convert: true,
    metadata: {
      version: '1.0.0',
      applies_to_tools: ['git:*', 'bash:git'],
      priority: 'high',
    },
    auto_corrections: {
      fix_prefix: { pattern: '^Fix\\s', replacement: 'fix: ' },
    },
  } as Context);

  map.set('general', {
    tool_category: 'general',
    description: 'General preferences',
    auto_convert: false,
    metadata: {
      version: '1.0.0',
      applies_to_tools: ['*'],
      priority: 'low',
      inheritance: 'fallback_for_unspecified_tools' as const,
    },
  } as Context);

  map.set('memory', {
    tool_category: 'memory',
    description: 'Memory service rules',
    auto_convert: false,
    metadata: {
      version: '1.0.0',
      applies_to_tools: ['memory', 'mcp-memory'],
      priority: 'high',
    },
  } as Context);

  map.set('docker', {
    tool_category: 'docker',
    description: 'Docker rules',
    auto_convert: false,
    metadata: {
      version: '1.0.0',
      applies_to_tools: ['docker:*'],
      priority: 'medium',
    },
  } as Context);

  return map;
}

describe('ContextMatcher', () => {
  const matcher = new ContextMatcher();

  it('matches wildcard (*) pattern', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, { tool: 'random-tool' });

    expect(matches.some((m) => m.context.tool_category === 'general')).toBe(true);
  });

  it('matches prefix wildcard (git:*)', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, { tool: 'git:commit' });

    expect(matches.some((m) => m.context.tool_category === 'git')).toBe(true);
  });

  it('matches exact tool name (bash:git)', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, { tool: 'bash:git' });

    expect(matches.some((m) => m.context.tool_category === 'git')).toBe(true);
  });

  it('matches category-level (memory matches memory:search)', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, { tool: 'memory:search' });

    expect(matches.some((m) => m.context.tool_category === 'memory')).toBe(true);
  });

  it('sorts by priority (high before low)', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, { tool: 'git:commit' });

    const gitIdx = matches.findIndex((m) => m.context.tool_category === 'git');
    const genIdx = matches.findIndex((m) => m.context.tool_category === 'general');

    expect(gitIdx).toBeLessThan(genIdx);
  });

  it('filters by min_priority', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, {
      tool: 'git:commit',
      min_priority: 'high',
    });

    expect(matches.every((m) => m.priority === 'high')).toBe(true);
    expect(matches.some((m) => m.context.tool_category === 'general')).toBe(false);
  });

  it('filters by categories', () => {
    const contexts = makeContexts();
    const matches = matcher.match(contexts, {
      tool: 'git:commit',
      categories: ['git'],
    });

    expect(matches.every((m) => m.context.tool_category === 'git')).toBe(true);
  });

  it('returns auto-corrections for matching tool', () => {
    const contexts = makeContexts();
    const corrections = matcher.getAutoCorrections(contexts, 'git:commit');

    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections[0]!.name).toBe('fix_prefix');
  });

  it('skips auto-corrections when auto_convert is false', () => {
    const contexts = makeContexts();
    const corrections = matcher.getAutoCorrections(contexts, 'memory:store');

    // Memory context has auto_convert: false, general has no corrections
    const memoryCorrections = corrections.filter((c) => c.name.includes('memory'));
    expect(memoryCorrections).toEqual([]);
  });
});
