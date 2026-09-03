import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ContextSync, asciiEscapedByteLength } from '../bridge/context-sync.js';
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

/**
 * Byte size of the wire metadata object pushToMemory measures, minus the
 * payload -- i.e. including the `context_category` and `source` keys
 * HttpMemoryBridge.storeContext appends, since those count against the
 * limit too. `content_sha256` is always 64 hex chars and `synced_at` an
 * ISO string of fixed length, so this overhead does not depend on the
 * actual payload content -- only on the category, file name and version,
 * which the caller controls. Uses the same ASCII-escaped measurement as
 * the production check so a payload built from this overhead lands exactly
 * where the test intends, whether the payload is ASCII or not.
 */
function metadataOverheadBytes(category: string, fileName: string, version: string): number {
  const placeholder = {
    payload: '',
    file_name: fileName,
    context_version: version,
    content_sha256: createHash('sha256').update('').digest('hex'),
    synced_at: new Date().toISOString(),
    context_category: category,
    source: 'mcp-context-provider',
  };
  return asciiEscapedByteLength(JSON.stringify(placeholder));
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

  it('refuses a context whose metadata would exceed the Cloudflare sync limit and reports the size', async () => {
    const overhead = metadataOverheadBytes('git', 'git_context.json', '1.2.0');
    const file = loaded('git');
    // One byte over the default 9500-byte cap.
    file.raw = 'a'.repeat(9500 - overhead + 1);

    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.category).toBe('git');
    expect(result.errors[0]!.error).toBe(
      `metadata is 9501 bytes, over the 9500-byte Cloudflare sync limit`,
    );
    expect(bridge.records.size).toBe(0);
  });

  it('stores a context whose metadata is one byte under the default limit', async () => {
    const overhead = metadataOverheadBytes('git', 'git_context.json', '1.2.0');
    const file = loaded('git');
    file.raw = 'a'.repeat(9500 - overhead - 1);

    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual(['git']);
    expect(result.errors).toEqual([]);
    expect(bridge.records.size).toBe(1);
  });

  it('allows a larger context through when maxMetadataBytes is raised', async () => {
    const overhead = metadataOverheadBytes('git', 'git_context.json', '1.2.0');
    const file = loaded('git');
    // Well over the default cap, comfortably under a raised one.
    file.raw = 'a'.repeat(20000 - overhead);

    const restricted = await sync.pushToMemory([file]);
    expect(restricted.pushed).toEqual([]);
    expect(restricted.errors).toHaveLength(1);

    const permissive = new ContextSync(bridge, { maxMetadataBytes: 25000 });
    const allowed = await permissive.pushToMemory([file]);

    expect(allowed.pushed).toEqual(['git']);
    expect(allowed.errors).toEqual([]);
  });

  it('refuses a context that is under the limit by raw UTF-8 bytes but over it once escaped', async () => {
    // An em dash is 3 bytes in UTF-8 but the service escapes it to —,
    // 6 ASCII bytes. Build a payload that fits under 9500 raw UTF-8 bytes
    // but goes over once every character is charged at the escaped rate.
    const overhead = metadataOverheadBytes('git', 'git_context.json', '1.2.0');
    const file = loaded('git');
    const emDashCount = 1900; // 1900 * 3 = 5700 raw UTF-8 bytes for the payload alone
    file.raw = '—'.repeat(emDashCount);

    const utf8MetadataBytes = Buffer.byteLength(
      JSON.stringify({
        payload: file.raw,
        file_name: 'git_context.json',
        context_version: '1.2.0',
        content_sha256: createHash('sha256').update(file.raw).digest('hex'),
        synced_at: new Date().toISOString(),
        context_category: 'git',
        source: 'mcp-context-provider',
      }),
      'utf-8',
    );
    // Confirms the test is actually exercising the gap: under the default
    // limit by raw UTF-8 byte count...
    expect(utf8MetadataBytes).toBeLessThan(9500);

    const escapedMetadataBytes = emDashCount * 6 + overhead;
    // ...but over it once ASCII-escaped, the way the service measures.
    expect(escapedMetadataBytes).toBeGreaterThan(9500);

    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual([]);
    expect(result.errors).toEqual([
      {
        category: 'git',
        error: `metadata is ${escapedMetadataBytes} bytes, over the 9500-byte Cloudflare sync limit`,
      },
    ]);
    expect(bridge.records.size).toBe(0);
  });

  it('refuses a CJK-heavy context under the raw byte limit but over it once escaped', async () => {
    const overhead = metadataOverheadBytes('git', 'git_context.json', '1.2.0');
    const file = loaded('git');
    const charCount = 1900; // 1900 * 3 = 5700 raw UTF-8 bytes, well under 9500
    file.raw = '中'.repeat(charCount); // CJK, also 3 bytes in UTF-8

    const utf8MetadataBytes = Buffer.byteLength(
      JSON.stringify({
        payload: file.raw,
        file_name: 'git_context.json',
        context_version: '1.2.0',
        content_sha256: createHash('sha256').update(file.raw).digest('hex'),
        synced_at: new Date().toISOString(),
        context_category: 'git',
        source: 'mcp-context-provider',
      }),
      'utf-8',
    );
    expect(utf8MetadataBytes).toBeLessThan(9500);

    const escapedMetadataBytes = charCount * 6 + overhead;
    expect(escapedMetadataBytes).toBeGreaterThan(9500);

    const result = await sync.pushToMemory([file]);

    expect(result.pushed).toEqual([]);
    expect(result.errors).toEqual([
      {
        category: 'git',
        error: `metadata is ${escapedMetadataBytes} bytes, over the 9500-byte Cloudflare sync limit`,
      },
    ]);
  });
});

describe('asciiEscapedByteLength', () => {
  it('counts an ASCII string as its raw byte length', () => {
    expect(asciiEscapedByteLength('abc')).toBe(3);
  });

  it('counts a BMP non-ASCII character as a 6-byte \\uXXXX escape', () => {
    expect(asciiEscapedByteLength('—')).toBe(6); // em dash
  });

  it('counts a character outside the BMP as two 6-byte escapes (a surrogate pair)', () => {
    expect(asciiEscapedByteLength('\u{1F600}')).toBe(12); // grinning face emoji
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

  it('returns every context even when the server under-reports total', async () => {
    const files = Array.from({ length: 80 }, (_, i) => loaded(`under${i}`));
    await sync.pushToMemory(files);

    const original = bridge.listContexts.bind(bridge);
    bridge.listContexts = async (page?: number, pageSize?: number) => {
      const result = await original(page, pageSize);
      return { ...result, total: 1 };
    };

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(80);
  });

  it('returns all contexts when the count is an exact multiple of the page size', async () => {
    const files = Array.from({ length: 100 }, (_, i) => loaded(`multi${i}`));
    await sync.pushToMemory(files);

    const pulled = await sync.pullFromMemory();

    expect(pulled).toHaveLength(100);
  });

  it('ignores a memory whose payload or file_name is an empty string', async () => {
    await bridge.storeContext('empty-payload', 'Context empty-payload', [], {
      payload: '',
      file_name: 'empty_context.json',
    });
    await bridge.storeContext('empty-name', 'Context empty-name', [], {
      payload: 'some text',
      file_name: '',
    });

    const pulled = await sync.pullFromMemory();

    expect(pulled).toEqual([]);
  });
});
