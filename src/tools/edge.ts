/**
 * Edge Server MCP tools — local LAN operations
 * These tools talk directly to the Edge Server on the local network,
 * bypassing the cloud entirely. Useful for testing, verification, and real-time ops.
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerEdgeTools(server: any, client: LabelInnClient) {
  // ── edge_health ──
  server.tool(
    'edge_health',
    'Check if the local Edge Server is running. Returns server status, version, mode, uptime.',
    {},
    async () => {
      try {
        const result = await client.edgeHealth();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Edge Server not reachable: ${e.message}. Is the LabelInn app running with Edge Server enabled?` }] };
      }
    }
  );

  // ── edge_printers ──
  server.tool(
    'edge_printers',
    'List printers connected locally (USB, network) via Edge Server. No cloud required.',
    {},
    async () => {
      const result = await client.edgePrinters();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_print ──
  server.tool(
    'edge_print',
    'Print a label through the local Edge Server (LAN, no cloud). Supports ZPL, ESC/POS, and design templates.',
    {
      printer_id: z.string().describe('Local printer ID'),
      payload_type: z.string().describe('"zpl", "escLabel", or "design"'),
      payload: z.string().describe('ZPL code, ESC data, or design ID'),
      copies: z.number().optional().describe('Number of copies'),
    },
    async (params: { printer_id: string; payload_type: string; payload: string; copies?: number }) => {
      const result = await client.edgePrintJob(params.printer_id, params.payload_type, params.payload, params.copies);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_discover ──
  server.tool(
    'edge_discover',
    'Trigger LAN printer discovery from the Edge Server. Scans USB ports and local network.',
    {},
    async () => {
      const result = await client.edgeDiscover();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_metrics ──
  server.tool(
    'edge_metrics',
    'Get Edge Server performance metrics: latency P50/P95/P99, throughput, success rate, per-printer breakdown.',
    {},
    async () => {
      const result = await client.edgeMetrics();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_fleet_health ──
  server.tool(
    'edge_fleet_health',
    'Get fleet-wide health scores from the Edge Server. Shows healthy/warning/critical printer counts.',
    {},
    async () => {
      const result = await client.edgeFleetHealth();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_printer_health ──
  server.tool(
    'edge_printer_health',
    'Get the health score (0-100) for a specific printer. Factors: supply level, error rate, uptime, latency, queue depth.',
    {
      printer_id: z.string().describe('The printer ID'),
    },
    async (params: { printer_id: string }) => {
      const result = await client.edgePrinterHealth(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_verify_expect ──
  server.tool(
    'edge_verify_expect',
    'Set expected barcodes for label verification. After printing, scan barcodes to verify they match.',
    {
      barcodes: z.array(z.unknown()).describe('Array of expected barcode strings'),
      job_id: z.string().optional().describe('Associate with a print job ID'),
    },
    async (params: { barcodes: string[]; job_id?: string }) => {
      const result = await client.edgeVerifyExpect(params.barcodes, params.job_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_verify_scan ──
  server.tool(
    'edge_verify_scan',
    'Submit a scanned barcode for verification against expected values. Returns match/no-match result.',
    {
      barcode: z.string().describe('The scanned barcode string'),
      job_id: z.string().optional().describe('Job ID to verify against'),
    },
    async (params: { barcode: string; job_id?: string }) => {
      const result = await client.edgeVerifyScan(params.barcode, params.job_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_verify_status ──
  server.tool(
    'edge_verify_status',
    'Get the current verification mode status: active/inactive, stats (pass/fail count), expected barcodes.',
    {},
    async () => {
      const result = await client.edgeVerifyStatus();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_verify_audit ──
  server.tool(
    'edge_verify_audit',
    'Get the verification audit log — every scan result with timestamps, match status, operator info.',
    {
      limit: z.number().optional().describe('Max entries to return'),
    },
    async (params: { limit?: number }) => {
      const result = await client.edgeVerifyAudit(params.limit);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_rules_cache ──
  server.tool(
    'edge_rules_cache',
    'Check which rules are cached on the Edge Server for offline evaluation.',
    {},
    async () => {
      const result = await client.edgeRulesCache();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_rules_evaluate ──
  server.tool(
    'edge_rules_evaluate',
    'Dry-run evaluate rules on the Edge Server. Test how rules would fire for a given context without actually executing actions.',
    {
      trigger: z.string().describe('Trigger type: "printJobCreated", "printerStatusChanged", etc.'),
      context: z.record(z.string(), z.unknown()).describe('Context data: {"job.copies": 10, "printer.type": "ZEBRA", "data.weight_kg": 15}'),
    },
    async (params: { trigger: string; context: Record<string, unknown> }) => {
      const result = await client.edgeRulesEvaluate(params.trigger, params.context);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── edge_audit ──
  server.tool(
    'edge_audit',
    'Get recent audit events from the Edge Server\'s local audit log.',
    {
      limit: z.number().optional().describe('Max entries'),
      action: z.string().optional().describe('Filter by action type'),
    },
    async (params: { limit?: number; action?: string }) => {
      const result = await client.edgeAuditRecent(params.limit, params.action);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
