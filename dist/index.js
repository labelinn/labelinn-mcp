#!/usr/bin/env node
"use strict";
/**
 * LabelInn MCP Server — Full API Coverage
 * =========================================
 * Model Context Protocol server for AI assistants to interact with
 * LabelInn's cloud printing infrastructure + local Edge Server.
 *
 * Supports two transport modes:
 *   1. stdio  — Local CLI usage (Claude Desktop, VS Code Copilot, Cursor)
 *   2. http   — Remote/hosted Streamable HTTP (Firebase, any cloud)
 *
 * 112 Tools across 13 categories:
 *   Print, Fleet, Designs, Jobs, Rules, Audit, Edge, Sites,
 *   Connect, System, Testing, Render, Context
 *
 * Usage:
 *   # stdio mode (default — for local MCP clients)
 *   LABELINN_API_KEY=sk_live_xxx npx @labelinn/mcp-server
 *
 *   # http mode (for remote/cloud hosting)
 *   LABELINN_API_KEY=sk_live_xxx npx @labelinn/mcp-server --http --port 3001
 *
 * Environment Variables:
 *   LABELINN_API_KEY       — Default API key (required for stdio, optional for http)
 *   LABELINN_BASE_URL      — API base URL (default: https://labelinn.com/v1)
 *   LABELINN_CORS_ORIGIN   — CORS origin (default: * in dev, https://labelinn.com in prod)
 *   LABELINN_RATE_LIMIT    — Requests per minute per IP (default: 60)
 *   LABELINN_MAX_BODY_SIZE — Max request body in bytes (default: 1048576 = 1MB)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMcpRequest = exports.createMcpServer = void 0;
exports.createSandboxServer = createSandboxServer;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const node_http_1 = require("node:http");
const server_js_1 = require("./server.js");
// Re-export for Firebase / external consumers
var server_js_2 = require("./server.js");
Object.defineProperty(exports, "createMcpServer", { enumerable: true, get: function () { return server_js_2.createMcpServer; } });
var handler_js_1 = require("./handler.js");
Object.defineProperty(exports, "handleMcpRequest", { enumerable: true, get: function () { return handler_js_1.handleMcpRequest; } });
/**
 * Smithery sandbox export — lets Smithery scan tools/resources without real credentials.
 * Uses a mock API key so the server starts and exposes its tool list for discovery.
 */
function createSandboxServer() {
    const { server } = (0, server_js_1.createMcpServer)('sk_test_sandbox_scan', 'https://labelinn.com/v1');
    return server;
}
// ── Rate Limiter (in-memory sliding window) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
function isRateLimited(ip, maxRequests) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > maxRequests;
}
// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt)
            rateLimitMap.delete(ip);
    }
}, 300_000).unref();
// ── Request body reader with size limit ──
function readBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
            else {
                chunks.push(chunk);
            }
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
// ── Extract client IP ──
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string')
        return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}
// ── Extract API key from Authorization header or env ──
function extractApiKey(req, fallbackKey) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        const key = auth.substring(7).trim();
        if (key.startsWith('sk_live_') || key.startsWith('sk_test_'))
            return key;
    }
    return fallbackKey || null;
}
// ── Security headers ──
function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}
// ── JSON error response ──
function jsonError(res, status, code, message) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}
async function main() {
    const args = process.argv.slice(2);
    const isHttpMode = args.includes('--http') || args.includes('--sse');
    const portArg = args.find((_, i) => args[i - 1] === '--port');
    const port = portArg ? parseInt(portArg, 10) : 3001;
    const envApiKey = process.env.LABELINN_API_KEY;
    const baseUrl = process.env.LABELINN_BASE_URL || 'https://labelinn.com/v1';
    const corsOrigin = process.env.LABELINN_CORS_ORIGIN || '*';
    const rateLimit = parseInt(process.env.LABELINN_RATE_LIMIT || '60', 10);
    const maxBodySize = parseInt(process.env.LABELINN_MAX_BODY_SIZE || '1048576', 10);
    if (isHttpMode) {
        // ── HTTP / Streamable HTTP Mode ──
        const httpServer = (0, node_http_1.createServer)(async (req, res) => {
            // Security headers on every response
            setSecurityHeaders(res);
            // CORS
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
            res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
            if (req.method === 'OPTIONS') {
                res.writeHead(204).end();
                return;
            }
            // Rate limiting
            const clientIp = getClientIp(req);
            if (isRateLimited(clientIp, rateLimit)) {
                res.setHeader('Retry-After', '60');
                jsonError(res, 429, -32000, 'Rate limit exceeded. Try again later.');
                return;
            }
            // Health check
            if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    server: 'labelinn-mcp',
                    version: '2.3.0',
                    transport: 'streamable-http',
                    tools: 112,
                }));
                return;
            }
            // MCP endpoint
            if (req.url === '/mcp') {
                if (req.method !== 'POST') {
                    jsonError(res, 405, -32000, 'Method not allowed. Use POST for MCP requests.');
                    return;
                }
                // Auth — per-request API key from header, with env var as fallback
                const apiKey = extractApiKey(req, envApiKey);
                if (!apiKey) {
                    jsonError(res, 401, -32001, 'Missing API key. Set Authorization: Bearer sk_live_xxx header or LABELINN_API_KEY env var.');
                    return;
                }
                // Request body size limit
                let body;
                try {
                    body = await readBody(req, maxBodySize);
                }
                catch {
                    jsonError(res, 413, -32000, `Request body too large. Max ${maxBodySize} bytes.`);
                    return;
                }
                // Validate JSON
                let parsed;
                try {
                    parsed = JSON.parse(body.toString('utf-8'));
                }
                catch {
                    jsonError(res, 400, -32700, 'Parse error: invalid JSON.');
                    return;
                }
                // Request timeout (30s)
                const timeout = setTimeout(() => {
                    if (!res.writableEnded) {
                        jsonError(res, 504, -32000, 'Request timeout.');
                    }
                }, 30_000);
                try {
                    const { server } = (0, server_js_1.createMcpServer)(apiKey, baseUrl);
                    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
                    await server.connect(transport);
                    // Attach the parsed body so the transport can read it
                    req.body = parsed;
                    await transport.handleRequest(req, res, parsed);
                    res.on('close', () => {
                        clearTimeout(timeout);
                        transport.close();
                        server.close();
                    });
                }
                catch (err) {
                    clearTimeout(timeout);
                    console.error('[MCP] Error:', err);
                    if (!res.headersSent) {
                        jsonError(res, 500, -32603, 'Internal server error.');
                    }
                }
                return;
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        });
        // Graceful shutdown
        const shutdown = () => {
            console.log('\n🛑 Shutting down MCP server...');
            httpServer.close(() => process.exit(0));
            setTimeout(() => process.exit(1), 5000).unref();
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
        httpServer.listen(port, '0.0.0.0', () => {
            console.log(`🖨️  LabelInn MCP Server v2.3.0 (Streamable HTTP)`);
            console.log(`   Endpoint:    http://0.0.0.0:${port}/mcp`);
            console.log(`   Health:      http://0.0.0.0:${port}/health`);
            console.log(`   CORS:        ${corsOrigin}`);
            console.log(`   Rate limit:  ${rateLimit} req/min`);
            console.log(`   Max body:    ${(maxBodySize / 1024).toFixed(0)} KB`);
            console.log(`   Auth:        ${envApiKey ? 'env + header' : 'header only'}`);
        });
    }
    else {
        // ── Stdio Mode (default) ──
        if (!envApiKey) {
            console.error('Error: LABELINN_API_KEY environment variable is required.');
            console.error('Set it to your LabelInn API key (sk_live_xxx or sk_test_xxx).');
            process.exit(1);
        }
        const { server, client } = (0, server_js_1.createMcpServer)(envApiKey, baseUrl);
        // Edge discovery: when the LabelInn desktop app is running on this same
        // machine, its edge HTTP server (default port 6631) drops a descriptor
        // at ~/.labelinn/edge.json. If it's there and answers /local/v1/health,
        // print/fleet tools route through localhost instead of going to the
        // cloud — matters for local LLMs that have no reason to hairpin
        // through the public internet to reach a printer plugged into the
        // same machine. Falls back to cloud silently when the desktop app
        // isn't running or the edge is disabled.
        const edgeFound = await client.discoverEdge().catch(() => false);
        if (edgeFound) {
            const d = client.getEdgeDescriptor();
            // stderr only — stdout is reserved for the MCP JSON-RPC transport
            console.error(`🖨️  Edge detected: ${client.getEdgeUrl()}` +
                (d?.deviceId ? ` (device ${d.deviceId})` : ''));
        }
        const transport = new stdio_js_1.StdioServerTransport();
        await server.connect(transport);
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
