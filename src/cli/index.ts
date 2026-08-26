#!/usr/bin/env node

/**
 * mcp-cp — Approval Registry CLI for mcp-context-provider v2.x
 *
 * Usage:
 *   mcp-cp list                             List all instincts
 *   mcp-cp show <id>                        Show instinct details
 *   mcp-cp approve <id>                     Approve an instinct (human)
 *   mcp-cp reject <id>                      Reject and deactivate
 *   mcp-cp tune <id> [--confidence N]       Tune parameters
 *                     [--min-confidence N]
 *                     [--active true|false]
 *                     [--rule "text"]
 *   mcp-cp outcome <id> <+|-|~> [note]      Record outcome
 *   mcp-cp remove <id>                      Delete instinct
 *   mcp-cp import <file>                    Merge a YAML file into the store
 *   mcp-cp path                             Show the resolved store path
 */

import { resolve } from 'node:path';
import { resolveInstinctsPath, foreignGitTreeWarning } from '../config/paths.js';
import { Registry } from './registry.js';
import {
  formatInstinctRow,
  formatInstinctDetail,
  formatSummary,
  success,
  error,
  warn,
} from './formatter.js';

// ---------------------------------------------------------------------------
// CLI argument parsing (zero-dependency)
// ---------------------------------------------------------------------------

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip node + script
  const command = args[0] ?? 'help';
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  let i = 1;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = 'true';
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { command, positional, flags };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdList(
  registry: Registry,
  store: { path: string; source: string },
  strict = false,
): Promise<void> {
  // Always name the store. The failure mode this guards against is silence:
  // an empty or unexpected registry looks identical to a wrong store path.
  console.error(`store: ${store.path} (${store.source})`);
  const gitWarning = foreignGitTreeWarning(store.path);
  if (gitWarning) console.error(warn(gitWarning));

  const { entries, skipped } = await registry.listAll();

  if (skipped.length > 0) {
    console.error('');
    console.error(warn(`${skipped.length} file(s) skipped due to parse/validation errors (details above).`));
    if (strict) {
      process.exitCode = 1;
      return;
    }
    console.error('');
  }

  if (entries.length === 0) {
    console.log(
      warn(`No instincts found in ${store.path}. Use /instill to extract some, or mcp-cp import <file> to merge an existing store.`),
    );
    return;
  }

  const instincts = entries.map((e) => e.instinct);
  console.log(formatSummary(instincts, skipped.length));
  console.log('');

  for (const entry of entries) {
    console.log(formatInstinctRow(entry.instinct));
    console.log('');
  }
}

async function cmdShow(registry: Registry, id: string): Promise<void> {
  const entry = await registry.find(id);
  if (!entry) {
    console.error(error(`Instinct not found: ${id}`));
    process.exitCode = 1;
    return;
  }
  console.log(formatInstinctDetail(entry.instinct));
}

async function cmdApprove(registry: Registry, id: string): Promise<void> {
  try {
    const inst = await registry.approve(id);
    console.log(success(`Approved: ${inst.id} (confidence: ${inst.confidence})`));
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

async function cmdReject(registry: Registry, id: string): Promise<void> {
  try {
    const inst = await registry.reject(id);
    console.log(success(`Rejected: ${inst.id} (confidence: ${inst.confidence}, deactivated)`));
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

async function cmdTune(
  registry: Registry,
  id: string,
  flags: Record<string, string>,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (flags['confidence']) updates.confidence = parseFloat(flags['confidence']);
  if (flags['min-confidence']) updates.min_confidence = parseFloat(flags['min-confidence']);
  if (flags['rule']) updates.rule = flags['rule'];
  if (flags['active']) updates.active = flags['active'] === 'true';
  if (flags['tags']) updates.tags = flags['tags'].split(',').map((t) => t.trim());
  if (flags['triggers']) updates.trigger_patterns = flags['triggers'].split(',').map((t) => t.trim());

  if (Object.keys(updates).length === 0) {
    console.error(error('No tune parameters provided. Use --confidence, --min-confidence, --rule, --active, --tags, --triggers'));
    process.exitCode = 1;
    return;
  }

  try {
    const inst = await registry.tune(id, updates);
    console.log(success(`Tuned: ${inst.id}`));
    console.log(formatInstinctDetail(inst));
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

async function cmdOutcome(
  registry: Registry,
  id: string,
  resultSymbol: string,
  note?: string,
): Promise<void> {
  const resultMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
    '+': 'positive',
    '-': 'negative',
    '~': 'neutral',
  };
  const deltaMap: Record<string, number> = {
    '+': 0.05,
    '-': -0.1,
    '~': 0,
  };

  const result = resultMap[resultSymbol];
  const delta = deltaMap[resultSymbol];

  if (!result || delta === undefined) {
    console.error(error('Outcome must be + (positive), - (negative), or ~ (neutral)'));
    process.exitCode = 1;
    return;
  }

  try {
    const inst = await registry.recordOutcome(id, result, delta, note);
    console.log(success(`Recorded ${result} outcome for ${inst.id} (confidence: ${inst.confidence.toFixed(2)})`));
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

async function cmdRemove(registry: Registry, id: string): Promise<void> {
  try {
    await registry.remove(id);
    console.log(success(`Removed: ${id}`));
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

async function cmdImport(
  registry: Registry,
  storePath: string,
  sourcePath: string,
  flags: Record<string, string>,
): Promise<void> {
  try {
    const result = await registry.importFrom(sourcePath, {
      filename: flags['into'],
      dryRun: 'dry-run' in flags,
    });

    const prefix = result.dryRun ? 'Would import' : 'Imported';
    console.log(
      `${prefix} ${result.added.length} instinct(s) from ${result.source}`,
    );
    console.log(`  store:  ${storePath}`);
    console.log(`  target: ${result.target}`);

    if (result.repairs.length > 0) {
      console.log(warn(`  repaired source shape: ${result.repairs.length} fix(es)`));
    }
    for (const id of result.added) console.log(`  + ${id}`);
    if (result.skipped.length > 0) {
      console.log(
        warn(`  ${result.skipped.length} already in store (skipped): ${result.skipped.join(', ')}`),
      );
    }
    if (!result.dryRun && result.added.length > 0) {
      console.log(success('Merge complete.'));
    }
  } catch (e) {
    console.error(error(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

function cmdPath(store: { path: string; source: string }): void {
  console.log(store.path);
  console.error(`  resolved from: ${store.source}`);
  const warning = foreignGitTreeWarning(store.path);
  if (warning) console.error(warn(`  ${warning}`));
}

function cmdHelp(): void {
  console.log(`
\x1b[1mmcp-cp\x1b[0m — Instinct Approval Registry

\x1b[1mUsage:\x1b[0m
  mcp-cp list                                 List all instincts
  mcp-cp show <id>                            Show instinct details
  mcp-cp approve <id>                         Approve (human)
  mcp-cp reject <id>                          Reject & deactivate
  mcp-cp tune <id> [options]                  Tune parameters
  mcp-cp outcome <id> <+|-|~> [note]          Record outcome
  mcp-cp remove <id>                          Delete instinct
  mcp-cp import <file> [--into <name>]        Merge a YAML file into the store
                       [--dry-run]            (existing ids are never overwritten)
  mcp-cp path                                 Show the resolved store path

\x1b[1mTune options:\x1b[0m
  --confidence <0.0-1.0>       Set confidence
  --min-confidence <0.0-1.0>   Set minimum threshold
  --rule "text"                Update rule text
  --active true|false          Activate/deactivate
  --tags "a,b,c"               Set tags (comma-separated)
  --triggers "p1,p2"           Set trigger patterns

\x1b[1mOptions:\x1b[0m
  --path <dir>                 Instincts directory. Default resolution:
                               INSTINCTS_PATH, then ./instincts when run from
                               the mcp-context-provider checkout, then
                               $XDG_DATA_HOME/mcp-context-provider/instincts,
                               then ~/.local/share/mcp-context-provider/instincts
  --strict                     (list only) Exit non-zero if any instinct file fails to parse
  --help                       Show this help
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  if (command === 'help' || flags['help']) {
    cmdHelp();
    return;
  }

  const store = flags['path']
    ? { path: resolve(flags['path']), source: '--path' }
    : resolveInstinctsPath();
  const registry = new Registry(store.path);
  const id = positional[0] ?? '';

  if (command === 'path' || command === 'where') {
    cmdPath(store);
    return;
  }

  switch (command) {
    case 'list':
    case 'ls':
      await cmdList(registry, store, 'strict' in flags);
      break;

    case 'show':
    case 'inspect':
      if (!id) { console.error(error('Usage: mcp-cp show <id>')); process.exitCode = 1; break; }
      await cmdShow(registry, id);
      break;

    case 'approve':
      if (!id) { console.error(error('Usage: mcp-cp approve <id>')); process.exitCode = 1; break; }
      await cmdApprove(registry, id);
      break;

    case 'reject':
      if (!id) { console.error(error('Usage: mcp-cp reject <id>')); process.exitCode = 1; break; }
      await cmdReject(registry, id);
      break;

    case 'tune':
      if (!id) { console.error(error('Usage: mcp-cp tune <id> --confidence N ...')); process.exitCode = 1; break; }
      await cmdTune(registry, id, flags);
      break;

    case 'outcome':
      if (!id || !positional[1]) { console.error(error('Usage: mcp-cp outcome <id> <+|-|~> [note]')); process.exitCode = 1; break; }
      await cmdOutcome(registry, id, positional[1], positional.slice(2).join(' ') || undefined);
      break;

    case 'remove':
    case 'rm':
      if (!id) { console.error(error('Usage: mcp-cp remove <id>')); process.exitCode = 1; break; }
      await cmdRemove(registry, id);
      break;

    case 'import':
    case 'merge':
      if (!id) { console.error(error('Usage: mcp-cp import <file> [--into <name>] [--dry-run]')); process.exitCode = 1; break; }
      await cmdImport(registry, store.path, id, flags);
      break;

    default:
      console.error(error(`Unknown command: ${command}`));
      cmdHelp();
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(error(e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
