import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextLoader } from '../engine/context-loader.js';

let dir: string;

const gitContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-loader-files-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ContextLoader.loadAll — file provenance', () => {
  it('returns the source file name and the exact raw text', async () => {
    const raw = JSON.stringify(gitContext, null, 2) + '\n';
    await writeFile(join(dir, 'git_context.json'), raw, 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('git_context.json');
    expect(files[0]!.raw).toBe(raw);
    expect(files[0]!.context.tool_category).toBe('git');
  });

  it('keeps metadata.sync instead of stripping it', async () => {
    const withFlag = {
      ...gitContext,
      metadata: { ...gitContext.metadata, sync: false },
    };
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(withFlag), 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files[0]!.context.metadata.sync).toBe(false);
  });

  it('leaves metadata.sync undefined when the file does not set it', async () => {
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');

    const { files } = await new ContextLoader(dir).loadAll();

    expect(files[0]!.context.metadata.sync).toBeUndefined();
  });

  it('does not descend into subdirectories', async () => {
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');
    await mkdir(join(dir, 'private'));
    await writeFile(
      join(dir, 'private', 'secret_context.json'),
      JSON.stringify({ ...gitContext, tool_category: 'secret' }),
      'utf-8',
    );

    const { files, contexts } = await new ContextLoader(dir).loadAll();

    expect(files.map((f) => f.fileName)).toEqual(['git_context.json']);
    expect(contexts.has('secret')).toBe(false);
  });
});
