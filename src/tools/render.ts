/**
 * Render-as-a-Service MCP tools
 *
 * Allows AI agents to render labels without printing.
 * - render_label: Render a design with data → get PNG/ZPL
 * - render_html: Render raw HTML/CSS → get PNG
 * - render_status: Poll a render job for completion and output URL
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerRenderTools(server: any, client: LabelInnClient) {
  // ── render_label ──
  server.tool(
    'render_label',
    'Render a label design template with data and return a preview image URL. ' +
    'The render is async: this call queues a job and returns a render_id. ' +
    'Use render_status to poll for completion and get the output URL.',
    {
      design_id: z.string().describe('The design ID to render'),
      data: z.record(z.string(), z.unknown()).optional().describe('Template variable data. Can be a single object or an array of row objects (max 10).'),
      format: z.string().optional().describe('Output format: "png" (default), "jpeg", "zpl", "pdf"'),
      dpi: z.number().optional().describe('Output DPI: 203 (default), 300, or 600'),
    },
    async (params: {
      design_id: string;
      data?: Record<string, unknown> | Record<string, unknown>[];
      format?: string;
      dpi?: number;
    }) => {
      const result = await client.renderLabel(params.design_id, params.data, params.format, params.dpi);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // ── render_html ──
  server.tool(
    'render_html',
    'Render raw HTML/CSS content to an image. Supports Chart.js, D3, and other bundled JS libraries. ' +
    'Useful for generating dynamic charts, dashboards, or custom label content from code. ' +
    'Returns a render_id to poll with render_status.',
    {
      html: z.string().describe('HTML content to render (max 500KB)'),
      css: z.string().optional().describe('Optional CSS styles'),
      width: z.number().optional().describe('Output width in pixels (default: 800)'),
      height: z.number().optional().describe('Output height in pixels (default: 1200)'),
      libraries: z.array(z.string()).optional().describe('JS libraries to include: "chart.js", "d3", "three", "anime", "qrcode", "html2canvas"'),
      data: z.record(z.string(), z.unknown()).optional().describe('Template variables to substitute {{key}} placeholders in the HTML'),
      thermal_mode: z.boolean().optional().describe('Enable thermal mode: monochrome output optimized for thermal printers'),
      dpi: z.number().optional().describe('Output DPI (default: 203)'),
    },
    async (params: {
      html: string;
      css?: string;
      width?: number;
      height?: number;
      libraries?: string[];
      data?: Record<string, unknown>;
      thermal_mode?: boolean;
      dpi?: number;
    }) => {
      const result = await client.renderHtml(params);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // ── render_status ──
  server.tool(
    'render_status',
    'Check the status of a render job. Returns status (queued/rendering/completed/failed) and output_url when done.',
    {
      render_id: z.string().describe('The render job ID returned by render_label or render_html'),
    },
    async (params: { render_id: string }) => {
      const result = await client.getRenderStatus(params.render_id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
