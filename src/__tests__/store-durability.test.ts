import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { InstinctLoader } from '../engine/instinct-loader.js';
import type { Instinct } from '../types/instinct.js';

/**
 * A store that exists on disk must never be replaced by an empty one.
 *
 * `append()` used to fall back to `{version, instincts:{}}` whenever the load
 * threw — for any reason, including a transient parse failure on a perfectly
 * good file — and then saved that empty file over the real one. A 232-instinct
 * store was wiped down to a single entry that way.
 */

let dir: string;
let loader: InstinctLoader;

function instinct(id: string): Instinct {
  return {
    id,
    rule: 'A placeholder rule long enough to satisfy the schema token range check',
    domain: 'testing',
    tags: ['testing'],
    trigger_patterns: [id],
    confidence: 0.7,
    min_confidence: 0.5,
    usage_count: 0,
    approved_by: 'human',
    active: true,
    outcome_log: [],
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-durability-'));
  loader = new InstinctLoader(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('InstinctLoader.append — never destroys an existing store', () => {
  it('creates the file when it does not exist yet', async () => {
    const file = await loader.append('learned.instincts.yaml', instinct('first-one'));
    expect(Object.keys(file.instincts)).toEqual(['first-one']);
  });

  it('appends to an existing store without dropping its entries', async () => {
    await writeFile(
      join(dir, 'learned.instincts.yaml'),
      stringify({ version: '1.0', instincts: { existing: instinct('existing') } }),
      'utf-8',
    );

    const file = await loader.append('learned.instincts.yaml', instinct('added'));
    expect(Object.keys(file.instincts).sort()).toEqual(['added', 'existing']);
  });

  it('throws instead of overwriting when the existing file cannot be parsed', async () => {
    const path = join(dir, 'learned.instincts.yaml');
    const corrupt = 'instincts:\n  bad:\n    rule: "\\.eml$"\n';
    await writeFile(path, corrupt, 'utf-8');

    await expect(loader.append('learned.instincts.yaml', instinct('newcomer'))).rejects.toThrow();

    // The unparseable file is still there, byte for byte.
    expect(await readFile(path, 'utf-8')).toBe(corrupt);
  });

  it('throws instead of overwriting when the existing file is unreadable', async () => {
    const path = join(dir, 'learned.instincts.yaml');
    const original = stringify({ version: '1.0', instincts: { keep: instinct('keep') } });
    await writeFile(path, original, 'utf-8');
    await chmod(path, 0o000);

    try {
      await expect(loader.append('learned.instincts.yaml', instinct('newcomer'))).rejects.toThrow();
    } finally {
      await chmod(path, 0o600);
    }

    expect(await readFile(path, 'utf-8')).toBe(original);
  });
});

describe('InstinctLoader.save — atomic', () => {
  it('leaves no partial file behind when serialization fails', async () => {
    const path = join(dir, 'learned.instincts.yaml');
    const original = stringify({ version: '1.0', instincts: { keep: instinct('keep') } });
    await writeFile(path, original, 'utf-8');

    // confidence out of range: rejected by the schema inside save()
    const bad = { version: '1.0' as const, instincts: { broken: { ...instinct('broken'), confidence: 42 } } };
    await expect(loader.save('learned.instincts.yaml', bad as never)).rejects.toThrow();

    expect(await readFile(path, 'utf-8')).toBe(original);
  });
});
