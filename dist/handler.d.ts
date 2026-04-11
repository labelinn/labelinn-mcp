/**
 * LabelInn MCP HTTP Handler
 * ==========================
 * Stateless Streamable HTTP handler for serverless environments (Firebase, AWS Lambda, etc.)
 *
 * Each request creates a fresh MCP server instance, processes the JSON-RPC message,
 * and tears down. No in-memory state between requests.
 *
 * Usage in Firebase Cloud Functions:
 *   const { handleMcpRequest } = require('@labelinn/mcp-server');
 *   // or import from local path
 *
 * Usage standalone:
 *   import { handleMcpRequest } from './handler.js';
 */
import { IncomingMessage, ServerResponse } from 'node:http';
/**
 * Handle an MCP request over Streamable HTTP.
 * Designed for serverless: stateless, no session, fresh server per request.
 *
 * @param req - Node.js IncomingMessage (or Express/Firebase req)
 * @param res - Node.js ServerResponse (or Express/Firebase res)
 * @param apiKey - LabelInn API key from the requesting user
 * @param baseUrl - Optional API base URL override
 */
export declare function handleMcpRequest(req: IncomingMessage & {
    body?: unknown;
}, res: ServerResponse, apiKey: string, baseUrl?: string): Promise<void>;
