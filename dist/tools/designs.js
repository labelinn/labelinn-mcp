"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDesignTools = registerDesignTools;
const zod_1 = require("zod");
function registerDesignTools(server, client) {
    // ── list_designs ──
    server.tool('list_designs', 'List all available label design templates. Returns name, dimensions, category, and element count.', {
        limit: zod_1.z.number().optional().describe('Max number of designs to return'),
    }, async (params) => {
        const designs = await client.listDesigns(params.limit);
        return { content: [{ type: 'text', text: JSON.stringify(designs, null, 2) }] };
    });
    // ── get_design ──
    server.tool('get_design', 'Get full details of a label design including all elements and their properties.', {
        design_id: zod_1.z.string().describe('The design ID'),
    }, async (params) => {
        const design = await client.getDesign(params.design_id);
        return { content: [{ type: 'text', text: JSON.stringify(design, null, 2) }] };
    });
    // ── get_design_variables ──
    server.tool('get_design_variables', 'Get the template variables for a design. These are the dynamic fields (like barcode, name, address) that can be filled with data when printing.', {
        design_id: zod_1.z.string().describe('The design ID to inspect'),
    }, async (params) => {
        const vars = await client.getDesignVariables(params.design_id);
        return { content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }] };
    });
    // ── get_design_binding_guide ──
    // Keep this local-MCP guide in lockstep with the hosted MCP endpoint. It is
    // deliberately read-only: agents should learn the persisted design syntax
    // before they edit an HTML or Symbol element.
    server.tool('get_design_binding_guide', 'Explain HTML template variables, Date/Time bindings, and row-driven symbol lists before authoring or printing a LabelInn design.', {}, async () => ({
        content: [{
                type: 'text',
                text: JSON.stringify({
                    html_variables: {
                        syntax: 'Use double braces in an HTML element: {{printed_at}} or {{product_name}}.',
                        binding: 'The token name remains the design variable name. Bind it to a source such as Date/Time, Excel, API, integration, or leave it unbound for print-form/workflow data.',
                        date_time: 'For {{printed_at}}, bind the Date/Time source and choose current time, an order date, or a fixed date plus its format.',
                        note: 'Single braces in CSS or JavaScript are not variables; only {{token}} is dynamic data.',
                    },
                    row_driven_symbols: {
                        binding: 'Bind a Symbol element to a source whose value is a per-row comma-separated list of catalogue keys.',
                        example: 'ghs/ghs02_flammable, ghs/ghs05_corrosive',
                        behavior: 'A non-empty row value replaces the manually selected symbol list for that row and the strip reflows. An empty value keeps the manually selected list as fallback.',
                    },
                    next_steps: [
                        'Use get_design_variables to inspect the names that a design accepts.',
                        'Pass matching keys in print_label.data or workflow row data.',
                        'Use get_design and the design-element tools when changing a saved design.',
                    ],
                }, null, 2),
            }],
    }));
    // ── clone_design ──
    server.tool('clone_design', 'Create a copy of an existing label design with a new name.', {
        design_id: zod_1.z.string().describe('The source design ID to clone'),
        name: zod_1.z.string().optional().describe('Name for the new cloned design'),
    }, async (params) => {
        const result = await client.cloneDesign(params.design_id, params.name);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── create_design ──
    server.tool('create_design', 'Create a new label design from scratch. Specify dimensions, name, and category.', {
        name: zod_1.z.string().describe('Design name'),
        width_mm: zod_1.z.number().describe('Label width in mm'),
        height_mm: zod_1.z.number().describe('Label height in mm'),
        category: zod_1.z.string().optional().describe('Category: "shipping", "product", "warehouse", etc.'),
    }, async (params) => {
        const result = await client.createDesign(params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_design ──
    server.tool('update_design', 'Update a design\'s name, dimensions, or metadata.', {
        design_id: zod_1.z.string().describe('The design ID to update'),
        name: zod_1.z.string().optional().describe('New name'),
        width_mm: zod_1.z.number().optional().describe('New width in mm'),
        height_mm: zod_1.z.number().optional().describe('New height in mm'),
    }, async (params) => {
        const { design_id, ...data } = params;
        const result = await client.updateDesign(design_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_design ──
    server.tool('delete_design', 'Delete a label design. Built-in designs cannot be deleted.', {
        design_id: zod_1.z.string().describe('The design ID to delete'),
    }, async (params) => {
        const result = await client.deleteDesign(params.design_id);
        return { content: [{ type: 'text', text: `Design ${params.design_id} deleted. ${JSON.stringify(result)}` }] };
    });
    // ── add_design_element ──
    server.tool('add_design_element', 'Add an element (text, barcode, image, shape) to a label design.', {
        design_id: zod_1.z.string().describe('The design ID'),
        type: zod_1.z.string().describe('Element type: "text", "barcode", "image", "shape", "line", "qr"'),
        x: zod_1.z.number().describe('X position in mm'),
        y: zod_1.z.number().describe('Y position in mm'),
        width: zod_1.z.number().describe('Width in mm'),
        height: zod_1.z.number().describe('Height in mm'),
        value: zod_1.z.string().optional().describe('Content: text string, barcode data, image URL, etc.'),
        data_source: zod_1.z.string().optional().describe('Variable binding: "{{product_name}}", "{{barcode}}", etc.'),
    }, async (params) => {
        const { design_id, ...element } = params;
        const result = await client.addElement(design_id, element);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_design_element ──
    server.tool('update_design_element', 'Update an element within a design (change position, size, value, or data source binding).', {
        design_id: zod_1.z.string().describe('The design ID'),
        element_id: zod_1.z.string().describe('The element ID to update'),
        x: zod_1.z.number().optional().describe('New X position'),
        y: zod_1.z.number().optional().describe('New Y position'),
        width: zod_1.z.number().optional().describe('New width'),
        height: zod_1.z.number().optional().describe('New height'),
        value: zod_1.z.string().optional().describe('New content value'),
        data_source: zod_1.z.string().optional().describe('New variable binding'),
    }, async (params) => {
        const { design_id, element_id, ...data } = params;
        const result = await client.updateElement(design_id, element_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_design_element ──
    server.tool('delete_design_element', 'Remove an element from a design.', {
        design_id: zod_1.z.string().describe('The design ID'),
        element_id: zod_1.z.string().describe('The element ID to remove'),
    }, async (params) => {
        const result = await client.deleteElement(params.design_id, params.element_id);
        return { content: [{ type: 'text', text: `Element ${params.element_id} removed. ${JSON.stringify(result)}` }] };
    });
    // ── render_design_preview ──
    server.tool('render_design_preview', 'Generate a preview image of a design with optional variable data filled in. Returns a preview URL.', {
        design_id: zod_1.z.string().describe('The design ID to render'),
        data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Variable data to fill in the template'),
    }, async (params) => {
        const result = await client.renderDesign(params.design_id, params.data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── publish_design ──
    server.tool('publish_design', 'Publish a design as an immutable snapshot. Creates a locked version that cannot be edited. ' +
        'Use this before deploying to production lines to freeze the template.', {
        design_id: zod_1.z.string().describe('The design ID to publish'),
        note: zod_1.z.string().optional().describe('Optional publish note (e.g. "v2.1 approved by QA")'),
    }, async (params) => {
        const result = await client.publishDesign(params.design_id, params.note);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_design_snapshots ──
    server.tool('list_design_snapshots', 'List all published snapshots (immutable versions) of a design. Shows revision history with publish dates.', {
        design_id: zod_1.z.string().describe('The design ID'),
        limit: zod_1.z.number().optional().describe('Max snapshots to return (default: 20)'),
    }, async (params) => {
        const result = await client.listSnapshots(params.design_id, params.limit);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_design_snapshot ──
    server.tool('get_design_snapshot', 'Get the full details of a published snapshot including the locked canvas state and elements.', {
        design_id: zod_1.z.string().describe('The design ID'),
        snapshot_id: zod_1.z.string().describe('The snapshot ID to retrieve'),
    }, async (params) => {
        const result = await client.getSnapshot(params.design_id, params.snapshot_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
