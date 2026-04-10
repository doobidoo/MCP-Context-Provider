#!/usr/bin/env node
/**
 * MCP Context Provider Server v2
 *
 * Exposes the V2 Engine as an MCP server with stdio (default)
 * or HTTP transport (--http flag).
 *
 * Usage:
 *   node dist/server/index.js          # stdio transport
 *   node dist/server/index.js --http   # HTTP on MCP_SERVER_PORT (default 3100)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Engine } from '../engine/engine.js';
import { InstinctLoader } from '../engine/instinct-loader.js';
import { Registry } from '../cli/registry.js';
import type { InstinctFile } from '../types/instinct.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONTEXTS_PATH = process.env['CONTEXTS_PATH'] ?? './contexts';
const INSTINCTS_PATH = process.env['INSTINCTS_PATH'] ?? './instincts';
const MEMORY_BRIDGE_URL = process.env['MEMORY_BRIDGE_URL'];
const MEMORY_BRIDGE_API_KEY = process.env['MEMORY_BRIDGE_API_KEY'];
const SERVER_PORT = parseInt(process.env['MCP_SERVER_PORT'] ?? '3100', 10);
const USE_HTTP = process.argv.includes('--http');
// Default: auto-repair is ON. Set MCP_CP_AUTO_REPAIR=0 to keep loader
// side-effect free (in-memory corrections only, no disk writes).
const AUTO_REPAIR = (process.env['MCP_CP_AUTO_REPAIR'] ?? '1') !== '0';

// ---------------------------------------------------------------------------
// Engine setup
// ---------------------------------------------------------------------------

const registry = new Registry(resolve(INSTINCTS_PATH));

const engine = new Engine({
  contextsPath: resolve(CONTEXTS_PATH),
  instinctsPath: resolve(INSTINCTS_PATH),
  memoryBridge: MEMORY_BRIDGE_URL
    ? { baseUrl: MEMORY_BRIDGE_URL, apiKey: MEMORY_BRIDGE_API_KEY }
    : undefined,
  autoRepair: AUTO_REPAIR,
});

// ---------------------------------------------------------------------------
// MCP Server definition
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'context-provider', version: '2.0.0-alpha.6' },
  { capabilities: { tools: {} } },
);

// -- List tools --------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_tool_context',
      description:
        'Get complete context (rules, syntax, preferences) for a specific tool',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool_name: {
            type: 'string',
            description: 'Tool name or category (e.g. "git", "dokuwiki", "terraform")',
          },
        },
        required: ['tool_name'],
      },
    },
    {
      name: 'get_syntax_rules',
      description: 'Get syntax-specific rules for a tool category',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool_name: {
            type: 'string',
            description: 'Tool name or category',
          },
        },
        required: ['tool_name'],
      },
    },
    {
      name: 'list_available_contexts',
      description: 'List all loaded context categories and their descriptions',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'apply_auto_corrections',
      description: 'Apply auto-correction patterns from matching contexts to text',
      inputSchema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string', description: 'Text to apply corrections to' },
          tool_name: {
            type: 'string',
            description: 'Tool context to use for corrections',
          },
        },
        required: ['text', 'tool_name'],
      },
    },
    {
      name: 'build_injection',
      description:
        'Build a complete injection payload (contexts + instincts) for a tool/input combination',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool: { type: 'string', description: 'Tool name or pattern' },
          input: {
            type: 'string',
            description: 'Input text to match instincts against',
          },
        },
        required: ['tool', 'input'],
      },
    },
    {
      name: 'list_instincts',
      description: 'List all loaded instincts with their confidence scores',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'store_instinct',
      description:
        'Store a new instinct candidate. Created as inactive with auto approval — use approve_instinct for human approval.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Unique kebab-case ID (e.g. "git-conventional-commits")' },
          rule: { type: 'string', description: 'The instinct rule text (20-80 tokens)' },
          domain: { type: 'string', description: 'Knowledge domain (e.g. "git", "typescript", "docker")' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for matching and categorization',
          },
          trigger_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regex patterns that trigger this instinct',
          },
          confidence: { type: 'number', description: 'Initial confidence 0.0-1.0 (default 0.6)' },
          filename: { type: 'string', description: 'Target YAML file (default "learned.instincts.yaml")' },
        },
        required: ['id', 'rule', 'domain', 'tags', 'trigger_patterns'],
      },
    },
    {
      name: 'approve_instinct',
      description: 'Approve an instinct for active use (sets approved_by to human)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Instinct ID to approve' },
        },
        required: ['id'],
      },
    },
    {
      name: 'reject_instinct',
      description: 'Reject/deactivate an instinct and lower its confidence',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Instinct ID to reject' },
        },
        required: ['id'],
      },
    },
    {
      name: 'record_outcome',
      description: 'Record a positive, negative, or neutral outcome for an instinct',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Instinct ID' },
          result: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: 'Outcome result' },
          delta: { type: 'number', description: 'Confidence change (e.g. +0.05 or -0.1)' },
          note: { type: 'string', description: 'Optional note explaining the outcome' },
        },
        required: ['id', 'result', 'delta'],
      },
    },
  ],
}));

// -- Call tool ----------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_tool_context': {
      const toolName = String(args?.['tool_name'] ?? '');
      if (!toolName) {
        return { content: [{ type: 'text', text: 'Error: tool_name is required' }] };
      }
      const matches = engine.matchContexts({ tool: toolName });
      if (matches.length === 0) {
        return {
          content: [{ type: 'text', text: `No context found for tool: ${toolName}` }],
        };
      }
      const merged = matches.map((m) => m.context);
      return { content: [{ type: 'text', text: JSON.stringify(merged, null, 2) }] };
    }

    case 'get_syntax_rules': {
      const toolName = String(args?.['tool_name'] ?? '');
      if (!toolName) {
        return { content: [{ type: 'text', text: 'Error: tool_name is required' }] };
      }
      const matches = engine.matchContexts({ tool: toolName });
      const rules: Record<string, unknown> = {};
      for (const m of matches) {
        if (m.context.syntax_rules) {
          rules[m.context.tool_category] = m.context.syntax_rules;
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: Object.keys(rules).length
              ? JSON.stringify(rules, null, 2)
              : `No syntax rules found for tool: ${toolName}`,
          },
        ],
      };
    }

    case 'list_available_contexts': {
      const contexts = engine.getContexts();
      const list = Array.from(contexts.values()).map((c) => ({
        tool_category: c.tool_category,
        description: c.description,
        priority: c.metadata.priority ?? 'medium',
        applies_to: c.metadata.applies_to_tools,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }

    case 'apply_auto_corrections': {
      const text = String(args?.['text'] ?? '');
      const toolName = String(args?.['tool_name'] ?? '');
      if (!text || !toolName) {
        return {
          content: [{ type: 'text', text: 'Error: text and tool_name are required' }],
        };
      }
      const corrections = engine.getAutoCorrections(toolName);
      let result = text;
      const applied: string[] = [];
      for (const c of corrections) {
        const re = new RegExp(c.pattern, 'gi');
        if (re.test(result)) {
          result = result.replace(re, c.replacement);
          applied.push(c.name);
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { corrected_text: result, corrections_applied: applied },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'build_injection': {
      const tool = String(args?.['tool'] ?? '*');
      const input = String(args?.['input'] ?? '');
      const payload = engine.buildInjection(tool, input);
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    }

    case 'list_instincts': {
      const instincts = engine.getAllInstincts().map((i) => ({
        id: i.id,
        domain: i.domain,
        rule: i.rule,
        confidence: i.confidence,
        active: i.active,
        approved_by: i.approved_by,
        usage_count: i.usage_count,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(instincts, null, 2) }] };
    }

    case 'store_instinct': {
      const id = String(args?.['id'] ?? '');
      const rule = String(args?.['rule'] ?? '');
      const domain = String(args?.['domain'] ?? '');
      const tags = (args?.['tags'] as string[]) ?? [];
      const trigger_patterns = (args?.['trigger_patterns'] as string[]) ?? [];
      const confidence = Number(args?.['confidence'] ?? 0.6);
      const filename = String(args?.['filename'] ?? 'learned.instincts.yaml');

      if (!id || !rule || !domain) {
        return { content: [{ type: 'text', text: 'Error: id, rule, and domain are required' }] };
      }

      const loader = new InstinctLoader(resolve(INSTINCTS_PATH));
      let instinctFile: InstinctFile;
      try {
        instinctFile = await loader.load(filename);
      } catch {
        instinctFile = { version: '1.0', instincts: {} };
      }

      if (instinctFile.instincts[id]) {
        return { content: [{ type: 'text', text: `Error: instinct "${id}" already exists` }] };
      }

      const now = new Date().toISOString();
      instinctFile.instincts[id] = {
        id,
        rule,
        domain,
        tags,
        trigger_patterns,
        confidence,
        min_confidence: 0.5,
        usage_count: 0,
        approved_by: 'auto',
        outcome_log: [],
        active: false,
        created_at: now,
        updated_at: now,
      };

      await loader.save(filename, instinctFile);
      return {
        content: [{ type: 'text', text: JSON.stringify({ stored: id, file: filename, status: 'inactive — use approve_instinct to activate' }, null, 2) }],
      };
    }

    case 'approve_instinct': {
      const id = String(args?.['id'] ?? '');
      if (!id) return { content: [{ type: 'text', text: 'Error: id is required' }] };
      try {
        const instinct = await registry.approve(id);
        return { content: [{ type: 'text', text: JSON.stringify({ approved: id, confidence: instinct.confidence, active: instinct.active }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }

    case 'reject_instinct': {
      const id = String(args?.['id'] ?? '');
      if (!id) return { content: [{ type: 'text', text: 'Error: id is required' }] };
      try {
        const instinct = await registry.reject(id);
        return { content: [{ type: 'text', text: JSON.stringify({ rejected: id, confidence: instinct.confidence, active: instinct.active }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }

    case 'record_outcome': {
      const id = String(args?.['id'] ?? '');
      const result = String(args?.['result'] ?? '') as 'positive' | 'negative' | 'neutral';
      const delta = Number(args?.['delta'] ?? 0);
      const note = args?.['note'] ? String(args['note']) : undefined;
      if (!id || !result) return { content: [{ type: 'text', text: 'Error: id and result are required' }] };
      try {
        const instinct = await registry.recordOutcome(id, result, delta, note);
        return { content: [{ type: 'text', text: JSON.stringify({ id, result, new_confidence: instinct.confidence, outcomes: instinct.outcome_log.length }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  // Initialize engine
  const result = await engine.initialize();
  const info = `Engine loaded: ${result.contextsLoaded} contexts, ${result.instinctsLoaded} instincts`;
  console.error(info);

  if (result.repairs.length > 0) {
    const totalFixes = result.repairs.reduce(
      (sum, r) => sum + r.repairs.length,
      0,
    );
    const mode = AUTO_REPAIR ? 'auto-repaired on disk (.bak kept)' : 'in-memory only — set MCP_CP_AUTO_REPAIR=1 to persist';
    console.error(
      `[mcp-cp] Auto-corrected ${totalFixes} issue(s) across ${result.repairs.length} file(s) — ${mode}:`,
    );
    for (const r of result.repairs) {
      const tag = r.persisted ? '✓ persisted' : '~ in-memory';
      console.error(`  ${tag}  ${r.file}`);
      for (const action of r.repairs) {
        console.error(`      · ${action.kind}: ${action.detail}`);
      }
    }
  }

  if (result.errors.length > 0) {
    console.error(`[mcp-cp] ${result.errors.length} unrecoverable load error(s):`);
    for (const e of result.errors) {
      console.error(`  ⚠️  ${e.file}: ${e.error}`);
    }
    console.error(
      '  → These files were skipped. Fix them manually and restart.',
    );
  }

  // Connect memory bridge if configured
  if (MEMORY_BRIDGE_URL) {
    const connected = await engine.connectMemory();
    console.error(`Memory bridge: ${connected ? 'connected' : 'not available'}`);
  }

  if (USE_HTTP) {
    // HTTP transport (Streamable HTTP)
    const httpServer = createServer(async (req, res) => {
      // Health check
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ...result }));
        return;
      }

      // MCP endpoint
      if (req.url === '/mcp' || req.url === '/') {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    httpServer.listen(SERVER_PORT, () => {
      console.error(`MCP Context Provider listening on http://localhost:${SERVER_PORT}`);
      console.error(`  MCP endpoint: http://localhost:${SERVER_PORT}/mcp`);
      console.error(`  Health check: http://localhost:${SERVER_PORT}/health`);
    });
  } else {
    // stdio transport (default)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Context Provider running on stdio');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
