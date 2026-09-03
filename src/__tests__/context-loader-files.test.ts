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

  it('reports two files that declare the same tool_category', async () => {
    // Both files are loaded; only one of them ends up in the category map,
    // and which one is decided by directory order. That has to be loud.
    await writeFile(join(dir, 'git_context.json'), JSON.stringify(gitContext), 'utf-8');
    await writeFile(
      join(dir, 'vcs_context.json'),
      JSON.stringify({ ...gitContext, description: 'A second git context' }),
      'utf-8',
    );

    const { contexts, files, errors } = await new ContextLoader(dir).loadAll();

    expect(files).toHaveLength(2);
    expect(contexts.size).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.error).toMatch(/tool_category "git" is already declared by/);
    // Both file names appear, so the collision can be resolved by hand.
    const mentioned = `${errors[0]!.file} ${errors[0]!.error}`;
    expect(mentioned).toContain('git_context.json');
    expect(mentioned).toContain('vcs_context.json');
  });
});
