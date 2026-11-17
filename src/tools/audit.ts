/**
 * Audit Trail & Compliance MCP tools
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerAuditTools(server: any, client: LabelInnClient) {
  // ── get_audit_trail ──
  server.tool(
    'get_audit_trail',
    'Query the audit trail — who did what, when. Filter by action type, date range. Essential for compliance (FDA, GS1, etc.).',
    {
      action: z.string().optional().describe('Filter by action: "print", "cancel", "reprint", "verify", "modify"'),
      limit: z.number().optional().describe('Max entries (1-200)'),
      date_from: z.string().optional().describe('Start date (ISO 8601)'),
      date_to: z.string().optional().describe('End date (ISO 8601)'),
    },
    async (params: { action?: string; limit?: number; date_from?: string; date_to?: string }) => {
      const result = await client.getAuditTrail(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_audit_summary ──
  server.tool(
    'get_audit_summary',
    'Get aggregate audit summary: how many prints, cancels, verifications, etc. by action type. Optional time window.',
    {
      start: z.string().optional().describe('ISO-8601 start (default: 24h ago)'),
      end: z.string().optional().describe('ISO-8601 end (default: now)'),
    },
    async (params: { start?: string; end?: string }) => {
      const qs = new URLSearchParams();
      if (params.start) qs.set('start', params.start);
      if (params.end) qs.set('end', params.end);
      const q = qs.toString();
      const result = await client.get(`/audit/summary${q ? '?' + q : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── query_print_history ── the forensic "what physically printed" record
  server.tool(
    'query_print_history',
    'Query the print-history forensic record — the canonical "what came out of a printer" log. ' +
      'One entry per print job (manual, API, workflow, or marketplace) with design, printer, copies, status, ' +
      'integration ORIGIN (which API key / workflow / marketplace produced it), a raster thumbnail pointer, and ' +
      'the HMAC signature. Filter by time window + printer + design + status. Answers "what did we print ' +
      'today / on printer X / for design Y". Use get_print_record for the full element values of one job.',
    {
      start: z.string().optional().describe('ISO-8601 start of the printed-at window'),
      end: z.string().optional().describe('ISO-8601 end of the printed-at window'),
      printer_id: z.string().optional().describe('Only jobs sent to this printer'),
      design_id: z.string().optional().describe('Only jobs that printed this design/template'),
      status: z.string().optional().describe('Filter: success | completed | failed | cancelled'),
      limit: z.number().optional().describe('Max entries (1-200, default 50)'),
      page_token: z.string().optional().describe('Pagination cursor from a previous call'),
    },
    async (params: { start?: string; end?: string; printer_id?: string; design_id?: string; status?: string; limit?: number; page_token?: string }) => {
      const qs = new URLSearchParams();
      if (params.start) qs.set('start', params.start);
      if (params.end) qs.set('end', params.end);
      if (params.printer_id) qs.set('printerId', params.printer_id);
      if (params.design_id) qs.set('designId', params.design_id);
      if (params.status) qs.set('status', params.status);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.page_token) qs.set('page_token', params.page_token);
      const q = qs.toString();
      const result = await client.get(`/audit/print-history${q ? '?' + q : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_print_record ── full forensics for a single job
  server.tool(
    'get_print_record',
    'Get the FULL forensic record of a single print job: every element\'s printed value, media size, the ' +
      'rendered-label raster URL, full integration origin (api key, workflow, request id, caller ip), the HMAC ' +
      'signature, and the chain-linked audit events. Use to verify exactly what a specific job printed.',
    {
      job_id: z.string().describe('The print job / history entry id'),
    },
    async (params: { job_id: string }) => {
      const result = await client.get(`/audit/print-history/${encodeURIComponent(params.job_id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_print_artifacts ── which captured bytes exist for a job
  server.tool(
    'list_print_artifacts',
    'List the byte-level artefacts captured for one print job: raster (the rendered PNG of what ' +
      'physically came out), command_payload (the native ZPL/TSPL/TPCL stream sent to the device), ' +
      'api_input (the exact API request body that caused the print) and raw_payload (caller-supplied ' +
      'pre-rendered bytes). Each carries the sha256 chained into the audit log. Call before ' +
      'get_print_artifact to see which kinds exist.',
    {
      job_id: z.string().describe('The print job / history entry id'),
    },
    async (params: { job_id: string }) => {
      const result = await client.get(`/audit/print-history/${encodeURIComponent(params.job_id)}/artifacts`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_print_artifact ── the only read path for admin-SDK captures
  server.tool(
    'get_print_artifact',
    'Get a short-lived (15 min) download URL for ONE captured artefact of a print job, plus its sha256 ' +
      'and size. This is the only way to read api_input and raw_payload — they are written server-side ' +
      'with no public download token. Use to answer "what exactly did that integration send us?" or ' +
      '"what ZPL actually went to the printer?".',
    {
      job_id: z.string().describe('The print job / history entry id'),
      kind: z.enum(['raster', 'command_payload', 'api_input', 'raw_payload'])
        .describe('Which artefact to fetch (see list_print_artifacts)'),
    },
    async (params: { job_id: string; kind: string }) => {
      const result = await client.get(
        `/audit/print-history/${encodeURIComponent(params.job_id)}/artifacts/${params.kind}?as=url`
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── verify_print_job ── the dev/troubleshooting assertion primitive
  server.tool(
    'verify_print_job',
    'Verify a print job against the compliance trail — the dev/troubleshooting assertion primitive. Fetches ' +
      'the job\'s forensic record, recomputes its HMAC signature (tamper check), and returns a pass/fail bundle ' +
      '(verified + a checks[] array): exists, signed, signature_valid, completed, has_rendered_output_hash. Pass ' +
      'expect_* to also assert the job printed the right design / printer / copies / status. Use after a test ' +
      'print to confirm "it actually printed, correctly, untampered". A brand-new record may be unsigned for a ' +
      'moment — re-call to let the signing trigger catch up.',
    {
      job_id: z.string().describe('The print job id to verify'),
      expect_status: z.string().optional().describe('Assert the job ended in this status (e.g. completed)'),
      expect_design_id: z.string().optional().describe('Assert this design/template id was printed'),
      expect_printer_id: z.string().optional().describe('Assert it went to this printer id'),
      expect_copies: z.number().optional().describe('Assert this copy count'),
    },
    async (params: { job_id: string; expect_status?: string; expect_design_id?: string; expect_printer_id?: string; expect_copies?: number }) => {
      const qs = new URLSearchParams();
      if (params.expect_status) qs.set('expect_status', params.expect_status);
      if (params.expect_design_id) qs.set('expect_design_id', params.expect_design_id);
      if (params.expect_printer_id) qs.set('expect_printer_id', params.expect_printer_id);
      if (params.expect_copies !== undefined) qs.set('expect_copies', String(params.expect_copies));
      const q = qs.toString();
      const result = await client.get(`/audit/print-history/${encodeURIComponent(params.job_id)}/verify${q ? '?' + q : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── query_audit_trail ── richer than get_audit_trail (resource + paging)
  server.tool(
    'query_audit_trail',
    'Query the hash-chained audit trail — the immutable log of who did what, when. Each entry has an action ' +
      '(print.completed, print.failed, compliance.settings_updated, …), actor, resource, forensic data, and ' +
      'chain hashes. Filter by action, resource, or time window. Newest-first by the monotonic seq counter.',
    {
      action: z.string().optional().describe('Filter by action type'),
      resource_type: z.string().optional().describe('Filter by resource type (print_job, design, compliance_settings)'),
      resource_id: z.string().optional().describe('Filter to a single resource id'),
      start: z.string().optional().describe('ISO-8601 start of the time window'),
      end: z.string().optional().describe('ISO-8601 end of the time window'),
      limit: z.number().optional().describe('Max entries (1-200, default 50)'),
      page_token: z.string().optional().describe('Pagination cursor'),
    },
    async (params: { action?: string; resource_type?: string; resource_id?: string; start?: string; end?: string; limit?: number; page_token?: string }) => {
      const qs = new URLSearchParams();
      if (params.action) qs.set('action', params.action);
      if (params.resource_type) qs.set('resource_type', params.resource_type);
      if (params.resource_id) qs.set('resource_id', params.resource_id);
      if (params.start) qs.set('start', params.start);
      if (params.end) qs.set('end', params.end);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.page_token) qs.set('page_token', params.page_token);
      const q = qs.toString();
      const result = await client.get(`/audit/trail${q ? '?' + q : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_audit_entry ──
  server.tool(
    'get_audit_entry',
    'Get a single audit-trail entry by id (full data + chain hashes).',
    {
      entry_id: z.string().describe('The audit entry id'),
    },
    async (params: { entry_id: string }) => {
      const result = await client.get(`/audit/trail/${encodeURIComponent(params.entry_id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── verify_audit_chain ── tamper-evidence proof
  server.tool(
    'verify_audit_chain',
    'Verify the integrity of the hash-chained audit log over a seq range. Walks each entry and confirms its ' +
      'prevHash matches the previous entry\'s contentHash. Returns chain_intact + any breaks (tamper evidence). ' +
      'Use to prove to an auditor the trail has not been altered.',
    {
      start_seq: z.number().optional().describe('Start of the seq range'),
      end_seq: z.number().optional().describe('End of the seq range'),
      limit: z.number().optional().describe('Max entries to walk (1-2000, default 500)'),
    },
    async (params: { start_seq?: number; end_seq?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params.start_seq !== undefined) qs.set('start_seq', String(params.start_seq));
      if (params.end_seq !== undefined) qs.set('end_seq', String(params.end_seq));
      if (params.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      const result = await client.get(`/audit/verify-chain${q ? '?' + q : ''}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_serial_pool / serial_pool_report ──
  // NOTE: pool routes resolve under /audit/compliance/* (the gateway sends
  // /v1/compliance/* to the audit handler, which only matches after the
  // /v1/audit prefix). Go through /audit/compliance here.
  server.tool(
    'get_serial_pool',
    'Get one serialization pool\'s details + allocation stats.',
    {
      pool_id: z.string().describe('The pool id'),
    },
    async (params: { pool_id: string }) => {
      const result = await client.get(`/audit/compliance/pools/${encodeURIComponent(params.pool_id)}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'serial_pool_report',
    'Compliance report for a pool: allocated / voided / current-sequence + status breakdown.',
    {
      pool_id: z.string().describe('The pool id'),
    },
    async (params: { pool_id: string }) => {
      const result = await client.get(`/audit/compliance/pools/${encodeURIComponent(params.pool_id)}/report`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── create_serial_pool ──
  server.tool(
    'create_serial_pool',
    'Create a serialization pool for GS1, UDI, SSCC, or custom serial numbers. Used for compliance tracking.',
    {
      name: z.string().describe('Pool name (e.g., "GS1 Shipping Labels Q2 2026")'),
      format: z.string().describe('"gs1-128", "sgtin-96", "udi", "sscc", "gs1-datamatrix", or "custom"'),
      pattern: z.string().describe('Format pattern (e.g., "(01){gtin}(21){serial}")'),
      start: z.string().describe('Starting serial number'),
      count: z.number().describe('Total pool size'),
    },
    async (params: { name: string; format: string; pattern: string; start: string; count: number }) => {
      const result = await client.createSerialPool({
        name: params.name,
        format: params.format,
        pattern: params.pattern,
        range: { start: params.start, count: params.count },
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_serial_pools ──
  server.tool(
    'list_serial_pools',
    'List all serialization pools with their allocation status.',
    {},
    async () => {
      const pools = await client.listSerialPools();
      return { content: [{ type: 'text', text: JSON.stringify(pools, null, 2) }] };
    }
  );

  // ── allocate_serials ──
  server.tool(
    'allocate_serials',
    'Allocate serial numbers from a pool. Returns the next N unique serial numbers.',
    {
      pool_id: z.string().describe('The pool ID'),
      count: z.number().describe('How many serials to allocate (1-10000)'),
    },
    async (params: { pool_id: string; count: number }) => {
      const result = await client.allocateSerials(params.pool_id, params.count);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── void_serials ──
  server.tool(
    'void_serials',
    'Void (cancel) serial numbers from a pool. Records reason for compliance audit.',
    {
      pool_id: z.string().describe('The pool ID'),
      serials: z.array(z.unknown()).describe('Array of serial numbers to void'),
      reason: z.string().describe('Reason for voiding (e.g., "print defect", "label damaged")'),
    },
    async (params: { pool_id: string; serials: string[]; reason: string }) => {
      const result = await client.voidSerials(params.pool_id, params.serials, params.reason);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── webhook management ──
  server.tool(
    'create_webhook',
    'Subscribe to real-time events via webhook. Events: print.job.completed, print.job.failed, printer.status.changed, printer.supply.low, etc.',
    {
      url: z.string().describe('HTTPS webhook URL to receive events'),
      events: z.array(z.unknown()).describe('Event types to subscribe to'),
      description: z.string().optional().describe('Description'),
    },
    async (params: { url: string; events: string[]; description?: string }) => {
      const result = await client.createWebhook(params.url, params.events, params.description);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_webhooks ──
  server.tool(
    'list_webhooks',
    'List all webhook subscriptions.',
    {},
    async () => {
      const hooks = await client.listWebhooks();
      return { content: [{ type: 'text', text: JSON.stringify(hooks, null, 2) }] };
    }
  );

  // ── delete_webhook ──
  server.tool(
    'delete_webhook',
    'Delete a webhook subscription.',
    {
      webhook_id: z.string().describe('The webhook ID to delete'),
    },
    async (params: { webhook_id: string }) => {
      const result = await client.deleteWebhook(params.webhook_id);
      return { content: [{ type: 'text', text: `Webhook deleted. ${JSON.stringify(result)}` }] };
    }
  );

  // ── get_webhook ──
  server.tool(
    'get_webhook',
    'Get details of a specific webhook subscription.',
    {
      webhook_id: z.string().describe('The webhook ID'),
    },
    async (params: { webhook_id: string }) => {
      const result = await client.get(`/webhooks/${params.webhook_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── update_webhook ──
  server.tool(
    'update_webhook',
    'Update a webhook subscription (URL, events, enabled state).',
    {
      webhook_id: z.string().describe('The webhook ID to update'),
      url: z.string().optional().describe('New webhook URL'),
      events: z.array(z.unknown()).optional().describe('New event types'),
      enabled: z.boolean().optional().describe('Enable or disable'),
    },
    async (params: { webhook_id: string; url?: string; events?: string[]; enabled?: boolean }) => {
      const { webhook_id, ...body } = params;
      const result = await client.put(`/webhooks/${webhook_id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── test_webhook ──
  server.tool(
    'test_webhook',
    'Send a test ping to a webhook endpoint to verify it is reachable.',
    {
      webhook_id: z.string().describe('The webhook ID to test'),
    },
    async (params: { webhook_id: string }) => {
      const result = await client.post(`/webhooks/${params.webhook_id}/test`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── webhook_deliveries ──
  server.tool(
    'webhook_deliveries',
    'List recent delivery attempts for a webhook.',
    {
      webhook_id: z.string().describe('The webhook ID'),
      limit: z.number().optional().describe('Max deliveries to return'),
    },
    async (params: { webhook_id: string; limit?: number }) => {
      const qs = params.limit ? `?limit=${params.limit}` : '';
      const result = await client.get(`/webhooks/${params.webhook_id}/deliveries${qs}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── webhook_events ──
  server.tool(
    'webhook_events',
    'List all available webhook event types you can subscribe to.',
    {},
    async () => {
      const result = await client.get('/webhooks/events');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
