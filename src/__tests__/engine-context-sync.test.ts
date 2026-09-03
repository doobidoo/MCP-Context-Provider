import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
});

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
});
