/**
 * Load and validate context JSON files from disk.
 *
 * Discovers *_context.json files in a directory, validates them,
 * and returns a registry of loaded contexts.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ContextSchema } from '../schema/context.schema.js';
import type { Context } from '../types/context.js';

const CONTEXT_FILE_PATTERN = /_context\.json$/;

export interface LoadResult {
  /** Successfully loaded contexts keyed by tool_category. */
  contexts: Map<string, Context>;

  /** Files that failed to load, with error details. */
  errors: Array<{ file: string; error: string }>;
}

export class ContextLoader {
  constructor(private readonly basePath: string) {}

  /**
   * Discover and load all *_context.json files in the base directory.
   * Returns successfully loaded contexts and any errors encountered.
   */
  async loadAll(): Promise<LoadResult> {
    const contexts = new Map<string, Context>();
    const errors: LoadResult['errors'] = [];

    let files: string[];
    try {
      files = await readdir(this.basePath);
    } catch {
      return { contexts, errors: [{ file: this.basePath, error: 'Directory not found' }] };
    }

    const contextFiles = files.filter((f) => CONTEXT_FILE_PATTERN.test(f));

    // Load in parallel — individual failures don't block others
    const results = await Promise.allSettled(
      contextFiles.map(async (file) => {
        const context = await this.loadFile(file);
        return { file, context };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { context } = result.value;
        contexts.set(context.tool_category, context);
      } else {
        // Extract filename from error if possible
        const errorMsg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ file: 'unknown', error: errorMsg });
      }
    }

    return { contexts, errors };
  }

  /**
   * Load and validate a single context JSON file.
   */
  async loadFile(filename: string): Promise<Context> {
    const filepath = join(this.basePath, filename);
    const raw = await readFile(filepath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      throw new Error(`${filename}: ${msg}`);
    }

    try {
      return ContextSchema.parse(parsed) as Context;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      throw new Error(`${filename}: ${msg}`);
    }
  }
}
