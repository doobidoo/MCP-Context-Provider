import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextWriter } from '../bridge/context-writer.js';
import type { PulledContext } from '../bridge/context-sync.js';

let dir: string;
let writer: ContextWriter;

const validContext = {
  tool_category: 'git',
  description: 'Git workflow rules',
  auto_convert: false,
  metadata: { version: '1.2.0', applies_to_tools: ['git:*'] },
};

function pulled(over: Partial<PulledContext> = {}): PulledContext {
  return {
    category: 'git',
    fileName: 'git_context.json',
    version: '1.2.0',
    payload: JSON.stringify(validContext, null, 2) + '\n',
    integrityOk: true,
    ...over,
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mcp-cp-writer-'));
  writer = new ContextWriter(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ContextWriter.write', () => {
  it('writes a context that does not exist locally', async () => {
    const p = pulled();
    const result = await writer.write([p]);

    expect(result.written).toEqual(['git_context.json']);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(p.payload);
  });

  it('leaves an existing file byte-identical without force', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');

    const result = await writer.write([pulled()]);

    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([
      { fileName: 'git_context.json', reason: 'file exists (use force to overwrite)' },
    ]);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(original);
  });

  it('overwrites with force and keeps a .bak of the previous file', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');

    const p = pulled();
    const result = await writer.write([p], { force: true });

    expect(result.written).toEqual(['git_context.json']);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(p.payload);
    expect(await readFile(join(dir, 'git_context.json.bak'), 'utf-8')).toBe(original);
  });

  it('refuses a payload whose integrity check failed', async () => {
    const result = await writer.write([pulled({ integrityOk: false })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toBe('integrity check failed');
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a payload that is not a valid context', async () => {
    const result = await writer.write([pulled({ payload: '{"nope":true}' })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('schema');
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a payload that is not JSON at all', async () => {
    const result = await writer.write([pulled({ payload: 'not json' })]);

    expect(result.written).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it.each([
    '../escape_context.json',
    'sub/dir_context.json',
    '/absolute_context.json',
    '..%2fescape_context.json',
    'Capital_context.json',
    'no-suffix.json',
    '_context.json',
  ])('refuses the file name %s and writes nothing', async (fileName) => {
    const result = await writer.write([pulled({ fileName })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toBe('invalid file name');
    expect(await readdir(dir)).toEqual([]);
  });

  it('leaves no temp file behind after a successful write', async () => {
    await writer.write([pulled()]);

    expect(await readdir(dir)).toEqual(['git_context.json']);
  });
});
