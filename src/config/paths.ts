/**
 * Store path resolution.
 *
 * The instincts store used to default to `./instincts`, resolved against
 * whatever CWD the MCP host happened to launch the server from. That silently
 * split the store per launch directory and dropped learned instincts into
 * unrelated repositories (Codeberg issue #1).
 *
 * Resolution is now explicit and shared by the server and the CLI, so both
 * always operate on the same store:
 *
 *   instincts:  INSTINCTS_PATH → ./instincts (only inside this checkout)
 *               → $XDG_DATA_HOME/mcp-context-provider/instincts
 *               → ~/.local/share/mcp-context-provider/instincts
 *
 *   contexts:   CONTEXTS_PATH → ./contexts (only inside this checkout)
 *               → the contexts/ directory shipped with the package
 *
 * Contexts are authored and shipped with the package, so the packaged
 * directory is the correct fallback. Instincts are learned user data, so they
 * belong in a user-level home that does not depend on the launch directory.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'mcp-context-provider';

/**
 * The one file the engine and the CLI read instincts from.
 *
 * The store used to be every `*.instincts.yaml` in the directory, merged
 * together. That made "which file is an instinct in" unanswerable and let a
 * second file drift in unnoticed. There is exactly one source now; anything
 * else in the directory is reported by name and merged deliberately with
 * `mcp-cp import`.
 */
export const CANONICAL_INSTINCTS_FILE = 'learned.instincts.yaml';

/** Files in the store directory that are not stores themselves. */
export function isStoreSidecar(filename: string): boolean {
  return (
    !filename.endsWith('.instincts.yaml') ||
    filename === CANONICAL_INSTINCTS_FILE
  );
}

/** Root of the installed package (one level above src/ or dist/). */
export const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export type InstinctsPathSource = 'env' | 'repo-cwd' | 'xdg' | 'home';
export type ContextsPathSource = 'env' | 'repo-cwd' | 'packaged';

export interface ResolvedPath<S extends string> {
  /** Absolute path to the directory. */
  path: string;
  /** Which rule produced it — surfaced in logs and tool output. */
  source: S;
}

export interface ResolveOptions {
  /** Environment to read (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Working directory to resolve relative paths against (defaults to cwd). */
  cwd?: string;
  /** Home directory (defaults to os.homedir()). */
  home?: string;
}

interface Resolved extends Required<ResolveOptions> {}

function options(opts: ResolveOptions = {}): Resolved {
  return {
    env: opts.env ?? process.env,
    cwd: opts.cwd ?? process.cwd(),
    home: opts.home ?? homedir(),
  };
}

function fromEnv(value: string, cwd: string): string {
  return isAbsolute(value) ? resolve(value) : resolve(cwd, value);
}

/**
 * True when `dir` is a checkout of this package — the only case where a
 * CWD-relative `./instincts` or `./contexts` default is meaningful.
 */
export function isProviderCheckout(dir: string): boolean {
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { name?: unknown }).name === PACKAGE_NAME
    );
  } catch {
    return false;
  }
}

/** Resolve the instincts store directory. */
export function resolveInstinctsPath(
  opts: ResolveOptions = {},
): ResolvedPath<InstinctsPathSource> {
  const { env, cwd, home } = options(opts);

  const explicit = env['INSTINCTS_PATH'];
  if (explicit) return { path: fromEnv(explicit, cwd), source: 'env' };

  if (isProviderCheckout(cwd)) {
    return { path: join(cwd, 'instincts'), source: 'repo-cwd' };
  }

  const xdg = env['XDG_DATA_HOME'];
  if (xdg) {
    return {
      path: join(fromEnv(xdg, cwd), PACKAGE_NAME, 'instincts'),
      source: 'xdg',
    };
  }

  return {
    path: join(home, '.local', 'share', PACKAGE_NAME, 'instincts'),
    source: 'home',
  };
}

/** Resolve the contexts directory. */
export function resolveContextsPath(
  opts: ResolveOptions = {},
): ResolvedPath<ContextsPathSource> {
  const { env, cwd } = options(opts);

  const explicit = env['CONTEXTS_PATH'];
  if (explicit) return { path: fromEnv(explicit, cwd), source: 'env' };

  if (isProviderCheckout(cwd)) {
    return { path: join(cwd, 'contexts'), source: 'repo-cwd' };
  }

  return { path: join(packageRoot, 'contexts'), source: 'packaged' };
}

/**
 * Walk up from `dir` looking for a git working tree. Returns a warning when
 * the store sits inside a repository that is not this package's own checkout
 * — the signal that a CWD was picked up by accident and that learned
 * instincts are about to be committed somewhere they do not belong.
 */
export function foreignGitTreeWarning(dir: string): string | null {
  let current = resolve(dir);

  for (;;) {
    if (existsSync(join(current, '.git'))) {
      if (current === packageRoot) return null;
      return (
        `instincts store ${dir} sits inside the git working tree ${current}, ` +
        'which is not the mcp-context-provider checkout. Learned instincts ' +
        'carry session context and should not be committed there — set ' +
        'INSTINCTS_PATH to a user-level directory.'
      );
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
