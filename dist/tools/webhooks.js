"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebhookTools = registerWebhookTools;
const zod_1 = require("zod");
function registerWebhookTools(server, client) {
    // ── create_webhook ──
    server.tool('create_webhook', 'Create a webhook subscription to receive real-time notifications for events like print.job.completed, printer.offline, etc.', {
        url: zod_1.z.string().describe('HTTPS endpoint URL to receive webhook events'),
        events: zod_1.z.array(zod_1.z.string()).describe('Array of event types to subscribe to (e.g., ["print.job.completed", "printer.offline"])'),
        description: zod_1.z.string().optional().describe('Human-readable description of this webhook'),
    }, async (params) => {
        const result = await client.createWebhook(params.url, params.events, params.description);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_webhooks ──
    server.tool('list_webhooks', 'List all webhook subscriptions for this account.', {}, async () => {
        const result = await client.listWebhooks();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_webhook ──
    server.tool('get_webhook', 'Get details of a specific webhook subscription.', {
        webhook_id: zod_1.z.string().describe('The webhook ID'),
    }, async (params) => {
        const result = await client.get(`/webhooks/${encodeURIComponent(params.webhook_id)}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_webhook ──
    server.tool('update_webhook', 'Update a webhook subscription URL, events, or enabled state.', {
        webhook_id: zod_1.z.string().describe('The webhook ID to update'),
        url: zod_1.z.string().optional().describe('New endpoint URL'),
        events: zod_1.z.array(zod_1.z.string()).optional().describe('Updated event list'),
        description: zod_1.z.string().optional().describe('Updated description'),
        enabled: zod_1.z.boolean().optional().describe('Enable or disable the webhook'),
    }, async (params) => {
        const body = {};
        if (params.url)
            body.url = params.url;
        if (params.events)
            body.events = params.events;
        if (params.description !== undefined)
            body.description = params.description;
        if (params.enabled !== undefined)
            body.isActive = params.enabled;
        const result = await client.put(`/webhooks/${encodeURIComponent(params.webhook_id)}`, body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_webhook ──
    server.tool('delete_webhook', 'Delete a webhook subscription.', {
        webhook_id: zod_1.z.string().describe('The webhook ID to delete'),
    }, async (params) => {
        const result = await client.deleteWebhook(params.webhook_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── test_webhook ──
    server.tool('test_webhook', 'Send a test event to a webhook endpoint to verify it is working.', {
        webhook_id: zod_1.z.string().describe('The webhook ID to test'),
    }, async (params) => {
        const result = await client.post(`/webhooks/${encodeURIComponent(params.webhook_id)}/test`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_webhook_deliveries ──
    server.tool('list_webhook_deliveries', 'View recent delivery attempts for a webhook, including HTTP status codes and timestamps.', {
        webhook_id: zod_1.z.string().describe('The webhook ID'),
        limit: zod_1.z.number().optional().describe('Max results to return'),
    }, async (params) => {
        const qs = params.limit ? `?limit=${params.limit}` : '';
        const result = await client.get(`/webhooks/${encodeURIComponent(params.webhook_id)}/deliveries${qs}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_webhook_events ──
    server.tool('list_webhook_events', 'List all available webhook event types (28 events across print, printer, design, verify, rules, render, edge, system).', {}, async () => {
        const result = await client.get('/webhooks/events');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
