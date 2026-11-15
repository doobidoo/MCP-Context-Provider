import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpMemoryBridge } from '../bridge/http-bridge.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpMemoryBridge — contexts', () => {
  it('stores a context tagged as context-json with its category', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return Promise.resolve(jsonResponse({ content_hash: 'abc123' }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    const hash = await bridge.storeContext(
      'git',
      'Context git: Git workflow rules',
      ['portable'],
      { payload: '{}', file_name: 'git_context.json' },
    );

    expect(hash).toBe('abc123');
    expect(calls[0]!.url).toBe('https://memory.test/api/memories');
    expect(calls[0]!.body['tags']).toEqual(['context-json', 'context:git', 'portable']);
    expect(calls[0]!.body['memory_type']).toBe('context');
    expect((calls[0]!.body['metadata'] as Record<string, unknown>)['file_name']).toBe(
      'git_context.json',
    );
  });

  it('rejects a context store the service reports as a duplicate', async () => {
    // The service can answer HTTP 200 with success:false — e.g. its own
    // semantic-duplicate detection — which res.ok alone does not catch.
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        jsonResponse({
          success: false,
          message: 'Duplicate content detected (semantically similar to abc123)',
          content_hash: null,
          memory: null,
        }),
      ),
    );

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await expect(
      bridge.storeContext('git', 'Context git: Git workflow rules', ['portable'], {
        payload: '{}',
        file_name: 'git_context.json',
      }),
    ).rejects.toThrow(/Duplicate content detected/);
  });

  it('lists contexts filtered by the context marker tag', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      return Promise.resolve(jsonResponse({ memories: [], total: 0 }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.listContexts(2, 25);

    expect(urls[0]).toContain('tag=context-json');
    expect(urls[0]).toContain('page=2');
    expect(urls[0]).toContain('page_size=25');
  });

  it('throws instead of returning an empty page when the list call fails', async () => {
    // An empty page is how the pull loop recognises "no more contexts", so
    // swallowing a 500 here would report "nothing to restore" -- or, on a
    // later page, silently return a partial set.
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('upstream exploded', { status: 500 })),
    );

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await expect(bridge.listContexts()).rejects.toThrow(/500/);
  });

  it('searchByTags uses the given marker instead of the instinct tag', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ results: [] }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.searchByTags(['context:git'], true, 'context-json');

    expect(bodies[0]!['tags']).toEqual(['context-json', 'context:git']);
    expect(bodies[0]!['match_all']).toBe(true);
  });

  // A push deletes the old copy and stores the same content again. The service
  // hashes content only, so that POST matches its own delete record and is
  // refused with 409 unless the client asks for the re-create (service #1560).
  it('asks the service to re-create deleted content on every store', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ content_hash: 'abc123' }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.storeContext('git', 'Context git: Git workflow rules', [], {});
    await bridge.storeInstinct('git-conventional-commits', 'rule text', ['git'], {});

    expect(bodies.map((b) => b['restore_deleted'])).toEqual([true, true]);
  });

  it('rejects an instinct store the service reports as a duplicate', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        jsonResponse({ success: false, message: 'Duplicate content detected', content_hash: null }),
      ),
    );

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await expect(
      bridge.storeInstinct('git-conventional-commits', 'rule text', ['git'], {}),
    ).rejects.toThrow(/Duplicate content detected/);
  });

  it('searchByTags still defaults to the instinct marker', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ results: [] }));
    });

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });
    await bridge.searchByTags(['instinct-id:foo']);

    expect(bodies[0]!['tags']).toEqual(['instinct', 'instinct-id:foo']);
  });

  // A push looks up the copy it is about to replace. An empty answer on a
  // failed lookup reads as "nothing to replace": the store then goes through
  // and the old copy stays behind next to the new one.
  it('searchByTags throws instead of reporting no matches when the search fails', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('upstream exploded', { status: 500 })),
    );

    const bridge = new HttpMemoryBridge({ baseUrl: 'https://memory.test/api' });

    await expect(bridge.searchByTags(['instinct-id:foo'], true)).rejects.toThrow(
      'Failed to search by tags: 500',
    );
  });

  // storeContext and listContexts use the configured context tag. A lookup
  // with any other marker misses what they stored.
  it('findContexts looks a category up under the configured context tag', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(jsonResponse({ results: [] }));
    });

    const bridge = new HttpMemoryBridge({
      baseUrl: 'https://memory.test/api',
      contextTag: 'team-contexts',
    });
    await bridge.findContexts('git');

    expect(bodies[0]!['tags']).toEqual(['team-contexts', 'context:git']);
    expect(bodies[0]!['match_all']).toBe(true);
  });
});
