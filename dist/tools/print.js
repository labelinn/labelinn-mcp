"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrintTools = registerPrintTools;
const zod_1 = require("zod");
function registerPrintTools(server, client) {
    // ── print_label ──
    server.tool('print_label', 'Print a label using a saved design template with variable data. This is the most common way to print.', {
        printer_id: zod_1.z.string().describe('Target printer ID'),
        design_id: zod_1.z.string().describe('Design template ID to use'),
        data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Template variable values (e.g. {"barcode":"TR123","name":"Ali"})'),
        copies: zod_1.z.number().optional().describe('Number of copies (default: 1)'),
        job_name: zod_1.z.string().optional().describe('Optional job name for tracking'),
    }, async (params) => {
        const result = await client.createPrintJob({
            printer_id: params.printer_id,
            payload_type: 'template',
            design_id: params.design_id,
            data: params.data,
            copies: params.copies || 1,
            job_name: params.job_name,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── print_zpl ──
    server.tool('print_zpl', 'Send raw ZPL commands directly to a Zebra/TSC thermal printer. Use this only when you have pre-built ZPL code.', {
        printer_id: zod_1.z.string().describe('Target printer ID'),
        zpl_code: zod_1.z.string().describe('Raw ZPL command string'),
        copies: zod_1.z.number().optional().describe('Number of copies'),
    }, async (params) => {
        const result = await client.createPrintJob({
            printer_id: params.printer_id,
            payload_type: 'zpl',
            payload_data: params.zpl_code,
            copies: params.copies || 1,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── print_image ──
    server.tool('print_image', 'Print a label from an image URL. LabelInn downloads the image and converts it to the printer format automatically.', {
        printer_id: zod_1.z.string().describe('Target printer ID'),
        image_url: zod_1.z.string().describe('HTTPS URL to a PNG or JPEG label image'),
        copies: zod_1.z.number().optional().describe('Number of copies'),
    }, async (params) => {
        const result = await client.createPrintJob({
            printer_id: params.printer_id,
            payload_type: 'image',
            image_url: params.image_url,
            copies: params.copies || 1,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
