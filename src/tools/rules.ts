/**
 * Rules Engine MCP tools
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerRulesTools(server: any, client: LabelInnClient) {
  // ── create_rule ──
  server.tool(
    'create_rule',
    'Create a no-code automation rule. Rules trigger on events (print job created, printer offline, etc.) and execute actions (reroute, add label, notify).',
    {
      name: z.string().describe('Rule name (e.g., "Fragile Label for Heavy Items")'),
      trigger: z.string().describe('Trigger event: "printJobCreated", "printJobCompleted", "printJobFailed", "printerStatusChanged", "supplyAlert", "verifyScanPassed", "verifyScanFailed", "scheduleDaily", "manual"'),
      conditions: z.array(z.unknown()).describe('Array of condition objects: [{field, operator, value}]. Operators: eq, neq, gt, gte, lt, lte, contains, startsWith, endsWith, inList, exists, matches'),
      actions: z.array(z.unknown()).describe('Array of action objects: [{type, ...params}]. Types: addLabel, setCopies, routeToGroup, routeToPrinter, setPriority, sendWebhook, cancelJob, delay, transformData, log, notify'),
      enabled: z.boolean().optional().describe('Whether the rule is active'),
      priority: z.number().optional().describe('Priority (lower = higher priority)'),
    },
    async (params: { name: string; trigger: string; conditions: unknown[]; actions: unknown[]; enabled?: boolean; priority?: number }) => {
      const result = await client.createRule(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_rules ──
  server.tool(
    'list_rules',
    'List all automation rules.',
    {},
    async () => {
      const rules = await client.listRules();
      return { content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }] };
    }
  );

  // ── get_rule ──
  server.tool(
    'get_rule',
    'Get details of a specific rule.',
    {
      rule_id: z.string().describe('The rule ID'),
    },
    async (params: { rule_id: string }) => {
      const rule = await client.getRule(params.rule_id);
      return { content: [{ type: 'text', text: JSON.stringify(rule, null, 2) }] };
    }
  );

  // ── update_rule ──
  server.tool(
    'update_rule',
    'Update an existing rule\'s conditions, actions, or enabled status.',
    {
      rule_id: z.string().describe('The rule ID'),
      name: z.string().optional().describe('New name'),
      enabled: z.boolean().optional().describe('Enable or disable'),
      conditions: z.array(z.unknown()).optional().describe('New conditions array'),
      actions: z.array(z.unknown()).optional().describe('New actions array'),
      priority: z.number().optional().describe('New priority'),
    },
    async (params: { rule_id: string; [key: string]: unknown }) => {
      const { rule_id, ...data } = params;
      const result = await client.updateRule(rule_id as string, data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── delete_rule ──
  server.tool(
    'delete_rule',
    'Delete an automation rule.',
    {
      rule_id: z.string().describe('The rule ID to delete'),
    },
    async (params: { rule_id: string }) => {
      const result = await client.deleteRule(params.rule_id);
      return { content: [{ type: 'text', text: `Rule ${params.rule_id} deleted. ${JSON.stringify(result)}` }] };
    }
  );

  // ── test_rule ──
  server.tool(
    'test_rule',
    'Dry-run test a rule against sample data. Shows what would happen without actually executing actions.',
    {
      rule_id: z.string().describe('The rule ID to test'),
      sample_data: z.record(z.string(), z.unknown()).describe('Sample context data to evaluate the rule against (e.g., {"data.weight_kg": 15, "printer.status": "offline"})'),
    },
    async (params: { rule_id: string; sample_data: Record<string, unknown> }) => {
      const result = await client.testRule(params.rule_id, params.sample_data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
