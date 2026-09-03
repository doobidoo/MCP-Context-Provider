import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ContextSync } from '../bridge/context-sync.js';
import { FakeMemoryBridge } from './helpers/fake-memory-bridge.js';
import type { Context, LoadedContextFile } from '../types/context.js';

let bridge: FakeMemoryBridge;
let sync: ContextSync;

function context(category: string, sync?: boolean): Context {
  return {
    tool_category: category,
    description: `${category} rules`,
    auto_convert: false,
    metadata: {
      version: '1.2.0',
      applies_to_tools: [`${category}:*`],
      ...(sync === undefined ? {} : { sync }),
    },
  };
}

function loaded(category: string, syncFlag?: boolean): LoadedContextFile {
  const ctx = context(category, syncFlag);
  return {
    fileName: `${category}_context.json`,
    raw: JSON.stringify(ctx, null, 2) + '\n',
    context: ctx,
  };
}

beforeEach(() => {
  bridge = new FakeMemoryBridge();
  sync = new ContextSync(bridge);
});

describe('ContextSync.pushToMemory', () => {
  it('stores the exact raw text in metadata.payload', async () => {
    const file = loaded('git');
    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual(['git']);
    const record = [...bridge.records.values()][0]!;
    expect(record.metadata['payload']).toBe(file.raw);
    expect(record.metadata['file_name']).toBe('git_context.json');
    expect(record.metadata['context_version']).toBe('1.2.0');
    expect(record.metadata['content_sha256']).toBe(
      createHash('sha256').update(file.raw).digest('hex'),
    );
  });

  it('puts a one-line summary in content, not the payload', async () => {
    await sync.pushToMemory([loaded('git')]);

    const record = [...bridge.records.values()][0]!;
    expect(record.content).toBe('Context git: git rules');
    expect(record.content).not.toContain('applies_to_tools');
  });

  it('tags the memory with the marker and the category', async () => {
    await sync.pushToMemory([loaded('git')]);

    const record = [...bridge.records.values()][0]!;
    expect(record.tags).toContain('context-json');
    expect(record.tags).toContain('context:git');
    expect(record.tags).toContain('portable');
  });

  it('replaces rather than duplicates on a re-push', async () => {
    await sync.pushToMemory([loaded('git')]);
    await sync.pushToMemory([loaded('git')]);

    expect(bridge.records.size).toBe(1);
    expect(bridge.storeCalls).toBe(2);
  });

  it('does not duplicate when deleting the existing memory fails', async () => {
    await sync.pushToMemory([loaded('git')]);
    expect(bridge.records.size).toBe(1);

    bridge.deleteContext = async () => false;
    const result = await sync.pushToMemory([loaded('git')]);

    expect(result.pushed).toEqual([]);
    expect(result.errors).toEqual([
      { category: 'git', error: 'failed to delete existing memory before re-push' },
    ]);
    expect(bridge.records.size).toBe(1);
  });

  it('skips a context with metadata.sync false', async () => {
    const result = await sync.pushToMemory([loaded('git', false), loaded('memory')]);

    expect(result.pushed).toEqual(['memory']);
    expect(result.skipped).toEqual([
      { category: 'git', reason: 'metadata.sync is false' },
    ]);
    expect(bridge.records.size).toBe(1);
  });

  it('pushes when metadata.sync is explicitly true', async () => {
    const result = await sync.pushToMemory([loaded('git', true)]);
    expect(result.pushed).toEqual(['git']);
  });

  it('records a per-context error without aborting the rest', async () => {
    const failing = new FakeMemoryBridge();
    failing.storeContext = async (category: string) => {
      if (category === 'git') throw new Error('boom');
      return 'hash';
    };
    const result = await new ContextSync(failing).pushToMemory([
      loaded('git'),
      loaded('memory'),
    ]);

    expect(result.pushed).toEqual(['memory']);
    expect(result.errors).toEqual([{ category: 'git', error: 'boom' }]);
  });
});

describe('ContextSync.pullFromMemory', () => {
  it('returns the payload byte for byte', async () => {
    const file = loaded('git');
    await sync.pushToMemory([file]);

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(1);
    expect(pulled[0]!.category).toBe('git');
    expect(pulled[0]!.fileName).toBe('git_context.json');
    expect(pulled[0]!.version).toBe('1.2.0');
    expect(pulled[0]!.payload).toBe(file.raw);
    expect(pulled[0]!.integrityOk).toBe(true);
  });

  it('flags a payload whose stored hash does not match', async () => {
    await sync.pushToMemory([loaded('git')]);
    const record = [...bridge.records.values()][0]!;
    record.metadata['content_sha256'] = 'deadbeef';

    const pulled = await sync.pullFromMemory();

    expect(pulled[0]!.integrityOk).toBe(false);
  });

  it('ignores memories that carry no payload', async () => {
    await bridge.storeContext('stray', 'Context stray: no payload', [], {});

    const pulled = await sync.pullFromMemory();

    expect(pulled).toEqual([]);
  });

  it('pages through more contexts than one page holds', async () => {
    const files = Array.from({ length: 120 }, (_, i) => loaded(`cat${i}`));
    await sync.pushToMemory(files);

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(120);
  });
});
