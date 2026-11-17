/**
 * Print-related MCP tools
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LabelInnClient, OfficePrintOptions, UPLOAD_MAX_BYTES } from '../utils/api-client.js'; // UNIFIED PRINTERS R3
import { z } from 'zod';

// UNIFIED PRINTERS: `office` options of a print job sent to an office (A4/Letter)
// printer. Refused (OFFICE_OPTIONS_FOR_LABEL_PRINTER) on label printers.
const officeOptionsSchema = z.object({
  sheet: z.string().optional()
    .describe('Sheet catalogue id, e.g. "a4-21" (21 labels on A4), "a4-1" (full A4 page), "us-1", "us-30"'),
  grid: z.object({
    cols: z.number(),
    rows: z.number(),
    label_width_mm: z.number(),
    label_height_mm: z.number(),
    left_mm: z.number().optional(),
    top_mm: z.number().optional(),
    h_gap_mm: z.number().optional(),
    v_gap_mm: z.number().optional(),
  }).optional().describe('Custom label grid instead of `sheet`'),
  paper: z.enum(['a4', 'letter', 'a5', 'legal']).optional().describe('Paper size'),
  start_at: z.number().optional().describe('1-based first label cell on the first sheet (to use up a part-used sheet)'),
  collate: z.boolean().optional().describe('Collate copies'),
  color: z.enum(['color', 'grayscale', 'black_white']).optional().describe('Colour mode'),
  fill_order: z.enum(['top_left_lr', 'top_right_rl', 'bottom_left_lr', 'bottom_right_rl']).optional()
    .describe('Order labels fill the sheet cells: top_left_lr (default: from the top left, left to right), top_right_rl, bottom_left_lr, bottom_right_rl'),
}).optional().describe(
  'Office (A4/Letter) printers only: label sheet layout and paper options. Leave out for label/receipt/color printers.'
);

export function registerPrintTools(server: any, client: LabelInnClient) {
  // ── print_label ──
  server.tool(
    'print_label',
    // UNIFIED PRINTERS: office printers print designs as sheets or full pages.
    'Print a label using a saved design template with variable data. This is the most common way to print. ' +
    'Works on every printer kind. On an office (A4) printer the labels are laid out on a sheet ' +
    '(choose it with `office.sheet` or `office.grid`); a page-sized design prints as one full page.',
    {
      printer_id: z.string().describe('Target printer ID'),
      design_id: z.string().describe('Design template ID to use'),
      data: z.record(z.string(), z.unknown()).optional().describe('Template variable values (e.g. {"barcode":"TR123","name":"Ali"})'),
      copies: z.number().optional().describe('Number of copies (default: 1)'),
      job_name: z.string().optional().describe('Optional job name for tracking'),
      office: officeOptionsSchema,
    },
    async (params: { printer_id: string; design_id: string; data?: Record<string, unknown>; copies?: number; job_name?: string; office?: OfficePrintOptions }) => {
      const result = await client.createPrintJobSmart({
        printer_id: params.printer_id,
        payload_type: 'template',
        design_id: params.design_id,
        data: params.data,
        copies: params.copies || 1,
        job_name: params.job_name,
        ...(params.office ? { office: params.office } : {}), // UNIFIED PRINTERS
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── print_zpl ──
  server.tool(
    'print_zpl',
    // UNIFIED PRINTERS: ZPL is refused for office and non-ZPL printers.
    'Send raw ZPL commands directly to a Zebra/TSC thermal printer. Use this only when you have pre-built ZPL code. ' +
    'Refused for office (A4) printers (OFFICE_PRINTER_NEEDS_DESIGN) and for ESC/POS, Phomemo, DYMO and ' +
    'Brother QL printers (PRINTER_LANGUAGE_MISMATCH), including a printer whose stored type says so while its PC has ' +
    'not reported a language yet; use print_label or print_image for those.',
    {
      printer_id: z.string().describe('Target printer ID'),
      zpl_code: z.string().describe('Raw ZPL command string'),
      copies: z.number().optional().describe('Number of copies'),
    },
    async (params: { printer_id: string; zpl_code: string; copies?: number }) => {
      const result = await client.createPrintJobSmart({
        printer_id: params.printer_id,
        payload_type: 'zpl',
        payload_data: params.zpl_code,
        copies: params.copies || 1,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── print_image ──
  // Stays on the cloud path: the local edge HTTP server doesn't download
  // and rasterize image URLs — that's a cloud-side capability.
  // UNIFIED PRINTERS R3: up to 25 MB. An image_url over 500 KB is stored by
  // the API as a print upload; a local file_path is sent inline when small and
  // through POST /print/uploads otherwise (createImageJobFromBytes).
  server.tool(
    'print_image',
    // UNIFIED PRINTERS: office printers also take PDFs and print full pages.
    'Print a label from an image URL or a local file. LabelInn converts it to the printer format automatically. ' +
    'Epson colour printers refuse a bare image (PRINTER_LANGUAGE_MISMATCH, accepted_payload_types [template]): ' +
    'put the image in a design and use print_label. ' +
    'On an office (A4) printer whose `office.payload_types` includes "image", it may also be a PDF (at most 300 pages): ' +
    'without media_width_mm/media_height_mm each image / PDF page prints as one full page (fitted, never cropped); ' +
    'with them, as labels of that size on a sheet. PDFs are refused on label printers (NOT_AN_IMAGE). ' +
    'Size limit: 25 MB per file. Files over 500 KB are uploaded automatically, kept 72 hours, and need a current ' +
    'LabelInn app on the computer that owns the printer (PRINTER_APP_TOO_OLD otherwise).',
    {
      printer_id: z.string().describe('Target printer ID'),
      image_url: z.string().optional().describe('HTTPS URL to a PNG or JPEG label image (or a PDF, office printers only)'),
      file_path: z.string().optional().describe('Instead of image_url: path of a local PNG / JPEG / PDF file on this machine'),
      upload_id: z.string().optional().describe('Instead of image_url: an upload_id from POST /print/uploads'),
      copies: z.number().optional().describe('Number of copies'),
      media_width_mm: z.number().optional().describe('Label width in mm (optional; office printers: print as labels on a sheet)'),
      media_height_mm: z.number().optional().describe('Label height in mm (optional; office printers: print as labels on a sheet)'),
      office: officeOptionsSchema,
    },
    async (params: { printer_id: string; image_url?: string; file_path?: string; upload_id?: string; copies?: number; media_width_mm?: number; media_height_mm?: number; office?: OfficePrintOptions }) => {
      const sources = [params.image_url, params.file_path, params.upload_id].filter((x) => !!x).length;
      if (sources !== 1) {
        throw new Error('Pass exactly one of image_url, file_path or upload_id.');
      }
      // Epson colour printers print designs, not bare images: answer before any upload.
      await client.assertImageAllowed(params.printer_id);
      const common = {
        printer_id: params.printer_id,
        copies: params.copies || 1,
        // UNIFIED PRINTERS: optional label size and office options.
        ...(params.media_width_mm !== undefined ? { media_width_mm: params.media_width_mm } : {}),
        ...(params.media_height_mm !== undefined ? { media_height_mm: params.media_height_mm } : {}),
        ...(params.office ? { office: params.office } : {}),
      };
      let result: unknown;
      if (params.file_path) {
        const stat = fs.statSync(params.file_path);
        if (stat.size > UPLOAD_MAX_BYTES) {
          throw new Error(`API Error 413: PAYLOAD_TOO_LARGE: ${params.file_path} is ${stat.size} bytes; at most ${UPLOAD_MAX_BYTES} (25 MB).`);
        }
        const bytes = new Uint8Array(fs.readFileSync(params.file_path));
        result = await client.createImageJobFromBytes(bytes, common, path.basename(params.file_path));
      } else {
        result = await client.createPrintJob({
          ...common,
          payload_type: 'image',
          ...(params.upload_id ? { upload_id: params.upload_id } : { image_url: params.image_url }),
        });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
