import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { InstinctLoader } from '../engine/instinct-loader.js';

/**
 * Regression tests for issue #10:
 * /instill skill used to write top-level YAML arrays, which the strict Zod
 * schema silently rejected. The loader now detects AND auto-corrects those
 * files — converting shape, synthesizing missing ids, resolving collisions —
 * and can persist the canonical form back to disk with a `.bak` of the
 * original via `loader.repair(filename)`.
 */
describe('InstinctLoader — auto-repair', () => {
  let dir: string;
  let loader: InstinctLoader;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcp-cp-loader-'));
    loader = new InstinctLoader(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const validRule =
    'Always prefer named exports over default exports in TypeScript modules for clarity';

  const legacyArrayEntry = (id: string, domain = 'typescript') => `
- id: ${id}
  rule: "${validRule}"
  domain: ${domain}
  tags: [${domain}, style]
  trigger_patterns:
    - "export default"
  confidence: 0.8
  min_confidence: 0.5
  approved_by: human
  active: true
  outcome_log: []
`;

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('accepts canonical object form without repairs', async () => {
    const yaml = `
version: "1.0"
instincts:
  named-exports:
    id: named-exports
    rule: "${validRule}"
    domain: typescript
    tags: [typescript, style]
    trigger_patterns: ["export default"]
    confidence: 0.8
    min_confidence: 0.5
    approved_by: human
    active: true
    outcome_log: []
`;
    await writeFile(join(dir, 'canonical.instincts.yaml'), yaml);
    const { file, repairs } = await loader.loadWithRepairs(
      'canonical.instincts.yaml',
    );
    expect(file.version).toBe('1.0');
    expect(Object.keys(file.instincts)).toEqual(['named-exports']);
    expect(repairs).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Shape normalization
  // -------------------------------------------------------------------------

  it('normalizes legacy array form into object form (issue #10)', async () => {
    const yaml =
      legacyArrayEntry('named-exports') +
      legacyArrayEntry('prefer-const', 'javascript');
    await writeFile(join(dir, 'legacy.instincts.yaml'), yaml);

    const { file, repairs } = await loader.loadWithRepairs(
      'legacy.instincts.yaml',
    );

    expect(file.version).toBe('1.0');
    expect(Object.keys(file.instincts).sort()).toEqual([
      'named-exports',
      'prefer-const',
    ]);
    expect(repairs.some((r) => r.kind === 'shape_array_to_object')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // ID synthesis
  // -------------------------------------------------------------------------

  it('synthesizes kebab-case ids from rule text when missing', async () => {
    const yaml = `
- rule: "${validRule}"
  domain: typescript
  tags: [typescript]
  trigger_patterns: ["export default"]
  confidence: 0.8
  approved_by: human
`;
    await writeFile(join(dir, 'no-id.instincts.yaml'), yaml);
    const { file, repairs } = await loader.loadWithRepairs(
      'no-id.instincts.yaml',
    );

    // Slug: first 4 words of "Always prefer named exports..." → "always-prefer-named-exports"
    expect(Object.keys(file.instincts)).toEqual(['always-prefer-named-exports']);
    expect(repairs.some((r) => r.kind === 'id_synthesized')).toBe(true);
  });

  it('resolves id collisions with numeric suffixes', async () => {
    const yaml = `
- id: named-exports
  rule: "${validRule}"
  domain: typescript
  tags: [typescript]
  trigger_patterns: ["export default"]
  confidence: 0.8
  approved_by: human
- id: named-exports
  rule: "${validRule}"
  domain: javascript
  tags: [javascript]
  trigger_patterns: ["export default"]
  confidence: 0.7
  approved_by: human
`;
    await writeFile(join(dir, 'collision.instincts.yaml'), yaml);
    const { file, repairs } = await loader.loadWithRepairs(
      'collision.instincts.yaml',
    );

    expect(Object.keys(file.instincts).sort()).toEqual([
      'named-exports',
      'named-exports-2',
    ]);
    expect(repairs.some((r) => r.kind === 'id_collision_resolved')).toBe(true);
  });

  it('skips entries whose rule is too short to slug', async () => {
    const yaml = `
- rule: "a"
  domain: test
  tags: [test]
  trigger_patterns: ["x"]
  confidence: 0.8
  approved_by: human
- id: real-one
  rule: "${validRule}"
  domain: typescript
  tags: [typescript]
  trigger_patterns: ["export default"]
  confidence: 0.8
  approved_by: human
`;
    await writeFile(join(dir, 'short.instincts.yaml'), yaml);
    const { file, repairs } = await loader.loadWithRepairs(
      'short.instincts.yaml',
    );
    expect(Object.keys(file.instincts)).toEqual(['real-one']);
    expect(repairs.some((r) => r.kind === 'entry_skipped')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Content validation still enforced
  // -------------------------------------------------------------------------

  it('still rejects content-invalid instincts after shape repair', async () => {
    // Array form but the rule is too short (Zod: 5–120 token soft range)
    const yaml = `
- id: too-short
  rule: "tiny rule"
  domain: test
  tags: [test]
  trigger_patterns: ["x"]
  confidence: 0.8
  approved_by: human
`;
    await writeFile(join(dir, 'bad.instincts.yaml'), yaml);
    await expect(loader.load('bad.instincts.yaml')).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Persistent repair
  // -------------------------------------------------------------------------

  it('repair() writes canonical form + keeps .bak of original', async () => {
    const original = legacyArrayEntry('named-exports');
    await writeFile(join(dir, 'persist.instincts.yaml'), original);

    const repairs = await loader.repair('persist.instincts.yaml');
    expect(repairs.length).toBeGreaterThan(0);

    // .bak holds original text
    const bak = await readFile(join(dir, 'persist.instincts.yaml.bak'), 'utf-8');
    expect(bak).toBe(original);

    // New file is canonical object form
    const rewritten = await readFile(join(dir, 'persist.instincts.yaml'), 'utf-8');
    const parsed = parse(rewritten) as { version: string; instincts: Record<string, unknown> };
    expect(parsed.version).toBe('1.0');
    expect(Object.keys(parsed.instincts)).toEqual(['named-exports']);

    // Second repair is a no-op (already canonical)
    const second = await loader.repair('persist.instincts.yaml');
    expect(second).toEqual([]);
  });

  it('repair() is a no-op when file is already canonical (no .bak created)', async () => {
    const yaml = `
version: "1.0"
instincts:
  named-exports:
    id: named-exports
    rule: "${validRule}"
    domain: typescript
    tags: [typescript]
    trigger_patterns: ["export default"]
    confidence: 0.8
    min_confidence: 0.5
    approved_by: human
    active: true
    outcome_log: []
`;
    await writeFile(join(dir, 'clean.instincts.yaml'), yaml);
    const repairs = await loader.repair('clean.instincts.yaml');
    expect(repairs).toEqual([]);

    await expect(stat(join(dir, 'clean.instincts.yaml.bak'))).rejects.toThrow();
  });
});
