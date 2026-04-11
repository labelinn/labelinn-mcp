#!/usr/bin/env node
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LabelInnClient } from './utils/api-client.js';
import { registerPrintTools } from './tools/print.js';
import { registerFleetTools } from './tools/fleet.js';
import { registerDesignTools } from './tools/designs.js';
import { registerJobTools } from './tools/jobs.js';
import { registerRulesTools } from './tools/rules.js';
import { registerAuditTools } from './tools/audit.js';
import { registerEdgeTools } from './tools/edge.js';
import { registerSitesTools } from './tools/sites.js';
import { registerConnectTools } from './tools/connect.js';
import { registerSystemTools } from './tools/system.js';
import { registerTestingTools } from './tools/testing.js';
import { registerRenderTools } from './tools/render.js';
import { registerContextTools } from './tools/context.js';
import { registerResources } from './resources/index.js';

async function main() {
  // ── Config ──
  const apiKey = process.env.LABELINN_API_KEY;
  if (!apiKey) {
    console.error('Error: LABELINN_API_KEY environment variable is required.');
    console.error('Set it to your LabelInn API key (sk_live_xxx or sk_test_xxx).');
    process.exit(1);
  }

  const baseUrl = process.env.LABELINN_BASE_URL || 'https://labelinn.com/v1';
  const client = new LabelInnClient(apiKey, baseUrl);

  // ── Server ──
  const server = new McpServer({
    name: 'labelinn',
    version: '2.0.0',
    description: 'LabelInn Full API + SKYNET Autonomous Testing — 90+ tools for cloud printing, fleet management, design editing, rules engine, compliance audit, label verification, Edge Server local ops, sites & geo-routing, analytics & predictions, batch printing, system diagnostics, and autonomous self-healing test sessions. Controls Zebra, TSC, Honeywell, Epson, Brother thermal printers.',
  });

  // ── Register Tools ──
  registerPrintTools(server, client);
  registerFleetTools(server, client);
  registerDesignTools(server, client);
  registerJobTools(server, client);
  registerRulesTools(server, client);
  registerAuditTools(server, client);
  registerEdgeTools(server, client);
  registerSitesTools(server, client);
  registerConnectTools(server, client);
  registerSystemTools(server, client);
  registerTestingTools(server, client);
  registerRenderTools(server, client);
  registerContextTools(server, client);

  // ── Register Resources ──
  registerResources(server, client);

  // ── Start ──
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
