import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../engine/engine.js';

let dir: string;

const gitContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-engine-ctx-'));
  await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

/** A context memory as the service returns it, with a matching SHA. */
function contextMemory(category: string, payload: string) {
  return {
    content: `Context ${category}: stub`,
    content_hash: `hash-${category}`,
    tags: ['context-json', `context:${category}`],
    memory_type: 'context',
    metadata: {
      payload,
      file_name: `${category}_context.json`,
      context_category: category,
      context_version: '2.0.0',
      content_sha256: createHash('sha256').update(payload).digest('hex'),
    },
    created_at: 0,
    created_at_iso: new Date(0).toISOString(),
    updated_at: null,
    updated_at_iso: null,
  };
}

/** Stub the two endpoints the pull path touches: /health and /memories. */
function stubMemoryService(memories: unknown[]): void {
  vi.stubGlobal('fetch', (url: string) => {
    const body = String(url).includes('/health')
      ? { status: 'ok' }
      : { memories, total: memories.length };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

describe('Engine context sync', () => {
  it('exposes loaded context files with their provenance', async () => {
    const engine = new Engine({ contextsPath: dir, instinctsPath: join(dir, 'none') });
    await engine.initialize();

    const files = engine.getContextFiles();
    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('git_context.json');
  });

  it('returns null from both directions when no bridge is configured', async () => {
    const engine = new Engine({ contextsPath: dir, instinctsPath: join(dir, 'none') });
    await engine.initialize();

    expect(await engine.syncContextsToMemory()).toBeNull();
    expect(await engine.pullContextsFromMemory()).toBeNull();
  });

  it('serves a restored context without a second initialize()', async () => {
    const dockerContext = {
      tool_category: 'docker',
      description: 'Docker rules',
      auto_convert: false,
      metadata: { version: '2.0.0', applies_to_tools: ['docker:*'] },
    };
    const payload = JSON.stringify(dockerContext, null, 2) + '\n';
    stubMemoryService([contextMemory('docker', payload)]);

    const engine = new Engine({
      contextsPath: dir,
      instinctsPath: join(dir, 'none'),
      memoryBridge: { baseUrl: 'https://memory.test/api' },
    });
    await engine.initialize();
    expect(await engine.connectMemory()).toBe(true);

    const result = await engine.pullContextsFromMemory();
    expect(result?.written).toEqual(['docker_context.json']);

    // The engine's own view has to reflect what was just written, or a
    // sync_contexts in the same session would push the pre-restore text back.
    expect(engine.getContext('docker')?.description).toBe('Docker rules');
    const files = engine.getContextFiles();
    expect(files.map((f) => f.fileName).sort()).toEqual([
      'docker_context.json',
      'git_context.json',
    ]);
    expect(files.find((f) => f.fileName === 'docker_context.json')?.raw).toBe(payload);
  });

  it('does not reload when nothing was written', async () => {
    // An unwritable item must leave the loaded set exactly as it was.
    stubMemoryService([contextMemory('docker', 'not json at all')]);

    const engine = new Engine({
      contextsPath: dir,
      instinctsPath: join(dir, 'none'),
      memoryBridge: { baseUrl: 'https://memory.test/api' },
    });
    await engine.initialize();
    await engine.connectMemory();

    const result = await engine.pullContextsFromMemory();
    expect(result?.written).toEqual([]);
    expect(engine.getContextFiles()).toHaveLength(1);
  });
});
