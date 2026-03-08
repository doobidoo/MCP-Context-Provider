#!/usr/bin/env node

/**
 * MCP Context Provider — Server Entry Point
 *
 * Wraps the v2 Context + Instinct Engine as an MCP server.
 *
 * Usage:
 *   node dist/server/index.js          # stdio transport (default)
 *   node dist/server/index.js --http   # Streamable HTTP transport
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Engine } from '../engine/engine.js';
import { Registry } from '../cli/registry.js';
import { loadConfig } from './env.js';
import { registerAllTools } from './tools.js';

const log = (msg: string) => process.stderr.write(`[mcp-cp] ${msg}\n`);

async function main(): Promise<void> {
  const useHttp = process.argv.includes('--http');

  // 1. Load configuration from environment
  const config = loadConfig();
  log(`contexts: ${config.contextsPath}`);
  log(`instincts: ${config.instinctsPath}`);

  // 2. Initialize Engine
  const engine = new Engine({
    contextsPath: config.contextsPath,
    instinctsPath: config.instinctsPath,
    memoryBridge: config.memoryBridge
      ? { baseUrl: config.memoryBridge.baseUrl, apiKey: config.memoryBridge.apiKey, enabled: true }
      : undefined,
  });

  const initResult = await engine.initialize();
  log(`loaded ${initResult.contextsLoaded} contexts, ${initResult.instinctsLoaded} instincts`);
  if (initResult.errors.length > 0) {
    for (const e of initResult.errors) {
      log(`  ⚠ ${e.file}: ${e.error}`);
    }
  }

  // 3. Memory Bridge (best-effort)
  if (config.memoryBridge) {
    const connected = await engine.connectMemory();
    log(`memory bridge: ${connected ? 'connected' : 'unavailable'}`);
  }

  // 4. Registry (shares the same instincts path)
  const registry = new Registry(config.instinctsPath);

  // 5. Create MCP server
  const server = new McpServer({
    name: 'mcp-context-provider',
    version: '2.0.0-alpha.1',
  });

  // 6. Register all tools
  registerAllTools(server, engine, registry);

  // 7. Connect transport
  if (useHttp) {
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const { createServer } = await import('node:http');

    const httpServer = createServer(async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    });

    httpServer.listen(config.httpPort, '127.0.0.1', () => {
      log(`HTTP server listening on http://127.0.0.1:${config.httpPort}/`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('stdio transport ready');
  }
}

main().catch((error) => {
  log(`fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
