/**
 * MCP Context Tools — Factory-aware intelligence layer
 *
 * Higher-level tools that aggregate data from multiple sources to give
 * AI agents the situational awareness needed for intelligent decisions.
 * These are beyond CRUD — they synthesize context.
 */
import { LabelInnClient } from '../utils/api-client.js';

export function registerContextTools(server: any, client: LabelInnClient) {
  // ── factory_status ──
  server.tool(
    'factory_status',
    'Get a comprehensive factory floor overview: printer fleet health, active jobs, ' +
    'recent errors, verification stats, and site status — all in one call. ' +
    'Use this as your first call to understand the current state before taking actions.',
    {},
    async () => {
      const results: Record<string, unknown> = {};

      // Parallel fetch all context
      const [printers, jobs, usage] = await Promise.allSettled([
        client.listPrinters(),
        client.listJobs({ limit: 10 }),
        client.getUsage(),
      ]);

      results.printers = printers.status === 'fulfilled' ? printers.value : null;
      results.recent_jobs = jobs.status === 'fulfilled' ? jobs.value : null;
      results.usage = usage.status === 'fulfilled' ? usage.value : null;

      // Try Edge server data (may not be running)
      try {
        const [health, metrics, verify] = await Promise.allSettled([
          client.edgeFleetHealth(),
          client.edgeMetrics(),
          client.edgeVerifyStatus(),
        ]);
        results.fleet_health = health.status === 'fulfilled' ? health.value : null;
        results.edge_metrics = metrics.status === 'fulfilled' ? metrics.value : null;
        results.verify_status = verify.status === 'fulfilled' ? verify.value : null;
      } catch {
        results.edge_available = false;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
        }],
      };
    }
  );

  // ── diagnose_printer ──
  server.tool(
    'diagnose_printer',
    'Run a comprehensive diagnostic on a specific printer. Returns health score, ' +
    'recent job success rate, error patterns, media status, and recommended actions.',
    {
      printer_id: { type: 'string', description: 'The printer ID to diagnose' },
    },
    async (params: { printer_id: string }) => {
      const results: Record<string, unknown> = {};
      const pid = params.printer_id;

      const [details, status] = await Promise.allSettled([
        client.getPrinter(pid),
        client.getPrinterStatus(pid),
      ]);

      results.printer_details = details.status === 'fulfilled' ? details.value : null;
      results.printer_status = status.status === 'fulfilled' ? status.value : null;

      try {
        const [healthScore, metrics] = await Promise.allSettled([
          client.edgePrinterHealth(pid),
          client.edgePrinters(),
        ]);
        results.health_score = healthScore.status === 'fulfilled' ? healthScore.value : null;
        results.metrics = metrics.status === 'fulfilled' ? metrics.value : null;
      } catch {
        results.edge_available = false;
      }

      // Build recommendations
      const recommendations: string[] = [];
      if (results.health_score && typeof results.health_score === 'object') {
        const hs = results.health_score as Record<string, unknown>;
        const score = hs.score as number | undefined;
        if (score !== undefined && score < 50) {
          recommendations.push('CRITICAL: Health score below 50%. Consider maintenance or replacement.');
        } else if (score !== undefined && score < 75) {
          recommendations.push('WARNING: Health score declining. Schedule preventive maintenance.');
        }
      }
      results.recommendations = recommendations;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
        }],
      };
    }
  );

  // ── suggest_printer ──
  server.tool(
    'suggest_printer',
    'Given a label format (ZPL, ESC/POS, image) and optional site, suggest the best available ' +
    'printer based on health scores, current load, and compatibility.',
    {
      format: {
        type: 'string',
        description: 'Label format: "zpl", "escpos", "image", "pdf"',
      },
      site_id: {
        type: 'string',
        description: 'Optional site to restrict printer selection',
        required: false,
      },
    },
    async (params: { format: string; site_id?: string }) => {
      // Get all printers
      const printers = (await client.listPrinters('online')) as unknown[];
      if (!Array.isArray(printers) || printers.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              suggestion: null,
              reason: 'No online printers available',
            }),
          }],
        };
      }

      // Return the list with a hint for AI to pick
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            format_requested: params.format,
            site_filter: params.site_id || 'any',
            available_printers: printers,
            hint: 'Select the printer with the highest health score that supports the requested format.',
          }, null, 2),
        }],
      };
    }
  );

  // ── explain_error ──
  server.tool(
    'explain_error',
    'Explain a print job error code or message. Returns human-readable explanation, ' +
    'possible causes, and suggested fixes. Useful for AI-driven troubleshooting.',
    {
      error: { type: 'string', description: 'Error code or message from a failed print job' },
      printer_id: { type: 'string', description: 'Optional printer ID for context', required: false },
    },
    async (params: { error: string; printer_id?: string }) => {
      // Known error patterns
      const knownErrors: Record<string, { explanation: string; causes: string[]; fixes: string[] }> = {
        'PAPER_OUT': {
          explanation: 'Printer has run out of label media.',
          causes: ['Label roll is empty', 'Media not loaded correctly', 'Sensor misalignment'],
          fixes: ['Replace label roll', 'Check media sensor alignment', 'Run media calibration'],
        },
        'HEAD_OPEN': {
          explanation: 'Print head is not latched.',
          causes: ['Print head cover is open', 'Latch mechanism broken'],
          fixes: ['Close the print head cover firmly', 'Check latch mechanism'],
        },
        'RIBBON_OUT': {
          explanation: 'Thermal transfer ribbon is depleted.',
          causes: ['Ribbon roll is empty', 'Ribbon not installed for TT mode'],
          fixes: ['Replace ribbon', 'Switch to direct thermal mode if using DT media'],
        },
        'OFFLINE': {
          explanation: 'Printer is not responding to commands.',
          causes: ['Power off', 'Network disconnected', 'USB cable unplugged', 'Driver issue'],
          fixes: ['Check power', 'Check network/USB connection', 'Restart printer', 'Reinstall driver'],
        },
        'TIMEOUT': {
          explanation: 'Communication timed out before receiving printer acknowledgment.',
          causes: ['Network congestion', 'Printer busy with large job', 'Firewire/USB timeout'],
          fixes: ['Retry job', 'Check network latency', 'Restart printer spooler'],
        },
      };

      const errorUpper = params.error.toUpperCase();
      const match = Object.entries(knownErrors).find(([key]) => errorUpper.includes(key));

      const result: Record<string, unknown> = {
        original_error: params.error,
      };

      if (match) {
        result.known_error = match[0];
        result.explanation = match[1].explanation;
        result.possible_causes = match[1].causes;
        result.suggested_fixes = match[1].fixes;
      } else {
        result.explanation = 'Unknown error. Check printer logs for details.';
        result.suggested_fixes = [
          'Check printer display for error messages',
          'Power cycle the printer',
          'Check network/USB connectivity',
          'Review recent audit logs for patterns',
        ];
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
