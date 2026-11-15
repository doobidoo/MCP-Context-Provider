import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir, symlink, lstat } from 'node:fs/promises';
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
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.fileName).toBe('git_context.json');
    expect(result.skipped[0]!.reason).toContain('use force to overwrite');
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(original);
  });

  it('reports both the local and the remote version on a conflict', async () => {
    await writeFile(
      join(dir, 'git_context.json'),
      JSON.stringify({ ...validContext, metadata: { ...validContext.metadata, version: '1.0.0' } }),
      'utf-8',
    );

    const result = await writer.write([pulled({ version: '3.4.5' })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('local version 1.0.0');
    expect(result.skipped[0]!.reason).toContain('remote version 3.4.5');
  });

  it('still reports a conflict when the local file is not parseable', async () => {
    // A conflict must stay reportable whatever happens to sit at the path.
    await writeFile(join(dir, 'git_context.json'), 'not json at all', 'utf-8');

    const result = await writer.write([pulled({ version: '' })]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('local version unknown');
    expect(result.skipped[0]!.reason).toContain('remote version unknown');
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

  it('does not let an earlier failed occurrence of a name suppress a later valid one', async () => {
    // Regression: marking a name "handled" before the write actually
    // succeeds meant a malformed or integrity-failing entry ahead of a
    // genuine update in the same batch would claim the name and cause the
    // genuine update to be refused as a "duplicate" — silently dropping a
    // legitimate context by ordering alone.
    const bad = pulled({ payload: '{"nope":true}' });
    const good = pulled();

    const result = await writer.write([bad, good]);

    expect(result.written).toEqual(['git_context.json']);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        fileName: 'git_context.json',
        reason: expect.stringContaining('schema'),
      }),
    ]);
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(good.payload);
  });

  it('does not abort the batch when a fileName is not a string at runtime', async () => {
    // RegExp#test coerces via String(), so a crafted toString() could slip
    // past VALID_CONTEXT_FILENAME and reach path.resolve(), which throws on
    // a non-string argument. That must be caught before it aborts write().
    const bogus = { toString: () => 'git_context.json' };
    const other = pulled({
      category: 'docs',
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

  it('refuses a payload whose tool_category is not the recorded category', async () => {
    // The engine keys a context by tool_category and injects it as
    // instructions; the no-overwrite guard is keyed on the file name. A
    // memory that claims one identity and carries another must not be
    // written just because its file name is fresh and valid.
    const result = await writer.write([
      pulled({
        category: 'docs',
        fileName: 'docs_context.json',
        payload: JSON.stringify({ ...validContext, tool_category: 'git' }),
      }),
    ]);

    expect(result.written).toEqual([]);
    expect(result.skipped[0]!.reason).toContain('tool_category "git"');
    expect(result.skipped[0]!.reason).toContain('"docs"');
    await expect(readFile(join(dir, 'docs_context.json'), 'utf-8')).rejects.toThrow();
  });

  it('writes when the payload category and the recorded category agree', async () => {
    const result = await writer.write([pulled()]);

    expect(result.written).toEqual(['git_context.json']);
  });

  // A self-referencing symlink fails to read with ELOOP for every user,
  // root included, which a chmod-based fixture would not.
  it('does not replace an existing file it cannot read', async () => {
    const target = join(dir, 'git_context.json');
    await symlink('git_context.json', target);

    const result = await writer.write([pulled()]);

    expect(result.written).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('cannot read existing file');
    expect((await lstat(target)).isSymbolicLink()).toBe(true);
  });

  it('creates the contexts directory when it does not exist yet', async () => {
    const fresh = join(dir, 'new-machine', 'contexts');
    const p = pulled();

    const result = await new ContextWriter(fresh).write([p]);

    expect(result.written).toEqual(['git_context.json']);
    expect(await readFile(join(fresh, 'git_context.json'), 'utf-8')).toBe(p.payload);
  });

  it('lets only one of two overlapping restores write a file that did not exist', async () => {
    const first = pulled({ payload: JSON.stringify({ ...validContext, description: 'first' }) });
    const second = pulled({ payload: JSON.stringify({ ...validContext, description: 'second' }) });

    const [a, b] = await Promise.all([
      new ContextWriter(dir).write([first]),
      new ContextWriter(dir).write([second]),
    ]);

    expect([...a.written, ...b.written]).toEqual(['git_context.json']);
    expect([...a.skipped, ...b.skipped]).toHaveLength(1);
    const winner = a.written.length === 1 ? first : second;
    expect(await readFile(join(dir, 'git_context.json'), 'utf-8')).toBe(winner.payload);
    expect(await readdir(dir)).toEqual(['git_context.json']);
  });
});
