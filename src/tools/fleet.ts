/**
 * Fleet management MCP tools
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerFleetTools(server: any, client: LabelInnClient) {
  // ── list_printers ──
  server.tool(
    'list_printers',
    'List all registered thermal printers in the fleet. Shows name, status (online/offline), type, and connection info.',
    {
      status: z.string().optional().describe('Filter by status: "online" or "offline"'),
    },
    async (params: { status?: string }) => {
      const printers = await client.listPrinters(params.status);
      return { content: [{ type: 'text', text: JSON.stringify(printers, null, 2) }] };
    }
  );

  // ── get_printer_status ──
  server.tool(
    'get_printer_status',
    'Get the live status of a specific printer including online/offline state, supply levels, and last seen time.',
    {
      printer_id: z.string().describe('The printer ID to check'),
    },
    async (params: { printer_id: string }) => {
      const status = await client.getPrinterStatus(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  );

  // ── get_printer_details ──
  server.tool(
    'get_printer_details',
    'Get full details of a printer including telemetry, media configuration, supply levels, and print history stats.',
    {
      printer_id: z.string().describe('The printer ID'),
    },
    async (params: { printer_id: string }) => {
      const printer = await client.getPrinter(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(printer, null, 2) }] };
    }
  );

  // ── discover_printers ──
  server.tool(
    'discover_printers',
    'Scan the network and USB ports to find new printers. Returns a discovery session ID to poll for results.',
    {},
    async () => {
      const result = await client.discoverPrinters();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_discovery_results ──
  server.tool(
    'get_discovery_results',
    'Get results from a printer discovery session. Use after discover_printers.',
    {
      session_id: z.string().describe('Discovery session ID from discover_printers'),
    },
    async (params: { session_id: string }) => {
      const result = await client.getDiscoveryResults(params.session_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── add_discovered_printer ──
  server.tool(
    'add_discovered_printer',
    'Add a printer found during discovery to the fleet.',
    {
      session_id: z.string().describe('Discovery session ID'),
      printer_address: z.string().describe('Address of the printer to add (IP or USB path)'),
    },
    async (params: { session_id: string; printer_address: string }) => {
      const result = await client.addDiscoveredPrinter(params.session_id, params.printer_address);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── update_printer ──
  server.tool(
    'update_printer',
    'Update a printer\'s display name, metadata, or other settings.',
    {
      printer_id: z.string().describe('The printer ID'),
      display_name: z.string().optional().describe('New display name'),
      metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata key-value pairs'),
    },
    async (params: { printer_id: string; display_name?: string; metadata?: Record<string, unknown> }) => {
      const data: Record<string, unknown> = {};
      if (params.display_name) data.display_name = params.display_name;
      if (params.metadata) data.metadata = params.metadata;
      const result = await client.updatePrinter(params.printer_id, data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── identify_printer ──
  server.tool(
    'identify_printer',
    'Flash the LEDs on a printer to physically identify it. Useful when multiple printers are nearby.',
    {
      printer_id: z.string().describe('The printer ID to identify'),
    },
    async (params: { printer_id: string }) => {
      const result = await client.identifyPrinter(params.printer_id);
      return { content: [{ type: 'text', text: `Printer ${params.printer_id} is flashing its LEDs. ${JSON.stringify(result)}` }] };
    }
  );

  // ── set_printer_media ──
  server.tool(
    'set_printer_media',
    'Configure the media (label size, type, darkness, speed) on a printer. This calibrates the printer for specific label stock.',
    {
      printer_id: z.string().describe('The printer ID'),
      width_mm: z.number().describe('Label width in mm'),
      height_mm: z.number().describe('Label height in mm'),
      media_type: z.string().optional().describe('"gap", "continuous", or "mark"'),
      gap_mm: z.number().optional().describe('Gap between labels in mm'),
      darkness: z.number().optional().describe('Print darkness 0-30'),
      speed: z.number().optional().describe('Print speed'),
    },
    async (params: { printer_id: string; width_mm: number; height_mm: number; media_type?: string; gap_mm?: number; darkness?: number; speed?: number }) => {
      const media: Record<string, unknown> = { width_mm: params.width_mm, height_mm: params.height_mm };
      if (params.media_type) media.media_type = params.media_type;
      if (params.gap_mm !== undefined) media.gap_mm = params.gap_mm;
      if (params.darkness !== undefined) media.darkness = params.darkness;
      if (params.speed !== undefined) media.speed = params.speed;
      const result = await client.setPrinterMedia(params.printer_id, media);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── create_printer_group ──
  server.tool(
    'create_printer_group',
    'Create a group of printers for load balancing, failover, or organizational purposes.',
    {
      name: z.string().describe('Group name (e.g., "Warehouse A Printers")'),
      printer_ids: z.array(z.unknown()).describe('Array of printer IDs to include'),
      description: z.string().optional().describe('Group description'),
    },
    async (params: { name: string; printer_ids: string[]; description?: string }) => {
      const result = await client.createPrinterGroup(params.name, params.printer_ids, params.description);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_printer_groups ──
  server.tool(
    'list_printer_groups',
    'List all printer groups.',
    {},
    async () => {
      const groups = await client.listPrinterGroups();
      return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
    }
  );
}
