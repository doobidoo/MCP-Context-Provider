/**
 * Environment configuration for the MCP server.
 *
 * All settings are read from environment variables so the server
 * can be configured entirely via .mcp.json `env` blocks.
 */

import { resolve } from 'node:path';

export interface ServerConfig {
  /** Path to *_context.json files. */
  contextsPath: string;

  /** Path to *.instincts.yaml files. */
  instinctsPath: string;

  /** Memory Bridge settings. `undefined` = disabled. */
  memoryBridge?: {
    baseUrl: string;
    apiKey?: string;
  };

  /** HTTP port (only used with --http flag). */
  httpPort: number;
}

/**
 * Read server configuration from environment variables.
 * Paths are resolved relative to `process.cwd()`.
 */
export function loadConfig(): ServerConfig {
  const contextsPath = resolve(
    process.cwd(),
    process.env['CONTEXTS_PATH'] ?? './contexts',
  );

  const instinctsPath = resolve(
    process.cwd(),
    process.env['INSTINCTS_PATH'] ?? './instincts',
  );

  const memoryUrl = process.env['MEMORY_BRIDGE_URL'];
  const memoryBridge = memoryUrl
    ? {
        baseUrl: memoryUrl,
        apiKey: process.env['MEMORY_BRIDGE_API_KEY'],
      }
    : undefined;

  const httpPort = Number(process.env['MCP_SERVER_PORT'] ?? '3100');

  return { contextsPath, instinctsPath, memoryBridge, httpPort };
}
