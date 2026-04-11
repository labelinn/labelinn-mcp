/**
 * LabelInn MCP Server Factory
 * ============================
 * Creates a configured McpServer instance with all tools and resources registered.
 * Used by both stdio (CLI) and HTTP (remote/Firebase) transports.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LabelInnClient } from './utils/api-client.js';
/**
 * Create a fully configured MCP server instance.
 * @param apiKey - LabelInn API key (sk_live_xxx or sk_test_xxx)
 * @param baseUrl - API base URL (default: https://labelinn.com/v1)
 */
export declare function createMcpServer(apiKey: string, baseUrl?: string): {
    server: McpServer;
    client: LabelInnClient;
};
