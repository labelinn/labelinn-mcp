"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFleetTools = registerFleetTools;
const zod_1 = require("zod");
function registerFleetTools(server, client) {
    // ── list_printers ──
    // UNIFIED PRINTERS: one list for every printer, with family/kind filters.
    server.tool('list_printers', 'List all registered printers in the fleet: label, receipt, color and office printers in one list. ' +
        'Shows name, status (online/offline), type, and connection info. ' +
        'Each printer has `kind`: "label" (thermal/label printers: ZPL, TSPL, TPCL, DYMO, Brother QL), ' +
        '"receipt" (ESC/POS and Phomemo on 58/80 mm rolls), "color" (Epson ColorWorks) or "office" (A4/Letter printers), ' +
        'plus `family` / `printer_family` ("label" | "office"). Office (A4) printers print designs as label sheets ' +
        '(e.g. 21 labels per A4 sheet) or, for page-sized designs, as whole pages; they also print images and PDFs ' +
        'when the printer\'s `office.payload_types` includes "image". Never send ZPL to an office printer. ' +
        'Passing `family` or `kind` always reads the cloud list (which carries these fields); without a filter the ' +
        'local desktop app\'s list may be returned instead.', {
        status: zod_1.z.string().optional().describe('Filter by status: "online" or "offline"'),
        family: zod_1.z.enum(['label', 'office']).optional().describe('Filter by family: "label" or "office"'),
        kind: zod_1.z.enum(['label', 'receipt', 'color', 'office']).optional()
            .describe('Filter by kind: "label", "receipt", "color" or "office"'),
    }, async (params) => {
        const printers = await client.listPrintersSmart(params.status, { family: params.family, kind: params.kind });
        return { content: [{ type: 'text', text: JSON.stringify(printers, null, 2) }] };
    });
    // ── get_printer_status ──
    server.tool('get_printer_status', 'Get the live status of a specific printer including online/offline state, supply levels, and last seen time.', {
        printer_id: zod_1.z.string().describe('The printer ID to check'),
    }, async (params) => {
        const status = await client.getPrinterStatusSmart(params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    });
    // ── get_printer_details ──
    server.tool('get_printer_details', 'Get full details of a printer including telemetry, media configuration, supply levels, and print history stats.', {
        printer_id: zod_1.z.string().describe('The printer ID'),
    }, async (params) => {
        const printer = await client.getPrinter(params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(printer, null, 2) }] };
    });
    // ── discover_printers ──
    server.tool('discover_printers', 'Scan the network and USB ports to find new printers. Returns a discovery session ID to poll for results.', {}, async () => {
        const result = await client.discoverPrinters();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_discovery_results ──
    server.tool('get_discovery_results', 'Get results from a printer discovery session. Use after discover_printers.', {
        session_id: zod_1.z.string().describe('Discovery session ID from discover_printers'),
    }, async (params) => {
        const result = await client.getDiscoveryResults(params.session_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── add_discovered_printer ──
    server.tool('add_discovered_printer', 'Add a printer found during discovery to the fleet.', {
        session_id: zod_1.z.string().describe('Discovery session ID'),
        printer_address: zod_1.z.string().describe('Address of the printer to add (IP or USB path)'),
    }, async (params) => {
        const result = await client.addDiscoveredPrinter(params.session_id, params.printer_address);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_printer ──
    server.tool('update_printer', 'Update a printer\'s display name, metadata, or other settings.', {
        printer_id: zod_1.z.string().describe('The printer ID'),
        display_name: zod_1.z.string().optional().describe('New display name'),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Custom metadata key-value pairs'),
    }, async (params) => {
        const data = {};
        if (params.display_name)
            data.display_name = params.display_name;
        if (params.metadata)
            data.metadata = params.metadata;
        const result = await client.updatePrinter(params.printer_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── identify_printer ──
    server.tool('identify_printer', 
    // UNIFIED PRINTERS: office printers refuse identify/command/media controls.
    'Flash the LEDs on a printer to physically identify it. Useful when multiple printers are nearby. ' +
        'Not available for office (A4) printers (409 OFFICE_PRINTER_UNSUPPORTED).', {
        printer_id: zod_1.z.string().describe('The printer ID to identify'),
    }, async (params) => {
        const result = await client.identifyPrinter(params.printer_id);
        return { content: [{ type: 'text', text: `Printer ${params.printer_id} is flashing its LEDs. ${JSON.stringify(result)}` }] };
    });
    // ── set_printer_media ──
    server.tool('set_printer_media', 
    // UNIFIED PRINTERS: office printers refuse identify/command/media controls.
    'Configure the media (label size, type, darkness, speed) on a printer. This calibrates the printer for specific label stock. ' +
        'Not available for office (A4) printers (409 OFFICE_PRINTER_UNSUPPORTED); use the `office` options of print_label instead.', {
        printer_id: zod_1.z.string().describe('The printer ID'),
        width_mm: zod_1.z.number().describe('Label width in mm'),
        height_mm: zod_1.z.number().describe('Label height in mm'),
        media_type: zod_1.z.string().optional().describe('"gap", "continuous", or "mark"'),
        gap_mm: zod_1.z.number().optional().describe('Gap between labels in mm'),
        darkness: zod_1.z.number().optional().describe('Print darkness 0-30'),
        speed: zod_1.z.number().optional().describe('Print speed'),
    }, async (params) => {
        const media = { width_mm: params.width_mm, height_mm: params.height_mm };
        if (params.media_type)
            media.media_type = params.media_type;
        if (params.gap_mm !== undefined)
            media.gap_mm = params.gap_mm;
        if (params.darkness !== undefined)
            media.darkness = params.darkness;
        if (params.speed !== undefined)
            media.speed = params.speed;
        const result = await client.setPrinterMedia(params.printer_id, media);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── create_printer_group ──
    server.tool('create_printer_group', 'Create a group of printers for load balancing, failover, or organizational purposes.', {
        name: zod_1.z.string().describe('Group name (e.g., "Warehouse A Printers")'),
        printer_ids: zod_1.z.array(zod_1.z.unknown()).describe('Array of printer IDs to include'),
        description: zod_1.z.string().optional().describe('Group description'),
    }, async (params) => {
        const result = await client.createPrinterGroup(params.name, params.printer_ids, params.description);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_printer_groups ──
    server.tool('list_printer_groups', 'List all printer groups.', {}, async () => {
        const groups = await client.listPrinterGroups();
        return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
    });
}
