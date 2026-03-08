/**
 * Terminal output formatting for the Approval Registry CLI.
 */

import type { Instinct } from '../types/instinct.js';

// ---------------------------------------------------------------------------
// Colors (ANSI escape codes — no dependency needed)
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceBar(value: number, width = 20): string {
  const filled = Math.round(value * width);
  const empty = width - filled;
  const color = value >= 0.7 ? c.green : value >= 0.4 ? c.yellow : c.red;
  return `${color}${'█'.repeat(filled)}${c.gray}${'░'.repeat(empty)}${c.reset} ${(value * 100).toFixed(0)}%`;
}

function badge(text: string, color: string): string {
  return `${color}[${text}]${c.reset}`;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatInstinctRow(inst: Instinct): string {
  const status = inst.active !== false ? badge('active', c.green) : badge('dormant', c.gray);
  const approval = inst.approved_by === 'human' ? badge('human', c.cyan) : badge('auto', c.yellow);
  const conf = confidenceBar(inst.confidence);

  return [
    `  ${c.bold}${inst.id}${c.reset}`,
    `    ${c.dim}domain:${c.reset} ${inst.domain}  ${c.dim}tags:${c.reset} ${inst.tags.join(', ')}`,
    `    ${c.dim}confidence:${c.reset} ${conf}  ${c.dim}min:${c.reset} ${inst.min_confidence}  ${c.dim}uses:${c.reset} ${inst.usage_count}`,
    `    ${status} ${approval}  ${c.dim}outcomes:${c.reset} ${inst.outcome_log.length}`,
    `    ${c.dim}rule:${c.reset} ${c.gray}${truncate(inst.rule, 80)}${c.reset}`,
  ].join('\n');
}

export function formatInstinctDetail(inst: Instinct): string {
  const lines = [
    `${c.bold}${c.cyan}═══ ${inst.id} ═══${c.reset}`,
    '',
    `${c.bold}Rule:${c.reset}`,
    `  ${inst.rule}`,
    '',
    `${c.bold}Domain:${c.reset}      ${inst.domain}`,
    `${c.bold}Tags:${c.reset}        ${inst.tags.join(', ')}`,
    `${c.bold}Triggers:${c.reset}    ${inst.trigger_patterns.join(', ')}`,
    '',
    `${c.bold}Confidence:${c.reset}  ${confidenceBar(inst.confidence)}`,
    `${c.bold}Min:${c.reset}         ${inst.min_confidence}`,
    `${c.bold}Uses:${c.reset}        ${inst.usage_count}`,
    `${c.bold}Approved:${c.reset}    ${inst.approved_by}`,
    `${c.bold}Active:${c.reset}      ${inst.active !== false ? 'yes' : 'no'}`,
  ];

  if (inst.created_at) {
    lines.push(`${c.bold}Created:${c.reset}     ${inst.created_at}`);
  }

  if (inst.outcome_log.length > 0) {
    lines.push('', `${c.bold}Outcome Log:${c.reset} (${inst.outcome_log.length} entries)`);
    for (const entry of inst.outcome_log.slice(-5)) {
      const icon = entry.result === 'positive' ? '✓' : entry.result === 'negative' ? '✗' : '·';
      const delta = entry.delta_confidence >= 0 ? `+${entry.delta_confidence}` : `${entry.delta_confidence}`;
      const color = entry.result === 'positive' ? c.green : entry.result === 'negative' ? c.red : c.gray;
      lines.push(`  ${color}${icon}${c.reset} ${entry.timestamp.slice(0, 10)}  ${delta}  ${entry.note ?? ''}`);
    }
  }

  return lines.join('\n');
}

export function formatSummary(instincts: Instinct[]): string {
  const active = instincts.filter((i) => i.active !== false).length;
  const humanApproved = instincts.filter((i) => i.approved_by === 'human').length;
  const avgConf = instincts.length > 0
    ? instincts.reduce((s, i) => s + i.confidence, 0) / instincts.length
    : 0;

  return [
    `${c.bold}Instinct Registry${c.reset}`,
    `  ${c.dim}total:${c.reset} ${instincts.length}  ${c.dim}active:${c.reset} ${active}  ${c.dim}human-approved:${c.reset} ${humanApproved}`,
    `  ${c.dim}avg confidence:${c.reset} ${confidenceBar(avgConf)}`,
  ].join('\n');
}

export function success(msg: string): string {
  return `${c.green}✓${c.reset} ${msg}`;
}

export function error(msg: string): string {
  return `${c.red}✗${c.reset} ${msg}`;
}

export function warn(msg: string): string {
  return `${c.yellow}⚠${c.reset} ${msg}`;
}

function truncate(text: string, maxLen: number): string {
  const oneLine = text.replace(/\n/g, ' ').trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen - 1)}…` : oneLine;
}
