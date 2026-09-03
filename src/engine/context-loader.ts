/**
 * Load and validate context JSON files from disk.
 *
 * Discovers *_context.json files in a directory, validates them,
 * and returns a registry of loaded contexts.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ContextSchema } from '../schema/context.schema.js';
import type { Context, LoadedContextFile } from '../types/context.js';

const CONTEXT_FILE_PATTERN = /_context\.json$/;

export interface LoadResult {
  /** Successfully loaded contexts keyed by tool_category. */
  contexts: Map<string, Context>;

  /** The same contexts with their source file name and raw text. */
  files: LoadedContextFile[];

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
    const files: LoadedContextFile[] = [];
    const errors: LoadResult['errors'] = [];

    let dirEntries: string[];
    try {
      dirEntries = await readdir(this.basePath);
    } catch {
      return {
        contexts,
        files,
        errors: [{ file: this.basePath, error: 'Directory not found' }],
      };
    }

    const contextFiles = dirEntries.filter((f) => CONTEXT_FILE_PATTERN.test(f));

    // Load in parallel — individual failures don't block others
    const results = await Promise.allSettled(
      contextFiles.map(async (file) => {
        const { raw, context } = await this.loadFileWithSource(file);
        return { file, raw, context };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { file, raw, context } = result.value;
        contexts.set(context.tool_category, context);
        files.push({ fileName: file, raw, context });
      } else {
        const errorMsg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        const file = errorMsg.split(':')[0] ?? 'unknown';
        errors.push({ file, error: errorMsg });
      }
    }

    return { contexts, files, errors };
  }

  /**
   * Load and validate a single context JSON file.
   */
  async loadFile(filename: string): Promise<Context> {
    const { context } = await this.loadFileWithSource(filename);
    return context;
  }

  /**
   * Load, parse, and validate a single context JSON file, returning both
   * the exact raw text and the parsed context. The raw text is what the
   * memory-service sync payload needs — a re-serialisation of the parsed
   * object could differ in key order or whitespace.
   */
  async loadFileWithSource(
    filename: string,
  ): Promise<{ raw: string; context: Context }> {
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
      const context = ContextSchema.parse(parsed) as Context;
      return { raw, context };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      throw new Error(`${filename}: ${msg}`);
    }
  }
}
