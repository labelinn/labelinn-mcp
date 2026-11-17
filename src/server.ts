/**
 * LabelInn MCP Server Factory
 * ============================
 * Creates a configured McpServer instance with all tools and resources registered.
 * Used by both stdio (CLI) and HTTP (remote/Firebase) transports.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LabelInnClient } from './utils/api-client.js';
import { registerPrintTools } from './tools/print.js';
import { registerFleetTools } from './tools/fleet.js';
import { registerDesignTools } from './tools/designs.js';
import { registerJobTools } from './tools/jobs.js';
import { registerRulesTools } from './tools/rules.js';
import { registerWorkflowTools } from './tools/workflows.js';
import { registerAuditTools } from './tools/audit.js';
import { registerEdgeTools } from './tools/edge.js';
import { registerSitesTools } from './tools/sites.js';
import { registerConnectTools } from './tools/connect.js';
import { registerSystemTools } from './tools/system.js';
import { registerTestingTools } from './tools/testing.js';
import { registerRenderTools } from './tools/render.js';
import { registerContextTools } from './tools/context.js';
import { registerResources } from './resources/index.js';

/**
 * Create a fully configured MCP server instance.
 * @param apiKey - LabelInn API key (sk_live_xxx or sk_test_xxx)
 * @param baseUrl - API base URL (default: https://labelinn.com/v1)
 */
export function createMcpServer(apiKey: string, baseUrl?: string): { server: McpServer; client: LabelInnClient } {
  const client = new LabelInnClient(apiKey, baseUrl || 'https://labelinn.com/v1');

  const server = new McpServer({
    name: 'labelinn',
    version: '2.3.0',
    description: 'LabelInn Cloud Print API — 90+ tools for printing, fleet management, design editing, rules engine, compliance audit, label verification, Edge Server, sites & geo-routing, batch printing, system diagnostics. Controls Zebra, TSC, Honeywell, Epson, Brother thermal printers.',
  });

  // Register all tool categories
  registerPrintTools(server, client);
  registerFleetTools(server, client);
  registerDesignTools(server, client);
  registerJobTools(server, client);
  registerRulesTools(server, client);
  registerWorkflowTools(server, client);
  registerAuditTools(server, client);
  registerEdgeTools(server, client);
  registerSitesTools(server, client);
  registerConnectTools(server, client);
  registerSystemTools(server, client);
  registerTestingTools(server, client);
  registerRenderTools(server, client);
  registerContextTools(server, client);

  // Register resources
  registerResources(server, client);

  return { server, client };
}
