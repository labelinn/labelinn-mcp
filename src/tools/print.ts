/**
 * Print-related MCP tools
 */
import { LabelInnClient } from '../utils/api-client.js';

export function registerPrintTools(server: any, client: LabelInnClient) {
  // ── print_label ──
  server.tool(
    'print_label',
    'Print a label using a saved design template with variable data. This is the most common way to print.',
    {
      printer_id: { type: 'string', description: 'Target printer ID' },
      design_id: { type: 'string', description: 'Design template ID to use' },
      data: { type: 'object', description: 'Template variable values (e.g. {"barcode":"TR123","name":"Ali"})', required: false },
      copies: { type: 'number', description: 'Number of copies (default: 1)', required: false },
      job_name: { type: 'string', description: 'Optional job name for tracking', required: false },
    },
    async (params: { printer_id: string; design_id: string; data?: Record<string, unknown>; copies?: number; job_name?: string }) => {
      const result = await client.createPrintJob({
        printer_id: params.printer_id,
        payload_type: 'template',
        design_id: params.design_id,
        data: params.data,
        copies: params.copies || 1,
        job_name: params.job_name,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── print_zpl ──
  server.tool(
    'print_zpl',
    'Send raw ZPL commands directly to a Zebra/TSC thermal printer. Use this only when you have pre-built ZPL code.',
    {
      printer_id: { type: 'string', description: 'Target printer ID' },
      zpl_code: { type: 'string', description: 'Raw ZPL command string' },
      copies: { type: 'number', description: 'Number of copies', required: false },
    },
    async (params: { printer_id: string; zpl_code: string; copies?: number }) => {
      const result = await client.createPrintJob({
        printer_id: params.printer_id,
        payload_type: 'zpl',
        payload_data: params.zpl_code,
        copies: params.copies || 1,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── print_image ──
  server.tool(
    'print_image',
    'Print a label from an image URL. LabelInn downloads the image and converts it to the printer format automatically.',
    {
      printer_id: { type: 'string', description: 'Target printer ID' },
      image_url: { type: 'string', description: 'HTTPS URL to a PNG or JPEG label image' },
      copies: { type: 'number', description: 'Number of copies', required: false },
    },
    async (params: { printer_id: string; image_url: string; copies?: number }) => {
      const result = await client.createPrintJob({
        printer_id: params.printer_id,
        payload_type: 'image',
        image_url: params.image_url,
        copies: params.copies || 1,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
