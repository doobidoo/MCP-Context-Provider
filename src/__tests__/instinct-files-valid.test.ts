import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { InstinctLoader } from '../engine/instinct-loader.js';

/**
 * CI guard for the YAML validity defect documented in
 * HANDOFF-learned-instincts-yaml-repair.md.
 *
 * Free-text fields (`rule`, `value`, `rationale`) written as plain (unquoted)
 * scalars break a strict parser when their text contains `": "` or a trailing
 * colon followed by an indented continuation line. The runtime writer
 * (`InstinctLoader.save` -> `yaml.stringify`) emits safe block/quoted scalars,
 * but hand-edits and the /instill fallback path can reintroduce the defect.
 *
 * These tests fail CI the moment any shipped `*.instincts.yaml` stops parsing,
 * so a silent injection-stopping parse failure can never ship unnoticed.
 */
const instinctsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../instincts');

const yamlFiles = readdirSync(instinctsDir).filter((f) => f.endsWith('.instincts.yaml'));

describe('shipped instinct YAML files are valid', () => {
  it('discovers at least one instinct file', () => {
    expect(yamlFiles.length).toBeGreaterThan(0);
  });

  it.each(yamlFiles)('%s parses under strict yaml.parse', async (file) => {
    const raw = await readFile(join(instinctsDir, file), 'utf-8');
    expect(() => parse(raw)).not.toThrow();
  });

  it.each(yamlFiles)('%s loads + validates through InstinctLoader', async (file) => {
    const loader = new InstinctLoader(instinctsDir);
    const loaded = await loader.load(file);
    expect(loaded.instincts).toBeDefined();
  });
});
