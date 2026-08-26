import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveInstinctsPath,
  resolveContextsPath,
  packageRoot,
  foreignGitTreeWarning,
} from '../config/paths.js';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'mcp-cp-paths-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('resolveInstinctsPath', () => {
  it('prefers INSTINCTS_PATH when set', () => {
    const r = resolveInstinctsPath({
      env: { INSTINCTS_PATH: join(tmp, 'explicit') },
      cwd: tmp,
      home: tmp,
    });
    expect(r.source).toBe('env');
    expect(r.path).toBe(join(tmp, 'explicit'));
  });

  it('resolves a relative INSTINCTS_PATH against cwd', () => {
    const r = resolveInstinctsPath({
      env: { INSTINCTS_PATH: './rel' },
      cwd: tmp,
      home: tmp,
    });
    expect(r.path).toBe(join(tmp, 'rel'));
  });

  it('uses ./instincts when cwd is the mcp-context-provider checkout', async () => {
    await writeFile(
      join(tmp, 'package.json'),
      JSON.stringify({ name: 'mcp-context-provider' }),
      'utf-8',
    );
    const r = resolveInstinctsPath({ env: {}, cwd: tmp, home: tmp });
    expect(r.source).toBe('repo-cwd');
    expect(r.path).toBe(join(tmp, 'instincts'));
  });

  it('ignores ./instincts when cwd is an unrelated package', async () => {
    await writeFile(
      join(tmp, 'package.json'),
      JSON.stringify({ name: 'some-other-project' }),
      'utf-8',
    );
    await mkdir(join(tmp, 'instincts'));
    const r = resolveInstinctsPath({ env: {}, cwd: tmp, home: tmp });
    expect(r.source).not.toBe('repo-cwd');
    expect(r.path).not.toBe(join(tmp, 'instincts'));
  });

  it('falls back to XDG_DATA_HOME when set', () => {
    const r = resolveInstinctsPath({
      env: { XDG_DATA_HOME: join(tmp, 'xdg') },
      cwd: tmp,
      home: tmp,
    });
    expect(r.source).toBe('xdg');
    expect(r.path).toBe(join(tmp, 'xdg', 'mcp-context-provider', 'instincts'));
  });

  it('falls back to ~/.local/share when nothing else applies', () => {
    const r = resolveInstinctsPath({ env: {}, cwd: tmp, home: tmp });
    expect(r.source).toBe('home');
    expect(r.path).toBe(
      join(tmp, '.local', 'share', 'mcp-context-provider', 'instincts'),
    );
  });

  it('never returns a cwd-relative path outside the checkout', () => {
    const r = resolveInstinctsPath({ env: {}, cwd: tmp, home: join(tmp, 'h') });
    expect(r.path.startsWith(join(tmp, 'h'))).toBe(true);
  });
});

describe('resolveContextsPath', () => {
  it('prefers CONTEXTS_PATH when set', () => {
    const r = resolveContextsPath({
      env: { CONTEXTS_PATH: join(tmp, 'ctx') },
      cwd: tmp,
      home: tmp,
    });
    expect(r.source).toBe('env');
    expect(r.path).toBe(join(tmp, 'ctx'));
  });

  it('falls back to the packaged contexts directory, not cwd', () => {
    const r = resolveContextsPath({ env: {}, cwd: tmp, home: tmp });
    expect(r.source).toBe('packaged');
    expect(r.path).toBe(join(packageRoot, 'contexts'));
  });
});

describe('foreignGitTreeWarning', () => {
  it('returns null for a path outside any git tree', async () => {
    const dir = join(tmp, 'plain', 'instincts');
    await mkdir(dir, { recursive: true });
    expect(foreignGitTreeWarning(dir)).toBeNull();
  });

  it('warns when the store sits inside an unrelated git working tree', async () => {
    const repo = join(tmp, 'other-repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const dir = join(repo, 'instincts');
    await mkdir(dir, { recursive: true });
    const warning = foreignGitTreeWarning(dir);
    expect(warning).toContain(repo);
  });

  it('stays silent for the provider checkout itself', () => {
    expect(foreignGitTreeWarning(join(packageRoot, 'instincts'))).toBeNull();
  });
});
