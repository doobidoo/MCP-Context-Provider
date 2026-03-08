/**
 * Load and validate instinct YAML files from disk.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { InstinctFileSchema } from '../schema/instinct.schema.js';
import type { Instinct, InstinctFile } from '../types/instinct.js';

export class InstinctLoader {
  constructor(private readonly basePath: string) {}

  /**
   * Load and validate an instinct YAML file.
   * Throws ZodError on validation failure.
   */
  async load(filename: string): Promise<InstinctFile> {
    const filepath = `${this.basePath}/${filename}`;
    const raw = await readFile(filepath, 'utf-8');
    const parsed: unknown = parse(raw);
    return InstinctFileSchema.parse(parsed);
  }

  /**
   * Save an instinct file to disk as YAML.
   */
  async save(filename: string, file: InstinctFile): Promise<void> {
    const filepath = `${this.basePath}/${filename}`;
    const validated = InstinctFileSchema.parse(file);
    const yamlStr = stringify(validated, { lineWidth: 100 });
    await writeFile(filepath, yamlStr, 'utf-8');
  }

  /**
   * Append a new instinct to an existing file (or create if missing).
   */
  async append(filename: string, instinct: Instinct): Promise<InstinctFile> {
    let file: InstinctFile;
    try {
      file = await this.load(filename);
    } catch {
      file = { version: '1.0', instincts: {} };
    }

    file.instincts[instinct.id] = instinct;
    await this.save(filename, file);
    return file;
  }
}
