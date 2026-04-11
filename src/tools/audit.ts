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
    'Get aggregate audit summary: how many prints, cancels, verifications, etc. by action type.',
    {},
    async () => {
      const result = await client.getAuditSummary();
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
