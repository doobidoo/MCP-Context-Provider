/**
 * Writes pulled contexts to disk. The only place in the codebase that does.
 *
 * The file name arrives from the memory service, which makes it untrusted
 * input to a filesystem write. It is validated as a basename, and the
 * resolved target is checked to still sit inside the contexts directory,
 * before anything is written. A `file_name` of "../../.ssh/authorized_keys"
 * must not be a way out of that directory, whatever put it there.
 *
 * Writes are atomic (temp file, then rename or link) and never silent: an
 * existing file is left alone unless `force` is set, and forcing keeps a
 * `.bak`. "Existing" includes a file that cannot be read and a file another
 * restore created a moment ago; neither is replaced without `force`.
 *
 * The pulled list is attacker-supplied too, not just each item's file name:
 * a repeated `fileName` within one call is rejected once an earlier
 * occurrence of that name has actually been written, so a duplicate can
 * never overwrite the `.bak` that holds the original local content. A name
 * is claimed only on success — an earlier occurrence that failed validation
 * or was skipped for existing-without-force leaves the name unclaimed, so a
 * later, valid occurrence of the same name is still evaluated normally
 * rather than silently dropped as a "duplicate". A `fileName` that is not a
 * string at runtime (regex `.test()` coerces via `String()`, so a crafted
 * object could otherwise slip past it) is rejected before anything touches
 * the path resolver, so one bad item cannot abort the whole batch.
 */

import { randomUUID } from 'node:crypto';
import { copyFile, link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { ContextSchema } from '../schema/context.schema.js';
import type { PulledContext } from './context-sync.js';

/** Context file names this writer accepts. Basename only, lowercase. */
export const VALID_CONTEXT_FILENAME = /^[a-z0-9][a-z0-9_-]*_context\.json$/;

/** What to call a version that is missing or not a string. */
function displayVersion(version: unknown): string {
  return typeof version === 'string' && version !== '' ? version : 'unknown';
}

/**
 * `metadata.version` of a context file already on disk, for a conflict
 * report. The local file is whatever happens to sit there — possibly not
 * JSON at all — so every failure path lands on "unknown" rather than
 * throwing: a conflict must still be reportable when the local file is
 * unreadable.
 */
function localVersion(text: string): string {
  try {
    const parsed = JSON.parse(text) as { metadata?: { version?: unknown } };
    return displayVersion(parsed?.metadata?.version);
  } catch {
    return 'unknown';
  }
}

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
    const handled = new Set<string>();

    for (const item of pulled) {
      const skip = (reason: string): void => {
        result.skipped.push({ fileName: item.fileName, reason });
      };

      if (typeof item.fileName !== 'string') {
        // RegExp#test coerces its argument via String(), so a crafted
        // object could otherwise pass the regex below and reach
        // path.resolve(), which throws on a non-string and would abort the
        // whole batch instead of just this item.
        skip('invalid file name');
        continue;
      }

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

      if (handled.has(item.fileName)) {
        skip('duplicate file name in this batch');
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

      // The written file is injected into sessions as instructions, and the
      // engine keys a context by its `tool_category`, not by its file name.
      // The no-overwrite guard above is keyed on the file name, so without
      // this a memory carrying any fresh, valid `file_name` would be written
      // and then injected under whatever category it declares inside. A
      // context that claims to be one thing and contains another is not
      // something to write.
      const declared = validation.data.tool_category;
      if (declared !== item.category) {
        skip(
          `payload declares tool_category "${declared}" but the memory records category "${item.category}"`,
        );
        continue;
      }

      // Keep the text: a conflict has to report the local version, and
      // reading the file twice would be a second chance to disagree.
      // Only ENOENT means "not there". Anything else — no permission, a
      // directory, a symlink loop — is a file this writer cannot see into,
      // and replacing it would skip both the force check and the .bak.
      let existingText: string | null;
      try {
        existingText = await readFile(target, 'utf-8');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          skip(`cannot read existing file: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        existingText = null;
      }
      const exists = existingText !== null;

      if (existingText !== null && !force) {
        skip(
          `file exists (local version ${localVersion(existingText)}, remote version ${displayVersion(item.version)}; use force to overwrite)`,
        );
        continue;
      }

      // pid plus a timestamp is not unique: two restores in one process
      // within the same millisecond would share a temp file.
      const tmp = `${target}.tmp-${randomUUID()}`;
      try {
        // CONTEXTS_PATH on a new machine may not exist yet.
        await mkdir(dirname(target), { recursive: true });
        if (exists) {
          await copyFile(target, `${target}.bak`);
        }
        await writeFile(tmp, item.payload, 'utf-8');
        if (force) {
          await rename(tmp, target);
        } else {
          // rename() replaces whatever is there, so a file another restore
          // created since the read above would be overwritten without force.
          // link() fails with EEXIST instead, atomically.
          // shortcut: needs hard links; on a filesystem without them (FAT,
          // some network mounts) an unforced restore reports "write failed".
          // Fall back to an exclusive open if that ever matters.
          await link(tmp, target);
          await unlink(tmp);
        }
      } catch (e) {
        await unlink(tmp).catch(() => undefined);
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
          skip('file appeared while restoring; use force to overwrite');
        } else {
          skip(`write failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        continue;
      }

      handled.add(item.fileName);
      result.written.push(item.fileName);
    }

    return result;
  }
}
