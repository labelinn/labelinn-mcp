"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDesignTools = registerDesignTools;
function registerDesignTools(server, client) {
    // ── list_designs ──
    server.tool('list_designs', 'List all available label design templates. Returns name, dimensions, category, and element count.', {
        limit: { type: 'number', description: 'Max number of designs to return', required: false },
    }, async (params) => {
        const designs = await client.listDesigns(params.limit);
        return { content: [{ type: 'text', text: JSON.stringify(designs, null, 2) }] };
    });
    // ── get_design ──
    server.tool('get_design', 'Get full details of a label design including all elements and their properties.', {
        design_id: { type: 'string', description: 'The design ID' },
    }, async (params) => {
        const design = await client.getDesign(params.design_id);
        return { content: [{ type: 'text', text: JSON.stringify(design, null, 2) }] };
    });
    // ── get_design_variables ──
    server.tool('get_design_variables', 'Get the template variables for a design. These are the dynamic fields (like barcode, name, address) that can be filled with data when printing.', {
        design_id: { type: 'string', description: 'The design ID to inspect' },
    }, async (params) => {
        const vars = await client.getDesignVariables(params.design_id);
        return { content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }] };
    });
    // ── clone_design ──
    server.tool('clone_design', 'Create a copy of an existing label design with a new name.', {
        design_id: { type: 'string', description: 'The source design ID to clone' },
        name: { type: 'string', description: 'Name for the new cloned design', required: false },
    }, async (params) => {
        const result = await client.cloneDesign(params.design_id, params.name);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── create_design ──
    server.tool('create_design', 'Create a new label design from scratch. Specify dimensions, name, and category.', {
        name: { type: 'string', description: 'Design name' },
        width_mm: { type: 'number', description: 'Label width in mm' },
        height_mm: { type: 'number', description: 'Label height in mm' },
        category: { type: 'string', description: 'Category: "shipping", "product", "warehouse", etc.', required: false },
    }, async (params) => {
        const result = await client.createDesign(params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_design ──
    server.tool('update_design', 'Update a design\'s name, dimensions, or metadata.', {
        design_id: { type: 'string', description: 'The design ID to update' },
        name: { type: 'string', description: 'New name', required: false },
        width_mm: { type: 'number', description: 'New width in mm', required: false },
        height_mm: { type: 'number', description: 'New height in mm', required: false },
    }, async (params) => {
        const { design_id, ...data } = params;
        const result = await client.updateDesign(design_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_design ──
    server.tool('delete_design', 'Delete a label design. Built-in designs cannot be deleted.', {
        design_id: { type: 'string', description: 'The design ID to delete' },
    }, async (params) => {
        const result = await client.deleteDesign(params.design_id);
        return { content: [{ type: 'text', text: `Design ${params.design_id} deleted. ${JSON.stringify(result)}` }] };
    });
    // ── add_design_element ──
    server.tool('add_design_element', 'Add an element (text, barcode, image, shape) to a label design.', {
        design_id: { type: 'string', description: 'The design ID' },
        type: { type: 'string', description: 'Element type: "text", "barcode", "image", "shape", "line", "qr"' },
        x: { type: 'number', description: 'X position in mm' },
        y: { type: 'number', description: 'Y position in mm' },
        width: { type: 'number', description: 'Width in mm' },
        height: { type: 'number', description: 'Height in mm' },
        value: { type: 'string', description: 'Content: text string, barcode data, image URL, etc.', required: false },
        data_source: { type: 'string', description: 'Variable binding: "{{product_name}}", "{{barcode}}", etc.', required: false },
    }, async (params) => {
        const { design_id, ...element } = params;
        const result = await client.addElement(design_id, element);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_design_element ──
    server.tool('update_design_element', 'Update an element within a design (change position, size, value, or data source binding).', {
        design_id: { type: 'string', description: 'The design ID' },
        element_id: { type: 'string', description: 'The element ID to update' },
        x: { type: 'number', description: 'New X position', required: false },
        y: { type: 'number', description: 'New Y position', required: false },
        width: { type: 'number', description: 'New width', required: false },
        height: { type: 'number', description: 'New height', required: false },
        value: { type: 'string', description: 'New content value', required: false },
        data_source: { type: 'string', description: 'New variable binding', required: false },
    }, async (params) => {
        const { design_id, element_id, ...data } = params;
        const result = await client.updateElement(design_id, element_id, data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_design_element ──
    server.tool('delete_design_element', 'Remove an element from a design.', {
        design_id: { type: 'string', description: 'The design ID' },
        element_id: { type: 'string', description: 'The element ID to remove' },
    }, async (params) => {
        const result = await client.deleteElement(params.design_id, params.element_id);
        return { content: [{ type: 'text', text: `Element ${params.element_id} removed. ${JSON.stringify(result)}` }] };
    });
    // ── render_design_preview ──
    server.tool('render_design_preview', 'Generate a preview image of a design with optional variable data filled in. Returns a preview URL.', {
        design_id: { type: 'string', description: 'The design ID to render' },
        data: { type: 'object', description: 'Variable data to fill in the template', required: false },
    }, async (params) => {
        const result = await client.renderDesign(params.design_id, params.data);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── publish_design ──
    server.tool('publish_design', 'Publish a design as an immutable snapshot. Creates a locked version that cannot be edited. ' +
        'Use this before deploying to production lines to freeze the template.', {
        design_id: { type: 'string', description: 'The design ID to publish' },
        note: { type: 'string', description: 'Optional publish note (e.g. "v2.1 approved by QA")', required: false },
    }, async (params) => {
        const result = await client.publishDesign(params.design_id, params.note);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_design_snapshots ──
    server.tool('list_design_snapshots', 'List all published snapshots (immutable versions) of a design. Shows revision history with publish dates.', {
        design_id: { type: 'string', description: 'The design ID' },
        limit: { type: 'number', description: 'Max snapshots to return (default: 20)', required: false },
    }, async (params) => {
        const result = await client.listSnapshots(params.design_id, params.limit);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_design_snapshot ──
    server.tool('get_design_snapshot', 'Get the full details of a published snapshot including the locked canvas state and elements.', {
        design_id: { type: 'string', description: 'The design ID' },
        snapshot_id: { type: 'string', description: 'The snapshot ID to retrieve' },
    }, async (params) => {
        const result = await client.getSnapshot(params.design_id, params.snapshot_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
