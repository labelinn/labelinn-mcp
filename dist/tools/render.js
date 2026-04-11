"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRenderTools = registerRenderTools;
const zod_1 = require("zod");
function registerRenderTools(server, client) {
    // ── render_label ──
    server.tool('render_label', 'Render a label design template with data and return a preview image URL. ' +
        'The render is async: this call queues a job and returns a render_id. ' +
        'Use render_status to poll for completion and get the output URL.', {
        design_id: zod_1.z.string().describe('The design ID to render'),
        data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Template variable data. Can be a single object or an array of row objects (max 10).'),
        format: zod_1.z.string().optional().describe('Output format: "png" (default), "jpeg", "zpl", "pdf"'),
        dpi: zod_1.z.number().optional().describe('Output DPI: 203 (default), 300, or 600'),
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
        html: zod_1.z.string().describe('HTML content to render (max 500KB)'),
        css: zod_1.z.string().optional().describe('Optional CSS styles'),
        width: zod_1.z.number().optional().describe('Output width in pixels (default: 800)'),
        height: zod_1.z.number().optional().describe('Output height in pixels (default: 1200)'),
        libraries: zod_1.z.array(zod_1.z.string()).optional().describe('JS libraries to include: "chart.js", "d3", "three", "anime", "qrcode", "html2canvas"'),
        data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Template variables to substitute {{key}} placeholders in the HTML'),
        thermal_mode: zod_1.z.boolean().optional().describe('Enable thermal mode: monochrome output optimized for thermal printers'),
        dpi: zod_1.z.number().optional().describe('Output DPI (default: 203)'),
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
        render_id: zod_1.z.string().describe('The render job ID returned by render_label or render_html'),
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
