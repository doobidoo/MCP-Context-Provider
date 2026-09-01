import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { Engine } from '../engine/engine.js';
import { Registry } from '../cli/registry.js';
import { CANONICAL_INSTINCTS_FILE } from '../config/paths.js';
import type { Instinct } from '../types/instinct.js';

/**
 * The store has exactly one source of truth. Extra *.instincts.yaml files in
 * the store directory are never merged in silently — they are reported by name
 * so they can be merged deliberately with `mcp-cp import`.
 */

let dir: string;

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

async function writeStore(name: string, ids: string[]): Promise<void> {
  await writeFile(
    join(dir, name),
    stringify({
      version: '1.0',
      instincts: Object.fromEntries(ids.map((id) => [id, instinct(id)])),
    }),
    'utf-8',
  );
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-single-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('canonical store file', () => {
  it('names learned.instincts.yaml as the one source', () => {
    expect(CANONICAL_INSTINCTS_FILE).toBe('learned.instincts.yaml');
  });
});

describe('Engine.initialize', () => {
  it('loads only the canonical file', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one', 'canonical-two']);
    await writeStore('team.instincts.yaml', ['from-a-second-file']);

    const engine = new Engine({ contextsPath: join(dir, 'no-contexts'), instinctsPath: dir });
    const result = await engine.initialize();

    expect(result.instinctsLoaded).toBe(2);
    expect(engine.getAllInstincts().map((i) => i.id).sort()).toEqual([
      'canonical-one',
      'canonical-two',
    ]);
  });

  it('reports the files it did not load, by name', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one']);
    await writeStore('team.instincts.yaml', ['ignored-one']);
    await writeStore('old.instincts.yaml', ['ignored-two']);

    const engine = new Engine({ contextsPath: join(dir, 'no-contexts'), instinctsPath: dir });
    const result = await engine.initialize();

    expect(result.unloadedFiles.sort()).toEqual(['old.instincts.yaml', 'team.instincts.yaml']);
  });

  it('reports nothing extra when the store holds only the canonical file', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one']);

    const engine = new Engine({ contextsPath: join(dir, 'no-contexts'), instinctsPath: dir });
    const result = await engine.initialize();

    expect(result.unloadedFiles).toEqual([]);
  });

  it('ignores backups and temporary files when reporting extras', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one']);
    await writeFile(join(dir, 'learned.instincts.yaml.bak'), 'whatever', 'utf-8');
    await writeFile(join(dir, 'learned.instincts.yaml.tmp-1-2'), 'whatever', 'utf-8');

    const engine = new Engine({ contextsPath: join(dir, 'no-contexts'), instinctsPath: dir });
    const result = await engine.initialize();

    expect(result.unloadedFiles).toEqual([]);
  });

  it('starts clean when the store is empty', async () => {
    const engine = new Engine({ contextsPath: join(dir, 'no-contexts'), instinctsPath: dir });
    const result = await engine.initialize();

    expect(result.instinctsLoaded).toBe(0);
    expect(result.unloadedFiles).toEqual([]);
  });
});

describe('Registry', () => {
  it('lists only the canonical file and reports the rest', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one']);
    await writeStore('team.instincts.yaml', ['ignored-one']);

    const registry = new Registry(dir);
    const { entries, unloadedFiles } = await registry.listAll();

    expect(entries.map((e) => e.instinct.id)).toEqual(['canonical-one']);
    expect(unloadedFiles).toEqual(['team.instincts.yaml']);
  });

  it('does not find instincts that live outside the canonical file', async () => {
    await writeStore(CANONICAL_INSTINCTS_FILE, ['canonical-one']);
    await writeStore('team.instincts.yaml', ['elsewhere']);

    const registry = new Registry(dir);
    expect(await registry.find('elsewhere')).toBeNull();
    expect(await registry.find('canonical-one')).not.toBeNull();
  });
});
