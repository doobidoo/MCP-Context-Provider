/**
 * MCP tool registrations.
 *
 * Each tool is a thin wrapper that delegates to the Engine or Registry,
 * serializes the result as JSON, and returns it as MCP text content.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Engine } from '../engine/engine.js';
import type { Registry } from '../cli/registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAllTools(
  server: McpServer,
  engine: Engine,
  registry: Registry,
): void {
  // -----------------------------------------------------------------------
  // Core Query Tools
  // -----------------------------------------------------------------------

  server.tool(
    'build_injection',
    'Build a complete injection payload of context rules and instinct rules for a given tool and input.',
    {
      tool: z.string().describe('Tool name or pattern (e.g. "git:commit", "bash")'),
      input: z.string().default('').describe('Input text to match instincts against'),
    },
    async ({ tool, input }) => {
      try {
        return ok(engine.buildInjection(tool, input));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'match_contexts',
    'Find all contexts whose applies_to_tools patterns match a given tool.',
    {
      tool: z.string().describe('Tool name to match against context patterns'),
      categories: z.array(z.string()).optional().describe('Filter by specific categories'),
      min_priority: z.enum(['high', 'medium', 'low']).optional().describe('Minimum priority filter'),
    },
    async ({ tool, categories, min_priority }) => {
      try {
        return ok(engine.matchContexts({ tool, categories, min_priority }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'match_instincts',
    'Find all instincts whose trigger patterns match a given input text.',
    {
      input: z.string().describe('Input text to match against instinct triggers'),
      domains: z.array(z.string()).optional().describe('Filter by domains'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      min_confidence: z.number().min(0).max(1).optional().describe('Minimum confidence threshold'),
    },
    async ({ input, domains, tags, min_confidence }) => {
      try {
        return ok(engine.matchInstincts({ input, domains, tags, min_confidence }));
      } catch (e) { return err(e); }
    },
  );

  // -----------------------------------------------------------------------
  // Read / List Tools
  // -----------------------------------------------------------------------

  server.tool(
    'list_contexts',
    'List all loaded context categories with their descriptions and tool patterns.',
    {},
    async () => {
      try {
        const summaries = [...engine.getContexts().values()].map((c) => ({
          tool_category: c.tool_category,
          description: c.description,
          applies_to_tools: c.metadata?.applies_to_tools ?? [],
          priority: c.metadata?.priority ?? 'medium',
        }));
        return ok(summaries);
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'get_context',
    'Get the full context definition for a specific tool category.',
    {
      category: z.string().describe('The tool_category to look up'),
    },
    async ({ category }) => {
      try {
        const ctx = engine.getContext(category);
        if (!ctx) return err(new Error(`Context not found: ${category}`));
        return ok(ctx);
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'list_instincts',
    'List all loaded instincts with their IDs, domains, confidence, and active status.',
    {},
    async () => {
      try {
        const instincts = engine.getAllInstincts().map((i) => ({
          id: i.id,
          rule: i.rule,
          domain: i.domain,
          tags: i.tags,
          confidence: i.confidence,
          active: i.active,
          approved_by: i.approved_by,
          usage_count: i.usage_count,
        }));
        return ok(instincts);
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'get_auto_corrections',
    'Get all auto-correction rules that apply to a given tool.',
    {
      tool: z.string().describe('Tool name to get corrections for'),
    },
    async ({ tool }) => {
      try {
        return ok(engine.getAutoCorrections(tool));
      } catch (e) { return err(e); }
    },
  );

  // -----------------------------------------------------------------------
  // Instinct Registry Tools
  // -----------------------------------------------------------------------

  server.tool(
    'instinct_approve',
    'Approve an instinct for use (sets approved_by to human, activates it).',
    {
      id: z.string().describe('Instinct ID (kebab-case)'),
    },
    async ({ id }) => {
      try {
        return ok(await registry.approve(id));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'instinct_reject',
    'Reject an instinct (deactivates it, reduces confidence by 0.3).',
    {
      id: z.string().describe('Instinct ID (kebab-case)'),
    },
    async ({ id }) => {
      try {
        return ok(await registry.reject(id));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'instinct_tune',
    'Tune an instinct\'s parameters (confidence, rule text, tags, etc.).',
    {
      id: z.string().describe('Instinct ID (kebab-case)'),
      confidence: z.number().min(0).max(1).optional().describe('New confidence value'),
      min_confidence: z.number().min(0).max(1).optional().describe('New minimum confidence threshold'),
      rule: z.string().optional().describe('Updated rule text'),
      tags: z.array(z.string()).optional().describe('Updated tags'),
      trigger_patterns: z.array(z.string()).optional().describe('Updated trigger patterns'),
      active: z.boolean().optional().describe('Set active status'),
    },
    async ({ id, ...updates }) => {
      try {
        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined),
        );
        return ok(await registry.tune(id, cleanUpdates));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'instinct_outcome',
    'Record an outcome for an instinct, adjusting its confidence score.',
    {
      id: z.string().describe('Instinct ID (kebab-case)'),
      result: z.enum(['positive', 'negative', 'neutral']).describe('Outcome result'),
      delta: z.number().min(-1).max(1).describe('Confidence delta to apply'),
      note: z.string().optional().describe('Optional note about the outcome'),
    },
    async ({ id, result, delta, note }) => {
      try {
        return ok(await registry.recordOutcome(id, result, delta, note));
      } catch (e) { return err(e); }
    },
  );

  // -----------------------------------------------------------------------
  // Memory Bridge Tools (conditional)
  // -----------------------------------------------------------------------

  if (engine.isMemoryConnected()) {
    server.tool(
      'memory_sync',
      'Sync all local instincts to the memory service.',
      {},
      async () => {
        try {
          return ok(await engine.syncToMemory());
        } catch (e) { return err(e); }
      },
    );

    server.tool(
      'memory_discover',
      'Search the memory service for instincts semantically related to input text.',
      {
        input: z.string().describe('Semantic search query'),
        limit: z.number().default(5).describe('Max results to return'),
      },
      async ({ input, limit }) => {
        try {
          return ok(await engine.discoverInstincts(input, limit));
        } catch (e) { return err(e); }
      },
    );
  }

  // -----------------------------------------------------------------------
  // Server Info
  // -----------------------------------------------------------------------

  server.tool(
    'server_info',
    'Get server status: loaded contexts, instincts, errors, and memory bridge status.',
    {},
    async () => {
      try {
        return ok({
          version: '2.0.0',
          contexts_loaded: engine.getContexts().size,
          instincts_loaded: engine.getAllInstincts().length,
          errors: engine.getLoadErrors(),
          memory_connected: engine.isMemoryConnected(),
        });
      } catch (e) { return err(e); }
    },
  );
}
