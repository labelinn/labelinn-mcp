"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerJobTools = registerJobTools;
function registerJobTools(server, client) {
    // ── list_jobs ──
    server.tool('list_jobs', 'List recent print jobs with optional status filter. Shows job ID, status, type, printer, and timestamps.', {
        status: { type: 'string', description: 'Filter by: "queued", "completed", "failed", "cancelled"', required: false },
        limit: { type: 'number', description: 'Max results (default: 20)', required: false },
    }, async (params) => {
        const jobs = await client.listJobs(params);
        return { content: [{ type: 'text', text: JSON.stringify(jobs, null, 2) }] };
    });
    // ── get_job ──
    server.tool('get_job', 'Get detailed status of a specific print job including timing, printer info, and any error details.', {
        job_id: { type: 'string', description: 'The job ID to look up' },
    }, async (params) => {
        const job = await client.getJob(params.job_id);
        return { content: [{ type: 'text', text: JSON.stringify(job, null, 2) }] };
    });
    // ── cancel_job ──
    server.tool('cancel_job', 'Cancel a queued print job before it reaches the printer.', {
        job_id: { type: 'string', description: 'The job ID to cancel' },
    }, async (params) => {
        const result = await client.cancelJob(params.job_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── reprint_job ──
    server.tool('reprint_job', 'Reprint a previous print job, optionally changing the target printer or number of copies.', {
        job_id: { type: 'string', description: 'The original job ID to reprint' },
        printer_id: { type: 'string', description: 'Override target printer', required: false },
        copies: { type: 'number', description: 'Override copy count', required: false },
    }, async (params) => {
        const result = await client.reprintJob(params.job_id, {
            printer_id: params.printer_id,
            copies: params.copies,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
