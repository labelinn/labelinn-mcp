/**
 * MCP Resources — Live data endpoints that AI can read
 */
import { LabelInnClient } from '../utils/api-client.js';

export function registerResources(server: any, client: LabelInnClient) {
  // ── Fleet Overview ──
  server.resource(
    'printers',
    'labelinn://printers',
    'Live printer fleet status — all registered printers with online/offline state',
    async () => {
      const printers = await client.listPrinters();
      return {
        contents: [{
          uri: 'labelinn://printers',
          mimeType: 'application/json',
          text: JSON.stringify(printers, null, 2),
        }],
      };
    }
  );

  // ── Design Catalog ──
  server.resource(
    'designs',
    'labelinn://designs',
    'All available label design templates with names, dimensions, and categories',
    async () => {
      const designs = await client.listDesigns(100);
      return {
        contents: [{
          uri: 'labelinn://designs',
          mimeType: 'application/json',
          text: JSON.stringify(designs, null, 2),
        }],
      };
    }
  );

  // ── API Usage ──
  server.resource(
    'usage',
    'labelinn://usage',
    'Current API usage statistics — calls today, remaining quota, plan limits',
    async () => {
      const usage = await client.getUsage();
      return {
        contents: [{
          uri: 'labelinn://usage',
          mimeType: 'application/json',
          text: JSON.stringify(usage, null, 2),
        }],
      };
    }
  );

  // ── Recent Jobs ──
  server.resource(
    'recent-jobs',
    'labelinn://jobs/recent',
    'Most recent 20 print jobs with their status',
    async () => {
      const jobs = await client.listJobs({ limit: 20 });
      return {
        contents: [{
          uri: 'labelinn://jobs/recent',
          mimeType: 'application/json',
          text: JSON.stringify(jobs, null, 2),
        }],
      };
    }
  );

  // ── Fleet Health ──
  server.resource(
    'fleet-health',
    'labelinn://fleet/health',
    'Fleet-wide health overview with healthy/warning/critical printers',
    async () => {
      try {
        const health = await client.edgeFleetHealth();
        return {
          contents: [{
            uri: 'labelinn://fleet/health',
            mimeType: 'application/json',
            text: JSON.stringify(health, null, 2),
          }],
        };
      } catch {
        return { contents: [{ uri: 'labelinn://fleet/health', mimeType: 'text/plain', text: 'Edge Server not available' }] };
      }
    }
  );

  // ── Automation Rules ──
  server.resource(
    'rules',
    'labelinn://rules',
    'All configured automation rules with enabled/disabled status',
    async () => {
      const rules = await client.listRules();
      return {
        contents: [{
          uri: 'labelinn://rules',
          mimeType: 'application/json',
          text: JSON.stringify(rules, null, 2),
        }],
      };
    }
  );

  // ── Audit Summary ──
  server.resource(
    'audit-summary',
    'labelinn://audit/summary',
    'Aggregate audit summary — print/cancel/verify counts by action type',
    async () => {
      const summary = await client.getAuditSummary();
      return {
        contents: [{
          uri: 'labelinn://audit/summary',
          mimeType: 'application/json',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    }
  );

  // ── Sites ──
  server.resource(
    'sites',
    'labelinn://sites',
    'All registered sites/locations with printer assignments',
    async () => {
      const sites = await client.listSites();
      return {
        contents: [{
          uri: 'labelinn://sites',
          mimeType: 'application/json',
          text: JSON.stringify(sites, null, 2),
        }],
      };
    }
  );

  // ── Edge Server Status ──
  server.resource(
    'edge-status',
    'labelinn://edge/status',
    'Local Edge Server health, version, mode, and uptime',
    async () => {
      try {
        const status = await client.edgeHealth();
        return {
          contents: [{
            uri: 'labelinn://edge/status',
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          }],
        };
      } catch {
        return { contents: [{ uri: 'labelinn://edge/status', mimeType: 'text/plain', text: 'Edge Server not available' }] };
      }
    }
  );
}
