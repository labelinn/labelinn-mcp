"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVerifyTools = registerVerifyTools;
const zod_1 = require("zod");
function registerVerifyTools(server, client) {
    // ── submit_barcode_scan ──
    server.tool('submit_barcode_scan', 'Submit a single barcode scan for verification. Checks if the barcode matches expected values in an active verify session.', {
        barcode: zod_1.z.string().describe('The scanned barcode value'),
        job_id: zod_1.z.string().optional().describe('Verify job ID to match against'),
        device_id: zod_1.z.string().optional().describe('Device identifier that performed the scan'),
    }, async (params) => {
        const body = { barcode: params.barcode };
        if (params.job_id)
            body.job_id = params.job_id;
        if (params.device_id)
            body.device_id = params.device_id;
        const result = await client.post('/verify/scan', body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── batch_verify_barcodes ──
    server.tool('batch_verify_barcodes', 'Submit a batch of barcode scans for verification (max 100). Returns pass/fail counts and individual results.', {
        scans: zod_1.z.array(zod_1.z.object({
            barcode: zod_1.z.string().describe('Barcode value'),
            job_id: zod_1.z.string().optional().describe('Verify job ID'),
            device_id: zod_1.z.string().optional().describe('Device ID'),
        })).describe('Array of barcode scans (max 100)'),
    }, async (params) => {
        const result = await client.post('/verify/batch', { scans: params.scans });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── set_expected_barcodes ──
    server.tool('set_expected_barcodes', 'Create a verification session with expected barcodes. Subsequent scans will be matched against this list.', {
        barcodes: zod_1.z.array(zod_1.z.string()).describe('List of expected barcode values'),
        job_id: zod_1.z.string().optional().describe('Print job ID to link to'),
        name: zod_1.z.string().optional().describe('Human-readable session name (e.g., "Batch 42")'),
        device_id: zod_1.z.string().optional().describe('Device identifier'),
    }, async (params) => {
        const body = { barcodes: params.barcodes };
        if (params.job_id)
            body.job_id = params.job_id;
        if (params.name)
            body.name = params.name;
        if (params.device_id)
            body.device_id = params.device_id;
        const result = await client.post('/verify/expect', body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_verify_job_status ──
    server.tool('get_verify_job_status', 'Get the status and progress of a verification job. Shows verified/unverified barcodes and pass rate.', {
        job_id: zod_1.z.string().describe('Verify job ID (e.g., "vj_xxx")'),
    }, async (params) => {
        const result = await client.get(`/verify/status/${encodeURIComponent(params.job_id)}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── query_verify_results ──
    server.tool('query_verify_results', 'Query verification scan results with optional filters. Returns paginated results.', {
        job_id: zod_1.z.string().optional().describe('Filter by verify job ID'),
        matched: zod_1.z.boolean().optional().describe('Filter by match result (true/false)'),
        device_id: zod_1.z.string().optional().describe('Filter by device ID'),
        limit: zod_1.z.number().optional().describe('Max results per page'),
        page_token: zod_1.z.string().optional().describe('Pagination token from previous response'),
    }, async (params) => {
        const qs = new URLSearchParams();
        if (params.job_id)
            qs.set('job_id', params.job_id);
        if (params.matched !== undefined)
            qs.set('matched', String(params.matched));
        if (params.device_id)
            qs.set('device_id', params.device_id);
        if (params.limit)
            qs.set('limit', String(params.limit));
        if (params.page_token)
            qs.set('page_token', params.page_token);
        const qstr = qs.toString();
        const result = await client.get(`/verify/results${qstr ? '?' + qstr : ''}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_scan_result ──
    server.tool('get_scan_result', 'Get details of a single barcode scan result by ID.', {
        scan_id: zod_1.z.string().describe('The scan result ID'),
    }, async (params) => {
        const result = await client.get(`/verify/results/${encodeURIComponent(params.scan_id)}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_verify_stats ──
    server.tool('get_verify_stats', 'Get aggregated verification statistics including total scans, pass rate, and active sessions.', {
        days: zod_1.z.number().optional().describe('Lookback period in days (1-90, default 7)'),
    }, async (params) => {
        const qs = params.days ? `?days=${params.days}` : '';
        const result = await client.get(`/verify/stats${qs}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── sync_verify_from_edge ──
    server.tool('sync_verify_from_edge', 'Bulk sync verification results from an Edge server (offline-first). Uploads up to 500 scan results at once.', {
        results: zod_1.z.array(zod_1.z.object({
            barcode: zod_1.z.string(),
            matched: zod_1.z.boolean(),
            matched_barcode: zod_1.z.string().optional(),
            job_id: zod_1.z.string().optional(),
            scanned_at: zod_1.z.string().optional(),
            device_id: zod_1.z.string().optional(),
            is_re_verification: zod_1.z.boolean().optional(),
        })).describe('Array of scan results to sync (max 500)'),
        job_context: zod_1.z.object({
            verify_job_id: zod_1.z.string().optional(),
            status: zod_1.z.string().optional(),
            name: zod_1.z.string().optional(),
            print_job_id: zod_1.z.string().optional(),
            expected_barcodes: zod_1.z.array(zod_1.z.string()).optional(),
            device_id: zod_1.z.string().optional(),
        }).optional().describe('Optional job context for the synced results'),
    }, async (params) => {
        const body = { results: params.results };
        if (params.job_context)
            body.job_context = params.job_context;
        const result = await client.post('/verify/sync', body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
