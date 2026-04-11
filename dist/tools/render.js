"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRenderTools = registerRenderTools;
function registerRenderTools(server, client) {
    // ── render_label ──
    server.tool('render_label', 'Render a label design template with data and return a preview image URL. ' +
        'The render is async: this call queues a job and returns a render_id. ' +
        'Use render_status to poll for completion and get the output URL.', {
        design_id: { type: 'string', description: 'The design ID to render' },
        data: {
            type: 'object',
            description: 'Template variable data. Can be a single object or an array of row objects (max 10).',
            required: false,
        },
        format: {
            type: 'string',
            description: 'Output format: "png" (default), "jpeg", "zpl", "pdf"',
            required: false,
        },
        dpi: {
            type: 'number',
            description: 'Output DPI: 203 (default), 300, or 600',
            required: false,
        },
    }, async (params) => {
        const result = await client.renderLabel(params.design_id, params.data, params.format, params.dpi);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
        };
    });
    // ── render_html ──
    server.tool('render_html', 'Render raw HTML/CSS content to an image. Supports Chart.js, D3, and other bundled JS libraries. ' +
        'Useful for generating dynamic charts, dashboards, or custom label content from code. ' +
        'Returns a render_id to poll with render_status.', {
        html: { type: 'string', description: 'HTML content to render (max 500KB)' },
        css: { type: 'string', description: 'Optional CSS styles', required: false },
        width: { type: 'number', description: 'Output width in pixels (default: 800)', required: false },
        height: { type: 'number', description: 'Output height in pixels (default: 1200)', required: false },
        libraries: {
            type: 'array',
            description: 'JS libraries to include: "chart.js", "d3", "three", "anime", "qrcode", "html2canvas"',
            required: false,
        },
        data: {
            type: 'object',
            description: 'Template variables to substitute {{key}} placeholders in the HTML',
            required: false,
        },
        thermal_mode: {
            type: 'boolean',
            description: 'Enable thermal mode: monochrome output optimized for thermal printers',
            required: false,
        },
        dpi: { type: 'number', description: 'Output DPI (default: 203)', required: false },
    }, async (params) => {
        const result = await client.renderHtml(params);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
        };
    });
    // ── render_status ──
    server.tool('render_status', 'Check the status of a render job. Returns status (queued/rendering/completed/failed) and output_url when done.', {
        render_id: { type: 'string', description: 'The render job ID returned by render_label or render_html' },
    }, async (params) => {
        const result = await client.getRenderStatus(params.render_id);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
        };
    });
}
