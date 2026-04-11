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
export {};
