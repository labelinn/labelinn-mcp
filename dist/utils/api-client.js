"use strict";
/**
 * LabelInn API HTTP Client
 * Wraps the LabelInn REST API for use by MCP tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelInnClient = void 0;
class LabelInnClient {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://labelinn.com/v1';
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'labelinn-mcp/2.0.0',
        };
        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        const text = await response.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new Error(`Invalid JSON response from ${method} ${path}: ${text.substring(0, 200)}`);
        }
        if (!response.ok) {
            const err = parsed;
            throw new Error(`API Error ${response.status}: ${err?.error?.message || err?.error?.code || text.substring(0, 200)}`);
        }
        // Unwrap {data: ...} envelope if present
        const obj = parsed;
        return (obj.data !== undefined ? obj.data : parsed);
    }
    // ── Generic HTTP helpers ──
    async get(path) {
        return this.request('GET', path);
    }
    async post(path, body) {
        return this.request('POST', path, body);
    }
    async put(path, body) {
        return this.request('PUT', path, body);
    }
    async del(path) {
        return this.request('DELETE', path);
    }
    // ── Fleet ──
    async listPrinters(status) {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request('GET', `/fleet/printers${qs}`);
    }
    async getPrinter(printerId) {
        return this.request('GET', `/fleet/printers/${encodeURIComponent(printerId)}`);
    }
    async getPrinterStatus(printerId) {
        return this.request('GET', `/fleet/printers/${encodeURIComponent(printerId)}/status`);
    }
    // ── Designs ──
    async listDesigns(limit) {
        const qs = limit ? `?limit=${limit}` : '';
        return this.request('GET', `/designs${qs}`);
    }
    async getDesign(designId) {
        return this.request('GET', `/designs/${encodeURIComponent(designId)}`);
    }
    async getDesignVariables(designId) {
        return this.request('GET', `/designs/${encodeURIComponent(designId)}/variables`);
    }
    async cloneDesign(designId, name) {
        return this.request('POST', `/designs/${encodeURIComponent(designId)}/clone`, { name });
    }
    // ── Print Jobs ──
    async createPrintJob(params) {
        return this.request('POST', '/print/jobs', params);
    }
    async listJobs(options) {
        const params = new URLSearchParams();
        if (options?.status)
            params.set('status', options.status);
        if (options?.limit)
            params.set('limit', String(options.limit));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this.request('GET', `/print/jobs${qs}`);
    }
    async getJob(jobId) {
        return this.request('GET', `/print/jobs/${encodeURIComponent(jobId)}`);
    }
    async cancelJob(jobId) {
        return this.request('DELETE', `/print/jobs/${encodeURIComponent(jobId)}`);
    }
    async reprintJob(jobId, options) {
        return this.request('POST', `/print/jobs/${encodeURIComponent(jobId)}/reprint`, options);
    }
    // ── Webhooks ──
    async listWebhooks() {
        return this.request('GET', '/webhooks');
    }
    async createWebhook(url, events, description) {
        return this.request('POST', '/webhooks', { url, events, description });
    }
    async deleteWebhook(webhookId) {
        return this.request('DELETE', `/webhooks/${encodeURIComponent(webhookId)}`);
    }
    // ── Usage ──
    async getUsage() {
        return this.request('GET', '/usage');
    }
    async getUsageDaily() {
        return this.request('GET', '/usage/daily');
    }
    // ── Fleet Extended ──
    async discoverPrinters() {
        return this.request('POST', '/fleet/discover');
    }
    async getDiscoveryResults(sessionId) {
        return this.request('GET', `/fleet/discover/${encodeURIComponent(sessionId)}`);
    }
    async addDiscoveredPrinter(sessionId, printerAddress) {
        return this.request('POST', `/fleet/discover/${encodeURIComponent(sessionId)}/add`, { printer_address: printerAddress });
    }
    async updatePrinter(printerId, data) {
        return this.request('PUT', `/fleet/printers/${encodeURIComponent(printerId)}`, data);
    }
    async identifyPrinter(printerId) {
        return this.request('POST', `/fleet/printers/${encodeURIComponent(printerId)}/identify`);
    }
    async setPrinterMedia(printerId, media) {
        return this.request('PUT', `/fleet/printers/${encodeURIComponent(printerId)}/media`, media);
    }
    async createPrinterGroup(name, printerIds, description) {
        return this.request('POST', '/fleet/groups', { name, printer_ids: printerIds, description });
    }
    async listPrinterGroups() {
        return this.request('GET', '/fleet/groups');
    }
    async deletePrinterGroup(groupId) {
        return this.request('DELETE', `/fleet/groups/${encodeURIComponent(groupId)}`);
    }
    // ── Design Editing ──
    async createDesign(data) {
        return this.request('POST', '/designs', data);
    }
    async updateDesign(designId, data) {
        return this.request('PUT', `/designs/${encodeURIComponent(designId)}`, data);
    }
    async deleteDesign(designId) {
        return this.request('DELETE', `/designs/${encodeURIComponent(designId)}`);
    }
    async addElement(designId, element) {
        return this.request('POST', `/designs/${encodeURIComponent(designId)}/elements`, element);
    }
    async updateElement(designId, elementId, data) {
        return this.request('PATCH', `/designs/${encodeURIComponent(designId)}/elements/${encodeURIComponent(elementId)}`, data);
    }
    async deleteElement(designId, elementId) {
        return this.request('DELETE', `/designs/${encodeURIComponent(designId)}/elements/${encodeURIComponent(elementId)}`);
    }
    async renderDesign(designId, data) {
        return this.request('POST', `/designs/${encodeURIComponent(designId)}/render`, { data });
    }
    async publishDesign(designId, note) {
        return this.request('POST', `/designs/${encodeURIComponent(designId)}/publish`, note ? { note } : {});
    }
    async listSnapshots(designId, limit) {
        const qs = limit ? `?limit=${limit}` : '';
        return this.request('GET', `/designs/${encodeURIComponent(designId)}/snapshots${qs}`);
    }
    async getSnapshot(designId, snapshotId) {
        return this.request('GET', `/designs/${encodeURIComponent(designId)}/snapshots/${encodeURIComponent(snapshotId)}`);
    }
    async printDesign(designId, printerId, data, copies) {
        return this.request('POST', `/designs/${encodeURIComponent(designId)}/print`, { printer_id: printerId, data, copies });
    }
    // ── Render-as-a-Service ──
    async renderLabel(designId, data, format, dpi) {
        return this.request('POST', '/render', { design_id: designId, data, format, dpi });
    }
    async renderHtml(params) {
        return this.request('POST', '/render/html', params);
    }
    async getRenderStatus(renderId) {
        return this.request('GET', `/render/${encodeURIComponent(renderId)}`);
    }
    // ── Rules Engine ──
    async createRule(rule) {
        return this.request('POST', '/rules', rule);
    }
    async listRules() {
        return this.request('GET', '/rules');
    }
    async getRule(ruleId) {
        return this.request('GET', `/rules/${encodeURIComponent(ruleId)}`);
    }
    async updateRule(ruleId, data) {
        return this.request('PUT', `/rules/${encodeURIComponent(ruleId)}`, data);
    }
    async deleteRule(ruleId) {
        return this.request('DELETE', `/rules/${encodeURIComponent(ruleId)}`);
    }
    async testRule(ruleId, sampleData) {
        return this.request('POST', `/rules/${encodeURIComponent(ruleId)}/test`, { sample_data: sampleData });
    }
    // ── Audit & Compliance ──
    async getAuditTrail(options) {
        const params = new URLSearchParams();
        if (options?.action)
            params.set('action', options.action);
        if (options?.limit)
            params.set('limit', String(options.limit));
        if (options?.date_from)
            params.set('date_from', options.date_from);
        if (options?.date_to)
            params.set('date_to', options.date_to);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this.request('GET', `/audit/trail${qs}`);
    }
    async getAuditSummary() {
        return this.request('GET', '/audit/summary');
    }
    async createSerialPool(pool) {
        return this.request('POST', '/compliance/pools', pool);
    }
    async listSerialPools() {
        return this.request('GET', '/compliance/pools');
    }
    async allocateSerials(poolId, count) {
        return this.request('POST', `/compliance/pools/${encodeURIComponent(poolId)}/allocate`, { count });
    }
    async voidSerials(poolId, serials, reason) {
        return this.request('POST', `/compliance/pools/${encodeURIComponent(poolId)}/void`, { serials, reason });
    }
    // ── Sites & Geo ──
    async createSite(site) {
        return this.request('POST', '/sites', site);
    }
    async listSites() {
        return this.request('GET', '/sites');
    }
    async getSite(siteId) {
        return this.request('GET', `/sites/${encodeURIComponent(siteId)}`);
    }
    async updateSite(siteId, data) {
        return this.request('PUT', `/sites/${encodeURIComponent(siteId)}`, data);
    }
    async deleteSite(siteId) {
        return this.request('DELETE', `/sites/${encodeURIComponent(siteId)}`);
    }
    async assignPrintersToSite(siteId, printerIds) {
        return this.request('POST', `/sites/${encodeURIComponent(siteId)}/printers`, { printer_ids: printerIds });
    }
    async getSiteAnalytics(siteId) {
        return this.request('GET', `/sites/${encodeURIComponent(siteId)}/analytics`);
    }
    async findNearestSite(lat, lon) {
        return this.request('GET', `/sites/nearest?lat=${lat}&lon=${lon}`);
    }
    // ── Analytics & Predictions ──
    async getPredictions(printerId) {
        return this.request('GET', `/analytics/predictions/${encodeURIComponent(printerId)}`);
    }
    async getFleetTrends(period) {
        const qs = period ? `?period=${period}` : '';
        return this.request('GET', `/analytics/fleet/trends${qs}`);
    }
    async getQualityScore(printerId) {
        return this.request('GET', `/analytics/quality/${encodeURIComponent(printerId)}`);
    }
    async simulatePrint(designId, printerId, copies) {
        return this.request('POST', '/analytics/digital-twin/simulate', { designId, printerId, copies });
    }
    // ── Data Connect ──
    async ingestData(data, format, sourceId) {
        return this.request('POST', '/connect/ingest', { data, format, source_id: sourceId });
    }
    async testParse(data, format) {
        return this.request('POST', '/connect/test-parse', { data, format });
    }
    async listConnectorSources() {
        return this.request('GET', '/connect/sources');
    }
    async printFromConnector(sourceId, designId, printerId) {
        return this.request('POST', `/connect/sources/${encodeURIComponent(sourceId)}/print`, { design_id: designId, printer_id: printerId });
    }
    // ── Edge Server (Local) ──
    edgeUrl = 'http://localhost:6631';
    setEdgeUrl(url) {
        this.edgeUrl = url;
    }
    async edgeRequest(method, path, body) {
        const url = `${this.edgeUrl}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        const options = { method, headers };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        const text = await response.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new Error(`Edge: Invalid JSON from ${path}`);
        }
        if (!response.ok) {
            const err = parsed;
            throw new Error(`Edge Error ${response.status}: ${err?.error?.message || text.substring(0, 200)}`);
        }
        return parsed;
    }
    async edgeHealth() {
        return this.edgeRequest('GET', '/local/v1/health');
    }
    async edgePrinters() {
        return this.edgeRequest('GET', '/local/v1/fleet/printers');
    }
    async edgePrintJob(printerId, payloadType, payload, copies) {
        return this.edgeRequest('POST', '/local/v1/print/jobs', { printerId, payloadType, payload, copies: copies || 1 });
    }
    async edgeMetrics() {
        return this.edgeRequest('GET', '/local/v1/metrics');
    }
    async edgeFleetHealth() {
        return this.edgeRequest('GET', '/local/v1/fleet/health');
    }
    async edgePrinterHealth(printerId) {
        return this.edgeRequest('GET', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/health-score`);
    }
    async edgeVerifyScan(barcode, jobId) {
        return this.edgeRequest('POST', '/local/v1/verify/scan', { barcode, jobId });
    }
    async edgeVerifyExpect(barcodes, jobId) {
        return this.edgeRequest('POST', '/local/v1/verify/expect', { barcodes, jobId });
    }
    async edgeVerifyStatus() {
        return this.edgeRequest('GET', '/local/v1/verify/status');
    }
    async edgeVerifyAudit(limit) {
        const qs = limit ? `?limit=${limit}` : '';
        return this.edgeRequest('GET', `/local/v1/verify/audit${qs}`);
    }
    async edgeRulesCache() {
        return this.edgeRequest('GET', '/local/v1/rules/cache');
    }
    async edgeRulesEvaluate(trigger, context) {
        return this.edgeRequest('POST', '/local/v1/rules/evaluate', { trigger, context });
    }
    async edgeAuditRecent(limit, action) {
        const params = new URLSearchParams();
        if (limit)
            params.set('limit', String(limit));
        if (action)
            params.set('action', action);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this.edgeRequest('GET', `/local/v1/audit/recent${qs}`);
    }
    async edgeDiscover() {
        return this.edgeRequest('POST', '/local/v1/fleet/discover');
    }
    // ── Edge System Control ──
    async edgeRestart() {
        return this.edgeRequest('POST', '/local/v1/system/restart');
    }
    async edgeLogs(limit, level) {
        const params = new URLSearchParams();
        if (limit)
            params.set('limit', String(limit));
        if (level)
            params.set('level', level);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this.edgeRequest('GET', `/local/v1/system/logs${qs}`);
    }
    async edgeDiagnostics() {
        return this.edgeRequest('GET', '/local/v1/system/diagnostics');
    }
    async edgeConfig() {
        return this.edgeRequest('GET', '/local/v1/system/config');
    }
    async edgeUpdateConfig(config) {
        return this.edgeRequest('PUT', '/local/v1/system/config', config);
    }
    async edgeUsbDevices() {
        return this.edgeRequest('GET', '/local/v1/system/usb-devices');
    }
    async edgeNetworkScan() {
        return this.edgeRequest('POST', '/local/v1/system/network-scan');
    }
    async edgeCalibrateMedia(printerId) {
        return this.edgeRequest('POST', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/calibrate`);
    }
    async edgeTestPrint(printerId) {
        return this.edgeRequest('POST', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/test-print`);
    }
    async edgePrinterConfig(printerId) {
        return this.edgeRequest('GET', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/config`);
    }
    async edgeUpdatePrinterConfig(printerId, config) {
        return this.edgeRequest('PUT', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/config`, config);
    }
}
exports.LabelInnClient = LabelInnClient;
