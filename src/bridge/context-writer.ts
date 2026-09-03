/**
 * Writes pulled contexts to disk. The only place in the codebase that does.
 *
 * The file name arrives from the memory service, which makes it untrusted
 * input to a filesystem write. It is validated as a basename, and the
 * resolved target is checked to still sit inside the contexts directory,
 * before anything is written. A `file_name` of "../../.ssh/authorized_keys"
 * must not be a way out of that directory, whatever put it there.
 *
 * Writes are atomic (temp file, then rename) and never silent: an existing
 * file is left alone unless `force` is set, and forcing keeps a `.bak`.
 */

import { copyFile, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { ContextSchema } from '../schema/context.schema.js';
import type { PulledContext } from './context-sync.js';

/** Context file names this writer accepts. Basename only, lowercase. */
export const VALID_CONTEXT_FILENAME = /^[a-z0-9][a-z0-9_-]*_context\.json$/;

export interface ContextWriteResult {
  /** File names written. */
  written: string[];
  /** File names not written, with the reason. */
  skipped: Array<{ fileName: string; reason: string }>;
}

export class ContextWriter {
  constructor(private readonly contextsPath: string) {}

  async write(
    pulled: PulledContext[],
    options: { force?: boolean } = {},
  ): Promise<ContextWriteResult> {
    const result: ContextWriteResult = { written: [], skipped: [] };
    const force = options.force === true;

    for (const item of pulled) {
      const skip = (reason: string): void => {
        result.skipped.push({ fileName: item.fileName, reason });
      };

      if (!VALID_CONTEXT_FILENAME.test(item.fileName)) {
        skip('invalid file name');
        continue;
      }

      const target = resolve(this.contextsPath, item.fileName);
      if (!target.startsWith(resolve(this.contextsPath) + sep)) {
        // Belt and braces: the regex already rules out separators.
        skip('invalid file name');
        continue;
      }

      if (!item.integrityOk) {
        skip('integrity check failed');
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(item.payload);
      } catch (e) {
        skip(`payload is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const validation = ContextSchema.safeParse(parsed);
      if (!validation.success) {
        skip(`payload failed schema validation: ${validation.error.issues[0]?.message ?? 'invalid'}`);
        continue;
      }

      const exists = await readFile(target, 'utf-8').then(
        () => true,
        () => false,
      );

      if (exists && !force) {
        skip('file exists (use force to overwrite)');
        continue;
      }

      if (exists) {
        await copyFile(target, `${target}.bak`);
      }

      const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
      try {
        await writeFile(tmp, item.payload, 'utf-8');
        await rename(tmp, target);
      } catch (e) {
        await unlink(tmp).catch(() => undefined);
        skip(`write failed: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      result.written.push(item.fileName);
    }

    return result;
  }
}
