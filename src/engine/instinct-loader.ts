/**
 * Load and validate instinct YAML files from disk.
 *
 * Resilient loader: accepts both the canonical `{version, instincts}` object
 * form and legacy top-level arrays produced by earlier versions of the
 * `/instill` skill (see issue #10). When a malformed but recoverable file is
 * encountered the loader auto-corrects in memory, tracks every change in a
 * `RepairAction[]` report, and — via `repair(filename)` — can persist the
 * canonical form back to disk with a `.bak` copy of the original.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { InstinctFileSchema } from '../schema/instinct.schema.js';
import type { Instinct, InstinctFile } from '../types/instinct.js';

// ---------------------------------------------------------------------------
// Repair reporting
// ---------------------------------------------------------------------------

export type RepairKind =
  | 'shape_array_to_object'
  | 'id_synthesized'
  | 'id_collision_resolved'
  | 'entry_skipped';

export interface RepairAction {
  kind: RepairKind;
  detail: string;
}

export interface LoadResult {
  file: InstinctFile;
  repairs: RepairAction[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export class InstinctLoader {
  constructor(private readonly basePath: string) {}

  /**
   * Load and validate an instinct YAML file.
   * Silently auto-corrects shape issues; throws on unrecoverable content
   * errors. Use `loadWithRepairs()` if you need the repair report.
   */
  async load(filename: string): Promise<InstinctFile> {
    const { file } = await this.loadWithRepairs(filename);
    return file;
  }

  /**
   * Load + validate + return the repair report describing every auto-fix
   * applied during shape normalization.
   */
  async loadWithRepairs(filename: string): Promise<LoadResult> {
    const filepath = `${this.basePath}/${filename}`;
    const raw = await readFile(filepath, 'utf-8');
    const parsed: unknown = parse(raw);
    const repairs: RepairAction[] = [];
    const normalized = this.normalizeShape(parsed, repairs);
    const file = InstinctFileSchema.parse(normalized);
    return { file, repairs };
  }

  /**
   * Load a file, apply repairs, and if any were needed, persist the canonical
   * form back to disk after making a `.bak` copy of the original. Returns the
   * list of repair actions performed (empty array if nothing needed fixing).
   */
  async repair(filename: string): Promise<RepairAction[]> {
    const { file, repairs } = await this.loadWithRepairs(filename);
    if (repairs.length === 0) return [];

    const filepath = `${this.basePath}/${filename}`;
    const raw = await readFile(filepath, 'utf-8');
    await writeFile(`${filepath}.bak`, raw, 'utf-8');
    await this.save(filename, file);
    return repairs;
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

  // -------------------------------------------------------------------------
  // Internals — shape normalization
  // -------------------------------------------------------------------------

  /**
   * Normalize legacy array-form YAML into the canonical object form.
   * Mutates `repairs` with a record of every fix applied.
   *
   * Legacy files from earlier `/instill` versions look like:
   *   - id: foo
   *     rule: ...
   *   - id: bar
   *     rule: ...
   *
   * We convert to:
   *   version: "1.0"
   *   instincts:
   *     foo: { id: foo, rule: ... }
   *     bar: { id: bar, rule: ... }
   *
   * Entries missing an `id` get one synthesized from the first few words of
   * their rule text. Collisions are resolved with a numeric suffix.
   */
  private normalizeShape(parsed: unknown, repairs: RepairAction[]): unknown {
    if (!Array.isArray(parsed)) return parsed;

    repairs.push({
      kind: 'shape_array_to_object',
      detail: `converted top-level array (${parsed.length} entries) to object form`,
    });

    const instincts: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < parsed.length; i++) {
      const raw = parsed[i];
      if (!raw || typeof raw !== 'object') {
        repairs.push({
          kind: 'entry_skipped',
          detail: `array[${i}]: not an object`,
        });
        continue;
      }
      const entry = raw as Record<string, unknown>;

      let id = typeof entry.id === 'string' ? entry.id.trim() : '';

      if (!id) {
        const synthesized = this.synthesizeId(entry, instincts);
        if (!synthesized) {
          repairs.push({
            kind: 'entry_skipped',
            detail: `array[${i}]: missing id and rule text insufficient to synthesize one`,
          });
          continue;
        }
        entry.id = synthesized;
        id = synthesized;
        repairs.push({
          kind: 'id_synthesized',
          detail: `array[${i}] → '${synthesized}'`,
        });
      } else if (instincts[id]) {
        const resolved = this.resolveCollision(id, instincts);
        entry.id = resolved;
        repairs.push({
          kind: 'id_collision_resolved',
          detail: `'${id}' → '${resolved}'`,
        });
        id = resolved;
      }

      instincts[id] = entry;
    }

    return { version: '1.0', instincts };
  }

  /**
   * Build a kebab-case id from the first few words of an entry's rule text.
   * Returns empty string if no usable slug can be produced (too short, no
   * alphanumerics). Handles collisions via `resolveCollision()`.
   */
  private synthesizeId(
    entry: Record<string, unknown>,
    existing: Record<string, unknown>,
  ): string {
    const rule = typeof entry.rule === 'string' ? entry.rule : '';
    if (!rule) return '';

    const slug = rule
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join('-')
      .replace(/^-+|-+$/g, '');

    // kebab-case schema requires 2+ chars, starting/ending alphanumeric
    if (slug.length < 2) return '';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return '';

    if (!existing[slug]) return slug;
    return this.resolveCollision(slug, existing);
  }

  private resolveCollision(
    id: string,
    existing: Record<string, unknown>,
  ): string {
    let n = 2;
    while (existing[`${id}-${n}`]) n++;
    return `${id}-${n}`;
  }
}
