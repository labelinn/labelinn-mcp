"use strict";
/**
 * LabelInn MCP Server Factory
 * ============================
 * Creates a configured McpServer instance with all tools and resources registered.
 * Used by both stdio (CLI) and HTTP (remote/Firebase) transports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpServer = createMcpServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const api_client_js_1 = require("./utils/api-client.js");
const print_js_1 = require("./tools/print.js");
const fleet_js_1 = require("./tools/fleet.js");
const designs_js_1 = require("./tools/designs.js");
const jobs_js_1 = require("./tools/jobs.js");
const rules_js_1 = require("./tools/rules.js");
const workflows_js_1 = require("./tools/workflows.js");
const audit_js_1 = require("./tools/audit.js");
const edge_js_1 = require("./tools/edge.js");
const sites_js_1 = require("./tools/sites.js");
const connect_js_1 = require("./tools/connect.js");
const system_js_1 = require("./tools/system.js");
const testing_js_1 = require("./tools/testing.js");
const render_js_1 = require("./tools/render.js");
const context_js_1 = require("./tools/context.js");
const index_js_1 = require("./resources/index.js");
/**
 * Create a fully configured MCP server instance.
 * @param apiKey - LabelInn API key (sk_live_xxx or sk_test_xxx)
 * @param baseUrl - API base URL (default: https://labelinn.com/v1)
 */
function createMcpServer(apiKey, baseUrl) {
    const client = new api_client_js_1.LabelInnClient(apiKey, baseUrl || 'https://labelinn.com/v1');
    const server = new mcp_js_1.McpServer({
        name: 'labelinn',
        version: '2.3.0',
        description: 'LabelInn Cloud Print API — 90+ tools for printing, fleet management, design editing, rules engine, compliance audit, label verification, Edge Server, sites & geo-routing, batch printing, system diagnostics. Controls Zebra, TSC, Honeywell, Epson, Brother thermal printers.',
    });
    // Register all tool categories
    (0, print_js_1.registerPrintTools)(server, client);
    (0, fleet_js_1.registerFleetTools)(server, client);
    (0, designs_js_1.registerDesignTools)(server, client);
    (0, jobs_js_1.registerJobTools)(server, client);
    (0, rules_js_1.registerRulesTools)(server, client);
    (0, workflows_js_1.registerWorkflowTools)(server, client);
    (0, audit_js_1.registerAuditTools)(server, client);
    (0, edge_js_1.registerEdgeTools)(server, client);
    (0, sites_js_1.registerSitesTools)(server, client);
    (0, connect_js_1.registerConnectTools)(server, client);
    (0, system_js_1.registerSystemTools)(server, client);
    (0, testing_js_1.registerTestingTools)(server, client);
    (0, render_js_1.registerRenderTools)(server, client);
    (0, context_js_1.registerContextTools)(server, client);
    // Register resources
    (0, index_js_1.registerResources)(server, client);
    return { server, client };
}
