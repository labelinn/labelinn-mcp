#!/usr/bin/env node
"use strict";
/**
 * LabelInn MCP Server — Full API Coverage
 * =========================================
 * Model Context Protocol server for AI assistants to interact with
 * LabelInn's cloud printing infrastructure + local Edge Server.
 *
 * 90+ Tools across 11 categories:
 *   Print:     print_label, print_zpl, print_image
 *   Fleet:     list_printers, get_printer_status, get_printer_details,
 *              discover_printers, add_discovered_printer, update_printer,
 *              identify_printer, set_printer_media, create/list_printer_groups
 *   Designs:   list/get/create/update/delete_design, get_design_variables,
 *              clone_design, add/update/delete_element, render_design_preview
 *   Jobs:      list/get/cancel/reprint_job
 *   Rules:     create/list/get/update/delete/test_rule
 *   Audit:     audit_trail, audit_summary, serial_pools, webhooks
 *   Edge:      14 local Edge Server tools (health, print, verify, discover, etc.)
 *   Sites:     create/list/get_site, assign_printers, nearest_site, analytics
 *   Connect:   ingest_data, test_parse, batch_print, print_from_connector
 *   System:    system_health_check, restart_edge, get_logs, usb_devices, diagnostics
 *   Testing:   skynet_start_session, run_test, record_fix, get_status, end_session
 *
 * 10 Resources:
 *   labelinn://printers, labelinn://designs, labelinn://usage,
 *   labelinn://jobs/recent, labelinn://fleet/health, labelinn://rules,
 *   labelinn://audit/summary, labelinn://sites, labelinn://edge/status
 *
 * Usage:
 *   LABELINN_API_KEY=sk_live_xxx npx @labelinn/mcp-server
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const api_client_js_1 = require("./utils/api-client.js");
const print_js_1 = require("./tools/print.js");
const fleet_js_1 = require("./tools/fleet.js");
const designs_js_1 = require("./tools/designs.js");
const jobs_js_1 = require("./tools/jobs.js");
const rules_js_1 = require("./tools/rules.js");
const audit_js_1 = require("./tools/audit.js");
const edge_js_1 = require("./tools/edge.js");
const sites_js_1 = require("./tools/sites.js");
const connect_js_1 = require("./tools/connect.js");
const system_js_1 = require("./tools/system.js");
const testing_js_1 = require("./tools/testing.js");
const render_js_1 = require("./tools/render.js");
const context_js_1 = require("./tools/context.js");
const index_js_1 = require("./resources/index.js");
async function main() {
    // ── Config ──
    const apiKey = process.env.LABELINN_API_KEY;
    if (!apiKey) {
        console.error('Error: LABELINN_API_KEY environment variable is required.');
        console.error('Set it to your LabelInn API key (sk_live_xxx or sk_test_xxx).');
        process.exit(1);
    }
    const baseUrl = process.env.LABELINN_BASE_URL || 'https://labelinn.com/v1';
    const client = new api_client_js_1.LabelInnClient(apiKey, baseUrl);
    // ── Server ──
    const server = new mcp_js_1.McpServer({
        name: 'labelinn',
        version: '2.0.0',
        description: 'LabelInn Full API + SKYNET Autonomous Testing — 90+ tools for cloud printing, fleet management, design editing, rules engine, compliance audit, label verification, Edge Server local ops, sites & geo-routing, analytics & predictions, batch printing, system diagnostics, and autonomous self-healing test sessions. Controls Zebra, TSC, Honeywell, Epson, Brother thermal printers.',
    });
    // ── Register Tools ──
    (0, print_js_1.registerPrintTools)(server, client);
    (0, fleet_js_1.registerFleetTools)(server, client);
    (0, designs_js_1.registerDesignTools)(server, client);
    (0, jobs_js_1.registerJobTools)(server, client);
    (0, rules_js_1.registerRulesTools)(server, client);
    (0, audit_js_1.registerAuditTools)(server, client);
    (0, edge_js_1.registerEdgeTools)(server, client);
    (0, sites_js_1.registerSitesTools)(server, client);
    (0, connect_js_1.registerConnectTools)(server, client);
    (0, system_js_1.registerSystemTools)(server, client);
    (0, testing_js_1.registerTestingTools)(server, client);
    (0, render_js_1.registerRenderTools)(server, client);
    (0, context_js_1.registerContextTools)(server, client);
    // ── Register Resources ──
    (0, index_js_1.registerResources)(server, client);
    // ── Start ──
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
