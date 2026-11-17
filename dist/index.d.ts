#!/usr/bin/env node
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
export { createMcpServer } from './server.js';
export { handleMcpRequest } from './handler.js';
/**
 * Smithery sandbox export — lets Smithery scan tools/resources without real credentials.
 * Uses a mock API key so the server starts and exposes its tool list for discovery.
 */
export declare function createSandboxServer(): import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;
