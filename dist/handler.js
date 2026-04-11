"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMcpRequest = handleMcpRequest;
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const server_js_1 = require("./server.js");
/**
 * Handle an MCP request over Streamable HTTP.
 * Designed for serverless: stateless, no session, fresh server per request.
 *
 * @param req - Node.js IncomingMessage (or Express/Firebase req)
 * @param res - Node.js ServerResponse (or Express/Firebase res)
 * @param apiKey - LabelInn API key from the requesting user
 * @param baseUrl - Optional API base URL override
 */
async function handleMcpRequest(req, res, apiKey, baseUrl) {
    const { server } = (0, server_js_1.createMcpServer)(apiKey, baseUrl);
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
        transport.close();
        server.close();
    });
}
