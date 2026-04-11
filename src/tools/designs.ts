/**
 * Design management MCP tools
 */
import { LabelInnClient } from '../utils/api-client.js';
import { z } from 'zod';

export function registerDesignTools(server: any, client: LabelInnClient) {
  // ── list_designs ──
  server.tool(
    'list_designs',
    'List all available label design templates. Returns name, dimensions, category, and element count.',
    {
      limit: z.number().optional().describe('Max number of designs to return'),
    },
    async (params: { limit?: number }) => {
      const designs = await client.listDesigns(params.limit);
      return { content: [{ type: 'text', text: JSON.stringify(designs, null, 2) }] };
    }
  );

  // ── get_design ──
  server.tool(
    'get_design',
    'Get full details of a label design including all elements and their properties.',
    {
      design_id: z.string().describe('The design ID'),
    },
    async (params: { design_id: string }) => {
      const design = await client.getDesign(params.design_id);
      return { content: [{ type: 'text', text: JSON.stringify(design, null, 2) }] };
    }
  );

  // ── get_design_variables ──
  server.tool(
    'get_design_variables',
    'Get the template variables for a design. These are the dynamic fields (like barcode, name, address) that can be filled with data when printing.',
    {
      design_id: z.string().describe('The design ID to inspect'),
    },
    async (params: { design_id: string }) => {
      const vars = await client.getDesignVariables(params.design_id);
      return { content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }] };
    }
  );

  // ── clone_design ──
  server.tool(
    'clone_design',
    'Create a copy of an existing label design with a new name.',
    {
      design_id: z.string().describe('The source design ID to clone'),
      name: z.string().optional().describe('Name for the new cloned design'),
    },
    async (params: { design_id: string; name?: string }) => {
      const result = await client.cloneDesign(params.design_id, params.name);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── create_design ──
  server.tool(
    'create_design',
    'Create a new label design from scratch. Specify dimensions, name, and category.',
    {
      name: z.string().describe('Design name'),
      width_mm: z.number().describe('Label width in mm'),
      height_mm: z.number().describe('Label height in mm'),
      category: z.string().optional().describe('Category: "shipping", "product", "warehouse", etc.'),
    },
    async (params: { name: string; width_mm: number; height_mm: number; category?: string }) => {
      const result = await client.createDesign(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── update_design ──
  server.tool(
    'update_design',
    'Update a design\'s name, dimensions, or metadata.',
    {
      design_id: z.string().describe('The design ID to update'),
      name: z.string().optional().describe('New name'),
      width_mm: z.number().optional().describe('New width in mm'),
      height_mm: z.number().optional().describe('New height in mm'),
    },
    async (params: { design_id: string; name?: string; width_mm?: number; height_mm?: number }) => {
      const { design_id, ...data } = params;
      const result = await client.updateDesign(design_id, data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── delete_design ──
  server.tool(
    'delete_design',
    'Delete a label design. Built-in designs cannot be deleted.',
    {
      design_id: z.string().describe('The design ID to delete'),
    },
    async (params: { design_id: string }) => {
      const result = await client.deleteDesign(params.design_id);
      return { content: [{ type: 'text', text: `Design ${params.design_id} deleted. ${JSON.stringify(result)}` }] };
    }
  );

  // ── add_design_element ──
  server.tool(
    'add_design_element',
    'Add an element (text, barcode, image, shape) to a label design.',
    {
      design_id: z.string().describe('The design ID'),
      type: z.string().describe('Element type: "text", "barcode", "image", "shape", "line", "qr"'),
      x: z.number().describe('X position in mm'),
      y: z.number().describe('Y position in mm'),
      width: z.number().describe('Width in mm'),
      height: z.number().describe('Height in mm'),
      value: z.string().optional().describe('Content: text string, barcode data, image URL, etc.'),
      data_source: z.string().optional().describe('Variable binding: "{{product_name}}", "{{barcode}}", etc.'),
    },
    async (params: { design_id: string; type: string; x: number; y: number; width: number; height: number; value?: string; data_source?: string }) => {
      const { design_id, ...element } = params;
      const result = await client.addElement(design_id, element);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── update_design_element ──
  server.tool(
    'update_design_element',
    'Update an element within a design (change position, size, value, or data source binding).',
    {
      design_id: z.string().describe('The design ID'),
      element_id: z.string().describe('The element ID to update'),
      x: z.number().optional().describe('New X position'),
      y: z.number().optional().describe('New Y position'),
      width: z.number().optional().describe('New width'),
      height: z.number().optional().describe('New height'),
      value: z.string().optional().describe('New content value'),
      data_source: z.string().optional().describe('New variable binding'),
    },
    async (params: { design_id: string; element_id: string; [key: string]: unknown }) => {
      const { design_id, element_id, ...data } = params;
      const result = await client.updateElement(design_id, element_id as string, data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── delete_design_element ──
  server.tool(
    'delete_design_element',
    'Remove an element from a design.',
    {
      design_id: z.string().describe('The design ID'),
      element_id: z.string().describe('The element ID to remove'),
    },
    async (params: { design_id: string; element_id: string }) => {
      const result = await client.deleteElement(params.design_id, params.element_id);
      return { content: [{ type: 'text', text: `Element ${params.element_id} removed. ${JSON.stringify(result)}` }] };
    }
  );

  // ── render_design_preview ──
  server.tool(
    'render_design_preview',
    'Generate a preview image of a design with optional variable data filled in. Returns a preview URL.',
    {
      design_id: z.string().describe('The design ID to render'),
      data: z.record(z.string(), z.unknown()).optional().describe('Variable data to fill in the template'),
    },
    async (params: { design_id: string; data?: Record<string, unknown> }) => {
      const result = await client.renderDesign(params.design_id, params.data);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── publish_design ──
  server.tool(
    'publish_design',
    'Publish a design as an immutable snapshot. Creates a locked version that cannot be edited. ' +
    'Use this before deploying to production lines to freeze the template.',
    {
      design_id: z.string().describe('The design ID to publish'),
      note: z.string().optional().describe('Optional publish note (e.g. "v2.1 approved by QA")'),
    },
    async (params: { design_id: string; note?: string }) => {
      const result = await client.publishDesign(params.design_id, params.note);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_design_snapshots ──
  server.tool(
    'list_design_snapshots',
    'List all published snapshots (immutable versions) of a design. Shows revision history with publish dates.',
    {
      design_id: z.string().describe('The design ID'),
      limit: z.number().optional().describe('Max snapshots to return (default: 20)'),
    },
    async (params: { design_id: string; limit?: number }) => {
      const result = await client.listSnapshots(params.design_id, params.limit);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_design_snapshot ──
  server.tool(
    'get_design_snapshot',
    'Get the full details of a published snapshot including the locked canvas state and elements.',
    {
      design_id: z.string().describe('The design ID'),
      snapshot_id: z.string().describe('The snapshot ID to retrieve'),
    },
    async (params: { design_id: string; snapshot_id: string }) => {
      const result = await client.getSnapshot(params.design_id, params.snapshot_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
