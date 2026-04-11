/**
 * Data Connect & Batch MCP tools — external data sources, batch operations
 */
import { LabelInnClient } from '../utils/api-client.js';

export function registerConnectTools(server: any, client: LabelInnClient) {
  // ── ingest_data ──
  server.tool(
    'ingest_data',
    'Ingest data from external sources (CSV, Excel, JSON, XML, API). Data is parsed and can be used for variable-driven label printing.',
    {
      source_type: { type: 'string', description: '"csv", "json", "xml", "excel", "api"' },
      data: { type: 'string', description: 'Raw data content or API URL' },
      mapping: { type: 'object', description: 'Field mapping: {"sku": "column_A", "name": "column_B"}', required: false },
    },
    async (params: { source_type: string; data: string; mapping?: Record<string, string> }) => {
      const result = await client.ingestData(params.data, params.source_type, params.mapping ? JSON.stringify(params.mapping) : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── test_parse ──
  server.tool(
    'test_parse',
    'Test-parse data to preview how it would be interpreted. Returns parsed rows without saving.',
    {
      source_type: { type: 'string', description: '"csv", "json", "xml", "excel"' },
      data: { type: 'string', description: 'Raw data content to parse' },
    },
    async (params: { source_type: string; data: string }) => {
      const result = await client.testParse(params.data, params.source_type);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── list_connector_sources ──
  server.tool(
    'list_connector_sources',
    'List all configured data connector sources.',
    {},
    async () => {
      const sources = await client.listConnectorSources();
      return { content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }] };
    }
  );

  // ── print_from_connector ──
  server.tool(
    'print_from_connector',
    'Print labels directly from a connected data source. Combines data ingestion + batch print in one step.',
    {
      source_id: { type: 'string', description: 'The data source ID' },
      design_id: { type: 'string', description: 'Design template to use' },
      printer_id: { type: 'string', description: 'Target printer' },
      filter: { type: 'object', description: 'Row filter criteria', required: false },
    },
    async (params: { source_id: string; design_id: string; printer_id: string; filter?: Record<string, unknown> }) => {
      const result = await client.printFromConnector(params.source_id, params.design_id, params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── batch_print ──
  server.tool(
    'batch_print',
    'Batch print multiple labels with variable data. Provide an array of data rows — each row produces one label.',
    {
      design_id: { type: 'string', description: 'Design template ID' },
      printer_id: { type: 'string', description: 'Target printer ID' },
      rows: { type: 'array', description: 'Array of data objects, each with variable values: [{"product_name":"Widget","sku":"SKU001"}, ...]' },
      copies_per_row: { type: 'number', description: 'Copies per label row (default 1)', required: false },
    },
    async (params: { design_id: string; printer_id: string; rows: Record<string, unknown>[]; copies_per_row?: number }) => {
      const result = await client.printDesign(params.design_id, params.printer_id, { rows: params.rows }, params.copies_per_row);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_usage_stats ──
  server.tool(
    'get_usage_stats',
    'Get API usage statistics: total labels printed, print jobs, success/failure rates, API calls.',
    {},
    async () => {
      const result = await client.getUsage();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
