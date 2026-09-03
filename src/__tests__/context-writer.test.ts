import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
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

  it('keeps the original .bak when the same fileName appears twice in a force batch', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');

    const first = pulled();
    const second = pulled({
      payload:
        JSON.stringify(
          { ...validContext, metadata: { ...validContext.metadata, version: '9.9.9' } },
          null,
          2,
        ) + '\n',
    });

    const result = await writer.write([first, second], { force: true });

    // The first occurrence is the one that gets written; the repeat is
    // refused before it can touch the target or its .bak.
    expect(result.written).toEqual(['git_context.json']);
    expect(result.skipped).toEqual([
      { fileName: 'git_context.json', reason: 'duplicate file name in this batch' },
    ]);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(first.payload);
    // The .bak must still hold the ORIGINAL local content, not the first
    // item's payload — a second write to the same target would otherwise
    // clobber the .bak that is supposed to preserve it.
    expect(await readFile(join(dir, 'git_context.json.bak'), 'utf-8')).toBe(original);
  });

  it('does not abort the batch when a fileName is not a string at runtime', async () => {
    // RegExp#test coerces via String(), so a crafted toString() could slip
    // past VALID_CONTEXT_FILENAME and reach path.resolve(), which throws on
    // a non-string argument. That must be caught before it aborts write().
    const bogus = { toString: () => 'git_context.json' };
    const other = pulled({
      fileName: 'docs_context.json',
      payload:
        JSON.stringify({ ...validContext, tool_category: 'docs' }, null, 2) + '\n',
    });

    const result = await writer.write([
      pulled({ fileName: bogus as unknown as string }),
      other,
    ]);

    expect(result.written).toEqual(['docs_context.json']);
    expect(result.skipped).toEqual([{ fileName: bogus, reason: 'invalid file name' }]);
    expect(await readFile(join(dir, 'docs_context.json'), 'utf-8')).toBe(other.payload);
  });

  it('reports a .bak copy failure as a skipped item rather than throwing', async () => {
    const original = '{"local":"version"}\n';
    await writeFile(join(dir, 'git_context.json'), original, 'utf-8');
    // Make the .bak target unwritable as a plain file: a directory sitting
    // where the .bak would go makes copyFile() throw EISDIR.
    await mkdir(join(dir, 'git_context.json.bak'));

    const result = await writer.write([pulled()], { force: true });

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('write failed');
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(original);
  });
});
