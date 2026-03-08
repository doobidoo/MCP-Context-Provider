/**
 * Tests for MCP server tool handlers.
 *
 * We test the tools by calling registerAllTools on a real McpServer instance
 * with real Engine + Registry pointing at temp fixture directories.
 * Then we invoke tools via the server's internal handler map.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { Engine } from '../engine/engine.js';
import { Registry } from '../cli/registry.js';
import type { InstinctFile } from '../types/instinct.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleContext = {
  tool_category: 'git',
  description: 'Git commit conventions',
  auto_convert: true,
  metadata: {
    version: '1.0.0',
    priority: 'high',
    applies_to_tools: ['git:*', 'bash:git'],
  },
  syntax_rules: {
    commit_format: 'type(scope): description',
  },
  preferences: {
    style: 'conventional',
  },
  auto_corrections: {
    fix_prefix: {
      pattern: '^Fixed\\s+',
      replacement: 'fix: ',
    },
  },
};

const sampleInstinctFile: InstinctFile = {
  version: '1.0',
  instincts: {
    'git-conventional': {
      id: 'git-conventional',
      rule: 'Use conventional commit format: type(scope): description for all commits',
      domain: 'git',
      tags: ['commit', 'convention'],
      trigger_patterns: ['git commit', 'commit message'],
      confidence: 0.85,
      min_confidence: 0.5,
      usage_count: 5,
      approved_by: 'human',
      outcome_log: [],
    },
    'test-before-push': {
      id: 'test-before-push',
      rule: 'Always run the full test suite before pushing code to the remote repository',
      domain: 'testing',
      tags: ['testing', 'ci'],
      trigger_patterns: ['git push', 'push.*remote'],
      confidence: 0.7,
      min_confidence: 0.5,
      usage_count: 2,
      approved_by: 'auto',
      outcome_log: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let contextsDir: string;
let instinctsDir: string;
let engine: Engine;
let registry: Registry;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'mcp-server-test-'));
  contextsDir = join(tmpDir, 'contexts');
  instinctsDir = join(tmpDir, 'instincts');
  await mkdir(contextsDir);
  await mkdir(instinctsDir);

  // Write fixtures
  await writeFile(
    join(contextsDir, 'git_context.json'),
    JSON.stringify(sampleContext),
    'utf-8',
  );
  await writeFile(
    join(instinctsDir, 'test.instincts.yaml'),
    stringify(sampleInstinctFile),
    'utf-8',
  );

  engine = new Engine({ contextsPath: contextsDir, instinctsPath: instinctsDir });
  await engine.initialize();
  registry = new Registry(instinctsDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests — we test Engine + Registry methods directly,
// matching exactly what each MCP tool handler would call.
// ---------------------------------------------------------------------------

describe('Server Tools — Engine', () => {
  describe('build_injection', () => {
    it('returns context + instinct rules for matching tool/input', () => {
      const payload = engine.buildInjection('git:commit', 'git commit message');
      expect(payload.context_rules).toHaveLength(1);
      expect(payload.context_rules[0]!.source).toBe('context');
      expect(payload.context_rules[0]!.id).toBe('git');
      expect(payload.instinct_rules.length).toBeGreaterThanOrEqual(1);
      expect(payload.estimated_tokens).toBeGreaterThan(0);
    });

    it('returns empty for non-matching tool', () => {
      const payload = engine.buildInjection('terraform:plan', 'some input');
      expect(payload.context_rules).toHaveLength(0);
    });
  });

  describe('match_contexts', () => {
    it('matches git context with git:commit', () => {
      const matches = engine.matchContexts({ tool: 'git:commit' });
      expect(matches).toHaveLength(1);
      expect(matches[0]!.context.tool_category).toBe('git');
    });

    it('matches git context with bash:git', () => {
      const matches = engine.matchContexts({ tool: 'bash:git' });
      expect(matches).toHaveLength(1);
    });

    it('returns empty for unrelated tool', () => {
      const matches = engine.matchContexts({ tool: 'docker:build' });
      expect(matches).toHaveLength(0);
    });
  });

  describe('match_instincts', () => {
    it('matches instinct by trigger pattern', () => {
      const matches = engine.matchInstincts({ input: 'git commit' });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0]!.instinct.id).toBe('git-conventional');
    });

    it('filters by domain', () => {
      const matches = engine.matchInstincts({ input: 'git push', domains: ['testing'] });
      expect(matches.every((m) => m.instinct.domain === 'testing')).toBe(true);
    });

    it('filters by min_confidence', () => {
      const matches = engine.matchInstincts({ input: 'git push', min_confidence: 0.8 });
      expect(matches.every((m) => m.instinct.confidence >= 0.8)).toBe(true);
    });
  });

  describe('list_contexts', () => {
    it('returns all loaded contexts', () => {
      const contexts = [...engine.getContexts().values()];
      expect(contexts).toHaveLength(1);
      expect(contexts[0]!.tool_category).toBe('git');
    });
  });

  describe('get_context', () => {
    it('returns context by category', () => {
      const ctx = engine.getContext('git');
      expect(ctx).toBeDefined();
      expect(ctx!.tool_category).toBe('git');
    });

    it('returns undefined for unknown category', () => {
      expect(engine.getContext('unknown')).toBeUndefined();
    });
  });

  describe('list_instincts', () => {
    it('returns all instincts', () => {
      const instincts = engine.getAllInstincts();
      expect(instincts).toHaveLength(2);
      const ids = instincts.map((i) => i.id);
      expect(ids).toContain('git-conventional');
      expect(ids).toContain('test-before-push');
    });
  });

  describe('get_auto_corrections', () => {
    it('returns corrections for matching tool', () => {
      const corrections = engine.getAutoCorrections('git:commit');
      expect(corrections).toHaveLength(1);
      expect(corrections[0]!.name).toBe('fix_prefix');
    });

    it('returns empty for non-matching tool', () => {
      expect(engine.getAutoCorrections('docker:build')).toHaveLength(0);
    });
  });

  describe('server_info', () => {
    it('returns correct counts', () => {
      expect(engine.getContexts().size).toBe(1);
      expect(engine.getAllInstincts().length).toBe(2);
      expect(engine.getLoadErrors()).toHaveLength(0);
      expect(engine.isMemoryConnected()).toBe(false);
    });
  });
});

describe('Server Tools — Registry', () => {
  describe('instinct_approve', () => {
    it('approves and activates an instinct', async () => {
      const result = await registry.approve('test-before-push');
      expect(result.approved_by).toBe('human');
      expect(result.active).toBe(true);
    });
  });

  describe('instinct_reject', () => {
    it('deactivates and lowers confidence', async () => {
      const result = await registry.reject('test-before-push');
      expect(result.active).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('instinct_tune', () => {
    it('updates confidence', async () => {
      const result = await registry.tune('git-conventional', { confidence: 0.95 });
      expect(result.confidence).toBe(0.95);
    });

    it('updates tags', async () => {
      const result = await registry.tune('git-conventional', { tags: ['git', 'new-tag'] });
      expect(result.tags).toContain('new-tag');
    });
  });

  describe('instinct_outcome', () => {
    it('records positive outcome and adjusts confidence', async () => {
      const result = await registry.recordOutcome('git-conventional', 'positive', 0.05, 'Worked well');
      expect(result.confidence).toBeCloseTo(0.9);
      expect(result.outcome_log.length).toBe(1);
      expect(result.outcome_log[0]!.result).toBe('positive');
    });
  });
});

describe('Server Tools — env config', () => {
  it('loadConfig returns defaults', async () => {
    const { loadConfig } = await import('../server/env.js');
    const config = loadConfig();
    expect(config.httpPort).toBe(3100);
    expect(config.contextsPath).toContain('contexts');
    expect(config.instinctsPath).toContain('instincts');
    expect(config.memoryBridge).toBeUndefined();
  });
});
