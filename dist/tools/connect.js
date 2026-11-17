"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConnectTools = registerConnectTools;
const zod_1 = require("zod");
function registerConnectTools(server, client) {
    // ── ingest_data ──
    server.tool('ingest_data', 'Ingest data from external sources (CSV, Excel, JSON, XML, API). Data is parsed and can be used for variable-driven label printing.', {
        source_type: zod_1.z.string().describe('"csv", "json", "xml", "tsv", "ndjson"'),
        data: zod_1.z.string().describe('Raw data content'),
        source_id: zod_1.z.string().optional().describe('Existing connector source to ingest into (omit to auto-create one)'),
        mapping: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Field mapping saved on the source after ingest: {"design_var": "source.field"}'),
    }, async (params) => {
        // Previously the mapping JSON was sent as the source id, and the data went
        // in a field the API does not read.
        const result = await client.ingestData(params.data, params.source_type, params.source_id);
        const sourceId = params.source_id || (result && typeof result.source_id === 'string' ? result.source_id : undefined);
        let mappingResult;
        if (params.mapping && sourceId) {
            mappingResult = await client.updateConnectorMappings(sourceId, params.mapping);
        }
        const out = mappingResult === undefined ? result : { ingest: result, mappings: mappingResult };
        return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
    });
    // ── test_parse ──
    server.tool('test_parse', 'Test-parse data to preview how it would be interpreted. Returns parsed rows without saving.', {
        source_type: zod_1.z.string().describe('"csv", "json", "xml", "excel"'),
        data: zod_1.z.string().describe('Raw data content to parse'),
    }, async (params) => {
        const result = await client.testParse(params.data, params.source_type);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_connector_sources ──
    server.tool('list_connector_sources', 'List all configured data connector sources.', {}, async () => {
        const sources = await client.listConnectorSources();
        return { content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }] };
    });
    // ── print_from_connector ──
    server.tool('print_from_connector', 'Print labels directly from a connected data source. Combines data ingestion + batch print in one step.', {
        source_id: zod_1.z.string().describe('The data source ID'),
        design_id: zod_1.z.string().describe('Design template to use'),
        printer_id: zod_1.z.string().describe('Target printer'),
        filter: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Row filter criteria'),
    }, async (params) => {
        const result = await client.printFromConnector(params.source_id, params.design_id, params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── batch_print ──
    server.tool('batch_print', 'Batch print multiple labels with variable data. Provide an array of data rows — each row produces one label.', {
        design_id: zod_1.z.string().describe('Design template ID'),
        printer_id: zod_1.z.string().describe('Target printer ID'),
        rows: zod_1.z.array(zod_1.z.unknown()).describe('Array of data objects, each with variable values: [{"product_name":"Widget","sku":"SKU001"}, ...]'),
        copies_per_row: zod_1.z.number().optional().describe('Copies per label row (default 1)'),
    }, async (params) => {
        const result = await client.printDesign(params.design_id, params.printer_id, { rows: params.rows }, params.copies_per_row);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_usage_stats ──
    server.tool('get_usage_stats', 'Get API usage statistics: total labels printed, print jobs, success/failure rates, API calls.', {}, async () => {
        const result = await client.getUsage();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
