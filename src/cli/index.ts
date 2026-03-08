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
 */

import { resolve } from 'node:path';
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

async function cmdList(registry: Registry): Promise<void> {
  const entries = await registry.listAll();

  if (entries.length === 0) {
    console.log(warn('No instincts found. Use /instill to extract some.'));
    return;
  }

  const instincts = entries.map((e) => e.instinct);
  console.log(formatSummary(instincts));
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

\x1b[1mTune options:\x1b[0m
  --confidence <0.0-1.0>       Set confidence
  --min-confidence <0.0-1.0>   Set minimum threshold
  --rule "text"                Update rule text
  --active true|false          Activate/deactivate
  --tags "a,b,c"               Set tags (comma-separated)
  --triggers "p1,p2"           Set trigger patterns

\x1b[1mOptions:\x1b[0m
  --path <dir>                 Instincts directory (default: ./instincts)
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

  const instinctsPath = resolve(flags['path'] ?? './instincts');
  const registry = new Registry(instinctsPath);
  const id = positional[0] ?? '';

  switch (command) {
    case 'list':
    case 'ls':
      await cmdList(registry);
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
