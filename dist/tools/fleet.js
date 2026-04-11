"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFleetTools = registerFleetTools;
function registerFleetTools(server, client) {
    // ── list_printers ──
    server.tool('list_printers', 'List all registered thermal printers in the fleet. Shows name, status (online/offline), type, and connection info.', {
        status: { type: 'string', description: 'Filter by status: "online" or "offline"', required: false },
    }, async (params) => {
        const printers = await client.listPrinters(params.status);
        return { content: [{ type: 'text', text: JSON.stringify(printers, null, 2) }] };
    });
    // ── get_printer_status ──
    server.tool('get_printer_status', 'Get the live status of a specific printer including online/offline state, supply levels, and last seen time.', {
        printer_id: { type: 'string', description: 'The printer ID to check' },
    }, async (params) => {
        const status = await client.getPrinterStatus(params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    });
    // ── get_printer_details ──
    server.tool('get_printer_details', 'Get full details of a printer including telemetry, media configuration, supply levels, and print history stats.', {
        printer_id: { type: 'string', description: 'The printer ID' },
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
        session_id: { type: 'string', description: 'Discovery session ID from discover_printers' },
    }, async (params) => {
        const result = await client.getDiscoveryResults(params.session_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── add_discovered_printer ──
    server.tool('add_discovered_printer', 'Add a printer found during discovery to the fleet.', {
        session_id: { type: 'string', description: 'Discovery session ID' },
        printer_address: { type: 'string', description: 'Address of the printer to add (IP or USB path)' },
    }, async (params) => {
        const result = await client.addDiscoveredPrinter(params.session_id, params.printer_address);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_printer ──
    server.tool('update_printer', 'Update a printer\'s display name, metadata, or other settings.', {
        printer_id: { type: 'string', description: 'The printer ID' },
        display_name: { type: 'string', description: 'New display name', required: false },
        metadata: { type: 'object', description: 'Custom metadata key-value pairs', required: false },
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
    server.tool('identify_printer', 'Flash the LEDs on a printer to physically identify it. Useful when multiple printers are nearby.', {
        printer_id: { type: 'string', description: 'The printer ID to identify' },
    }, async (params) => {
        const result = await client.identifyPrinter(params.printer_id);
        return { content: [{ type: 'text', text: `Printer ${params.printer_id} is flashing its LEDs. ${JSON.stringify(result)}` }] };
    });
    // ── set_printer_media ──
    server.tool('set_printer_media', 'Configure the media (label size, type, darkness, speed) on a printer. This calibrates the printer for specific label stock.', {
        printer_id: { type: 'string', description: 'The printer ID' },
        width_mm: { type: 'number', description: 'Label width in mm' },
        height_mm: { type: 'number', description: 'Label height in mm' },
        media_type: { type: 'string', description: '"gap", "continuous", or "mark"', required: false },
        gap_mm: { type: 'number', description: 'Gap between labels in mm', required: false },
        darkness: { type: 'number', description: 'Print darkness 0-30', required: false },
        speed: { type: 'number', description: 'Print speed', required: false },
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
        name: { type: 'string', description: 'Group name (e.g., "Warehouse A Printers")' },
        printer_ids: { type: 'array', description: 'Array of printer IDs to include' },
        description: { type: 'string', description: 'Group description', required: false },
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
