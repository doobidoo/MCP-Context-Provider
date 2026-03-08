/**
 * Approval Registry — manages instinct lifecycle.
 *
 * Handles approve, reject, tune, and list operations
 * against the YAML instinct files on disk.
 */

import { readdir } from 'node:fs/promises';
import { InstinctLoader } from '../engine/instinct-loader.js';
import type { Instinct, InstinctFile, OutcomeEntry } from '../types/instinct.js';

export interface RegistryEntry {
  file: string;
  instinct: Instinct;
}

export class Registry {
  private readonly loader: InstinctLoader;

  constructor(private readonly instinctsPath: string) {
    this.loader = new InstinctLoader(instinctsPath);
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  /** Load all instincts from all YAML files. */
  async listAll(): Promise<RegistryEntry[]> {
    const entries: RegistryEntry[] = [];
    const files = await this.yamlFiles();

    for (const file of files) {
      try {
        const instinctFile = await this.loader.load(file);
        for (const instinct of Object.values(instinctFile.instincts)) {
          entries.push({ file, instinct });
        }
      } catch {
        // Skip invalid files
      }
    }

    return entries;
  }

  /** Find a specific instinct by ID across all files. */
  async find(id: string): Promise<{ file: string; instinctFile: InstinctFile; instinct: Instinct } | null> {
    const files = await this.yamlFiles();

    for (const file of files) {
      try {
        const instinctFile = await this.loader.load(file);
        const instinct = instinctFile.instincts[id];
        if (instinct) {
          return { file, instinctFile, instinct };
        }
      } catch {
        // Skip
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  /** Approve an instinct: set approved_by to 'human', activate it. */
  async approve(id: string): Promise<Instinct> {
    const entry = await this.find(id);
    if (!entry) throw new Error(`Instinct not found: ${id}`);

    const { file, instinctFile, instinct } = entry;
    instinct.approved_by = 'human';
    instinct.active = true;
    instinct.updated_at = new Date().toISOString();

    instinctFile.instincts[id] = instinct;
    await this.loader.save(file, instinctFile);

    return instinct;
  }

  /** Reject an instinct: deactivate and drop confidence. */
  async reject(id: string): Promise<Instinct> {
    const entry = await this.find(id);
    if (!entry) throw new Error(`Instinct not found: ${id}`);

    const { file, instinctFile, instinct } = entry;
    instinct.active = false;
    instinct.confidence = Math.max(0, instinct.confidence - 0.3);
    // Ensure min_confidence doesn't exceed new confidence (Zod invariant)
    instinct.min_confidence = Math.min(instinct.min_confidence, instinct.confidence);
    instinct.updated_at = new Date().toISOString();

    // Record rejection in outcome_log
    const outcome: OutcomeEntry = {
      timestamp: new Date().toISOString(),
      result: 'negative',
      delta_confidence: -0.3,
      note: 'Rejected via CLI',
    };
    instinct.outcome_log.push(outcome);

    instinctFile.instincts[id] = instinct;
    await this.loader.save(file, instinctFile);

    return instinct;
  }

  /** Tune an instinct's parameters. */
  async tune(
    id: string,
    updates: {
      confidence?: number;
      min_confidence?: number;
      rule?: string;
      tags?: string[];
      trigger_patterns?: string[];
      active?: boolean;
    },
  ): Promise<Instinct> {
    const entry = await this.find(id);
    if (!entry) throw new Error(`Instinct not found: ${id}`);

    const { file, instinctFile, instinct } = entry;

    if (updates.confidence !== undefined) instinct.confidence = updates.confidence;
    if (updates.min_confidence !== undefined) instinct.min_confidence = updates.min_confidence;
    if (updates.rule !== undefined) instinct.rule = updates.rule;
    if (updates.tags !== undefined) instinct.tags = updates.tags;
    if (updates.trigger_patterns !== undefined) instinct.trigger_patterns = updates.trigger_patterns;
    if (updates.active !== undefined) instinct.active = updates.active;

    instinct.updated_at = new Date().toISOString();

    instinctFile.instincts[id] = instinct;
    await this.loader.save(file, instinctFile);

    return instinct;
  }

  /** Delete an instinct entirely. */
  async remove(id: string): Promise<void> {
    const entry = await this.find(id);
    if (!entry) throw new Error(`Instinct not found: ${id}`);

    const { file, instinctFile } = entry;
    delete instinctFile.instincts[id];

    await this.loader.save(file, instinctFile);
  }

  /** Record an outcome for an instinct. */
  async recordOutcome(
    id: string,
    result: 'positive' | 'negative' | 'neutral',
    delta: number,
    note?: string,
  ): Promise<Instinct> {
    const entry = await this.find(id);
    if (!entry) throw new Error(`Instinct not found: ${id}`);

    const { file, instinctFile, instinct } = entry;

    const outcome: OutcomeEntry = {
      timestamp: new Date().toISOString(),
      result,
      delta_confidence: delta,
      note,
    };
    instinct.outcome_log.push(outcome);
    instinct.confidence = Math.max(0, Math.min(1, instinct.confidence + delta));
    instinct.updated_at = new Date().toISOString();

    instinctFile.instincts[id] = instinct;
    await this.loader.save(file, instinctFile);

    return instinct;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async yamlFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.instinctsPath);
      return files.filter((f) => f.endsWith('.instincts.yaml'));
    } catch {
      return [];
    }
  }
}
