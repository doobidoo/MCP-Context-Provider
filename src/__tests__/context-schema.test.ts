import { describe, it, expect } from 'vitest';
import { ContextSchema, ContextMetadataSchema, StoreTriggerSchema } from '../schema/context.schema.js';

describe('ContextMetadataSchema', () => {
  it('accepts valid metadata', () => {
    const meta = {
      version: '1.0.0',
      applies_to_tools: ['git:*'],
      priority: 'high' as const,
    };
    expect(ContextMetadataSchema.safeParse(meta).success).toBe(true);
  });

  it('rejects empty applies_to_tools', () => {
    const bad = { version: '1.0.0', applies_to_tools: [] };
    expect(ContextMetadataSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts valid inheritance values', () => {
    const meta = {
      version: '1.0.0',
      applies_to_tools: ['*'],
      inheritance: 'fallback_for_unspecified_tools' as const,
    };
    expect(ContextMetadataSchema.safeParse(meta).success).toBe(true);
  });
});

describe('StoreTriggerSchema', () => {
  it('accepts valid store trigger', () => {
    const trigger = {
      patterns: ['git commit', 'git push'],
      action: 'store_with_metadata',
      tags: ['git', 'version-control'],
      priority: 'high' as const,
      confidence_threshold: 0.8,
    };
    expect(StoreTriggerSchema.safeParse(trigger).success).toBe(true);
  });

  it('rejects empty patterns', () => {
    const bad = { patterns: [], action: 'store', tags: ['git'] };
    expect(StoreTriggerSchema.safeParse(bad).success).toBe(false);
  });
});

describe('ContextSchema', () => {
  const validContext = {
    tool_category: 'git',
    description: 'Git-specific context rules',
    auto_convert: true,
    metadata: {
      version: '1.0.0',
      applies_to_tools: ['git:*', 'bash:git'],
    },
  };

  it('accepts a minimal valid context', () => {
    expect(ContextSchema.safeParse(validContext).success).toBe(true);
  });

  it('defaults auto_convert to false', () => {
    const noConvert = { ...validContext, auto_convert: undefined };
    const result = ContextSchema.safeParse(noConvert);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auto_convert).toBe(false);
    }
  });

  it('accepts context with triggers', () => {
    const withTriggers = {
      ...validContext,
      auto_store_triggers: {
        git_commands: {
          patterns: ['git add', 'git commit'],
          action: 'store_with_metadata',
          tags: ['git'],
        },
      },
      auto_retrieve_triggers: {
        git_help: {
          patterns: ['how to.*git'],
          action: 'search_and_suggest',
          search_tags: ['git'],
        },
      },
    };
    expect(ContextSchema.safeParse(withTriggers).success).toBe(true);
  });

  it('accepts context with auto_corrections', () => {
    const withCorrections = {
      ...validContext,
      auto_corrections: {
        fix_prefix: {
          pattern: '^(Fix|FIX)\\s*:?\\s*(.+)',
          replacement: 'fix: $2',
        },
      },
    };
    expect(ContextSchema.safeParse(withCorrections).success).toBe(true);
  });

  it('passes through unknown domain-specific sections', () => {
    const withCustom = {
      ...validContext,
      workflow_patterns: { gitflow: { main_branches: ['main'] } },
      best_practices: { commits: { atomic: true } },
      custom_section: { foo: 'bar' },
    };
    const result = ContextSchema.safeParse(withCustom);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_section).toEqual({ foo: 'bar' });
    }
  });

  it('rejects missing tool_category', () => {
    const { tool_category: _, ...bad } = validContext;
    expect(ContextSchema.safeParse(bad).success).toBe(false);
  });
});
