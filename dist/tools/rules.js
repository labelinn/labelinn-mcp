"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRulesTools = registerRulesTools;
function registerRulesTools(server, client) {
    // ── create_rule ──
    server.tool('create_rule', 'Create a no-code automation rule. Rules trigger on events (print job created, printer offline, etc.) and execute actions (reroute, add label, notify).', {
        name: { type: 'string', description: 'Rule name (e.g., "Fragile Label for Heavy Items")' },
        trigger: { type: 'string', description: 'Trigger event: "printJobCreated", "printJobCompleted", "printJobFailed", "printerStatusChanged", "supplyAlert", "verifyScanPassed", "verifyScanFailed", "scheduleDaily", "manual"' },
        conditions: { type: 'array', description: 'Array of condition objects: [{field, operator, value}]. Operators: eq, neq, gt, gte, lt, lte, contains, startsWith, endsWith, inList, exists, matches' },
        actions: { type: 'array', description: 'Array of action objects: [{type, ...params}]. Types: addLabel, setCopies, routeToGroup, routeToPrinter, setPriority, sendWebhook, cancelJob, delay, transformData, log, notify' },
        enabled: { type: 'boolean', description: 'Whether the rule is active', required: false },
        priority: { type: 'number', description: 'Priority (lower = higher priority)', required: false },
    }, async (params) => {
        const result = await client.createRule(params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_rules ──
    server.tool('list_rules', 'List all automation rules.', {}, async () => {
        const rules = await client.listRules();
        return { content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }] };
    });
    // ── get_rule ──
    server.tool('get_rule', 'Get details of a specific rule.', {
        rule_id: { type: 'string', description: 'The rule ID' },
    }, async (params) => {
        const rule = await client.getRule(params.rule_id);
        return { content: [{ type: 'text', text: JSON.stringify(rule, null, 2) }] };
    });
    // ── update_rule ──
    server.tool('update_rule', 'Update an existing rule\'s conditions, actions, or enabled status.', {
        rule_id: { type: 'string', description: 'The rule ID' },
        name: { type: 'string', description: 'New name', required: false },
        enabled: { type: 'boolean', description: 'Enable or disable', required: false },
        conditions: { type: 'array', description: 'New conditions array', required: false },
        actions: { type: 'array', description: 'New actions array', required: false },
        priority: { type: 'number', description: 'New priority', required: false },
    }, async (params) => {
        const { rule_id, ...data } = params;
        const result = await client.updateRule(rule_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_rule ──
    server.tool('delete_rule', 'Delete an automation rule.', {
        rule_id: { type: 'string', description: 'The rule ID to delete' },
    }, async (params) => {
        const result = await client.deleteRule(params.rule_id);
        return { content: [{ type: 'text', text: `Rule ${params.rule_id} deleted. ${JSON.stringify(result)}` }] };
    });
    // ── test_rule ──
    server.tool('test_rule', 'Dry-run test a rule against sample data. Shows what would happen without actually executing actions.', {
        rule_id: { type: 'string', description: 'The rule ID to test' },
        sample_data: { type: 'object', description: 'Sample context data to evaluate the rule against (e.g., {"data.weight_kg": 15, "printer.status": "offline"})' },
    }, async (params) => {
        const result = await client.testRule(params.rule_id, params.sample_data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
