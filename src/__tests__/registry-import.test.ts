import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify, parse } from 'yaml';
import { Registry } from '../cli/registry.js';
import type { Instinct, InstinctFile } from '../types/instinct.js';

let storeDir: string;
let sourceDir: string;
let registry: Registry;

function instinct(id: string, rule: string): Instinct {
  return {
    id,
    rule,
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

const store: InstinctFile = {
  version: '1.0',
  instincts: {
    'already-here': instinct(
      'already-here',
      'This instinct already lives in the target store and must not be overwritten',
    ),
  },
};

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'mcp-cp-store-'));
  sourceDir = await mkdtemp(join(tmpdir(), 'mcp-cp-source-'));
  await writeFile(
    join(storeDir, 'learned.instincts.yaml'),
    stringify(store),
    'utf-8',
  );
  registry = new Registry(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
  await rm(sourceDir, { recursive: true, force: true });
});

describe('Registry.importFrom', () => {
  it('adds instincts that are not yet in the store', async () => {
    const src = join(sourceDir, 'other.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          'brand-new': instinct(
            'brand-new',
            'A brand new instinct that should be merged into the target store',
          ),
        },
      }),
      'utf-8',
    );

    const result = await registry.importFrom(src);
    expect(result.added).toEqual(['brand-new']);
    expect(result.skipped).toEqual([]);

    const found = await registry.find('brand-new');
    expect(found).not.toBeNull();
  });

  it('skips ids that already exist and leaves them untouched', async () => {
    const src = join(sourceDir, 'other.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          'already-here': instinct(
            'already-here',
            'A conflicting rule text that must never replace the stored version',
          ),
        },
      }),
      'utf-8',
    );

    const result = await registry.importFrom(src);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(['already-here']);

    const found = await registry.find('already-here');
    expect(found!.instinct.rule).toBe(store.instincts['already-here']!.rule);
  });

  it('skips ids present in any file of the store, not just the target file', async () => {
    await writeFile(
      join(storeDir, 'other-store-file.instincts.yaml'),
      stringify({
        version: '1.0',
        instincts: {
          elsewhere: instinct(
            'elsewhere',
            'Lives in a second file of the target store and must still be detected',
          ),
        },
      }),
      'utf-8',
    );
    const src = join(sourceDir, 'in.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          elsewhere: instinct(
            'elsewhere',
            'Duplicate of an instinct stored in a different file of the store',
          ),
        },
      }),
      'utf-8',
    );

    const result = await registry.importFrom(src);
    expect(result.skipped).toEqual(['elsewhere']);
  });

  it('imports legacy top-level array files via loader repair', async () => {
    const src = join(sourceDir, 'legacy.instincts.yaml');
    await writeFile(
      src,
      stringify([
        instinct(
          'legacy-entry',
          'A legacy array-shaped instinct file as written by older instill versions',
        ),
      ]),
      'utf-8',
    );

    const result = await registry.importFrom(src);
    expect(result.added).toEqual(['legacy-entry']);
    expect(result.repairs.length).toBeGreaterThan(0);
  });

  it('writes into the requested target filename', async () => {
    const src = join(sourceDir, 'in.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          targeted: instinct(
            'targeted',
            'Should land in the explicitly requested target file of the store',
          ),
        },
      }),
      'utf-8',
    );

    await registry.importFrom(src, { filename: 'imported.instincts.yaml' });
    const raw = await readFile(join(storeDir, 'imported.instincts.yaml'), 'utf-8');
    const parsed = parse(raw) as InstinctFile;
    expect(Object.keys(parsed.instincts)).toEqual(['targeted']);
  });

  it('creates the store file when it does not exist yet', async () => {
    const emptyStore = await mkdtemp(join(tmpdir(), 'mcp-cp-empty-'));
    const fresh = new Registry(emptyStore);
    const src = join(sourceDir, 'in.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          first: instinct(
            'first',
            'First instinct imported into a completely empty target store',
          ),
        },
      }),
      'utf-8',
    );

    const result = await fresh.importFrom(src);
    expect(result.added).toEqual(['first']);
    expect((await fresh.find('first'))!.instinct.id).toBe('first');
    await rm(emptyStore, { recursive: true, force: true });
  });

  it('reports a dry run without writing', async () => {
    const src = join(sourceDir, 'in.instincts.yaml');
    await writeFile(
      src,
      stringify({
        version: '1.0',
        instincts: {
          'dry-run': instinct(
            'dry-run',
            'Should be reported as importable but never written to disk in dry run',
          ),
        },
      }),
      'utf-8',
    );

    const result = await registry.importFrom(src, { dryRun: true });
    expect(result.added).toEqual(['dry-run']);
    expect(await registry.find('dry-run')).toBeNull();
  });
});
