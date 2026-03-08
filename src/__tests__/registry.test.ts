import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { Registry } from '../cli/registry.js';
import type { InstinctFile } from '../types/instinct.js';

let tmpDir: string;
let registry: Registry;

const sampleFile: InstinctFile = {
  version: '1.0',
  instincts: {
    'test-rule': {
      id: 'test-rule',
      rule: 'Always run tests before committing code to the repository for safety',
      domain: 'testing',
      tags: ['testing', 'ci'],
      trigger_patterns: ['test', 'vitest', 'jest'],
      confidence: 0.7,
      min_confidence: 0.5,
      usage_count: 3,
      approved_by: 'auto',
      outcome_log: [],
    },
    'docker-multi': {
      id: 'docker-multi',
      rule: 'Use multi-stage Docker builds to keep images small and secure always',
      domain: 'docker',
      tags: ['docker', 'optimization'],
      trigger_patterns: ['Dockerfile', 'docker.*build'],
      confidence: 0.6,
      min_confidence: 0.5,
      usage_count: 1,
      approved_by: 'auto',
      outcome_log: [],
    },
  },
};

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'mcp-cp-test-'));
  await writeFile(
    join(tmpDir, 'test.instincts.yaml'),
    stringify(sampleFile),
    'utf-8',
  );
  registry = new Registry(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('Registry', () => {
  describe('listAll', () => {
    it('lists all instincts from YAML files', async () => {
      const entries = await registry.listAll();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.instinct.id).sort()).toEqual(['docker-multi', 'test-rule']);
    });

    it('returns empty for non-existent directory', async () => {
      const empty = new Registry('/nonexistent/path');
      const entries = await empty.listAll();
      expect(entries).toEqual([]);
    });
  });

  describe('find', () => {
    it('finds an instinct by id', async () => {
      const result = await registry.find('test-rule');
      expect(result).not.toBeNull();
      expect(result!.instinct.id).toBe('test-rule');
    });

    it('returns null for non-existent id', async () => {
      const result = await registry.find('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('approve', () => {
    it('sets approved_by to human and activates', async () => {
      const inst = await registry.approve('test-rule');
      expect(inst.approved_by).toBe('human');
      expect(inst.active).toBe(true);
      expect(inst.updated_at).toBeDefined();

      // Verify persisted
      const reloaded = await registry.find('test-rule');
      expect(reloaded!.instinct.approved_by).toBe('human');
    });

    it('throws for non-existent id', async () => {
      await expect(registry.approve('nope')).rejects.toThrow('not found');
    });
  });

  describe('reject', () => {
    it('deactivates and reduces confidence', async () => {
      const inst = await registry.reject('test-rule');
      expect(inst.active).toBe(false);
      expect(inst.confidence).toBeLessThan(0.7);
      expect(inst.outcome_log).toHaveLength(1);
      expect(inst.outcome_log[0]!.result).toBe('negative');
    });

    it('floors confidence at 0', async () => {
      // Reject twice
      await registry.reject('docker-multi'); // 0.6 - 0.3 = 0.3
      const inst = await registry.reject('docker-multi'); // 0.3 - 0.3 = 0.0
      expect(inst.confidence).toBe(0);
    });
  });

  describe('tune', () => {
    it('updates confidence', async () => {
      const inst = await registry.tune('test-rule', { confidence: 0.95 });
      expect(inst.confidence).toBe(0.95);
    });

    it('updates rule text', async () => {
      const inst = await registry.tune('test-rule', {
        rule: 'Always run vitest before committing TypeScript code to the repository safely',
      });
      expect(inst.rule).toContain('vitest');
    });

    it('updates tags', async () => {
      const inst = await registry.tune('test-rule', {
        tags: ['testing', 'vitest', 'ci-cd'],
      });
      expect(inst.tags).toContain('vitest');
    });

    it('activates/deactivates', async () => {
      const deactivated = await registry.tune('test-rule', { active: false });
      expect(deactivated.active).toBe(false);

      const reactivated = await registry.tune('test-rule', { active: true });
      expect(reactivated.active).toBe(true);
    });
  });

  describe('recordOutcome', () => {
    it('records positive outcome and increases confidence', async () => {
      const inst = await registry.recordOutcome('test-rule', 'positive', 0.05, 'It worked');
      expect(inst.confidence).toBeCloseTo(0.75);
      expect(inst.outcome_log).toHaveLength(1);
      expect(inst.outcome_log[0]!.result).toBe('positive');
      expect(inst.outcome_log[0]!.note).toBe('It worked');
    });

    it('records negative outcome and decreases confidence', async () => {
      const inst = await registry.recordOutcome('test-rule', 'negative', -0.1);
      expect(inst.confidence).toBeCloseTo(0.6);
    });

    it('clamps confidence to [0, 1]', async () => {
      const inst = await registry.recordOutcome('test-rule', 'positive', 0.5);
      expect(inst.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('remove', () => {
    it('deletes an instinct', async () => {
      await registry.remove('test-rule');
      const result = await registry.find('test-rule');
      expect(result).toBeNull();

      // Other instincts still exist
      const remaining = await registry.listAll();
      expect(remaining).toHaveLength(1);
    });

    it('throws for non-existent id', async () => {
      await expect(registry.remove('nope')).rejects.toThrow('not found');
    });
  });
});
