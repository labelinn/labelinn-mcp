"use strict";
/**
 * LabelInn API HTTP Client
 * Wraps the LabelInn REST API for use by MCP tools.
 *
 * Edge-aware routing:
 *   The client supports two backends — the public cloud REST API and the
 *   local edge HTTP server (default port 6631) that the desktop app
 *   exposes on the same machine. When a discovery descriptor is found at
 *   `$HOME/.labelinn/edge.json` (written by the desktop app while its
 *   edge server is up) AND the edge passes a health probe, the client
 *   routes tools that have a local equivalent (`print_label`, `print_zpl`,
 *   `list_printers`, `get_printer_status`) through localhost. Tools the
 *   edge doesn't speak (`print_image`, designs, audit, rules) still go to
 *   the cloud. Local LLMs / agents on the same machine never have to
 *   hairpin through the internet for the common print path.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelInnClient = exports.UPLOAD_MAX_BYTES = exports.INLINE_MAX_BYTES = void 0;
exports.certificateFingerprint = certificateFingerprint;
exports.normalizeFingerprint = normalizeFingerprint;
exports.edgeHttp = edgeHttp;
exports.sniffPrintableType = sniffPrintableType;
exports.zplRefusalFor = zplRefusalFor;
exports.imageRefusalFor = imageRefusalFor;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const http = __importStar(require("node:http"));
const net = __importStar(require("node:net"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const tls = __importStar(require("node:tls"));
/** Routes the desktop app's LAN API actually serves (edge_isolate_entry.dart). */
const EDGE_SERVED_ROUTES = [
    'GET /local/v1/health', 'POST /local/v1/print/jobs', 'GET /local/v1/jobs/{id}',
    'GET /local/v1/fleet/printers', 'GET /local/v1/fleet/peers', 'POST /local/v1/fleet/discover',
    'GET /local/v1/fleet/discover/{id}', 'GET /local/v1/designs', 'GET /local/v1/designs/{id}',
    'GET /local/v1/rules/schedule/status', 'POST /local/v1/rules/schedule/run-now',
    'GET /local/v1/audit/recent',
];
/** SHA-256 of a certificate's DER bytes, lowercase hex. */
function certificateFingerprint(der) {
    return crypto.createHash('sha256').update(der).digest('hex');
}
/** "AA:BB:.." or "aabb.." → 64 lowercase hex digits; null when empty. */
function normalizeFingerprint(fp) {
    if (!fp)
        return null;
    const clean = String(fp).replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (clean.length !== 64)
        throw new Error(`Edge: tlsSha256 must be 64 hex digits, got "${fp}"`);
    return clean;
}
/**
 * One HTTP request to the edge. For https the TLS socket is opened first and
 * its certificate compared with the pin BEFORE any request byte is written;
 * CA and hostname checks are skipped on purpose (the PC's certificate is
 * self-signed, the pin replaces them).
 */
async function edgeHttp(baseUrl, method, reqPath, headers, body, pin, timeoutMs) {
    const u = new URL(baseUrl);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
    let socket = null;
    if (u.protocol === 'https:') {
        if (!pin)
            throw new Error('Edge: https needs a tlsSha256 pin (the edge certificate is self-signed)');
        socket = await new Promise((resolve, reject) => {
            const s = tls.connect({ host, port, rejectUnauthorized: false, servername: net.isIP(host) ? undefined : host });
            const timer = setTimeout(() => { s.destroy(); reject(new Error(`Edge: TLS connect to ${host}:${port} timed out`)); }, timeoutMs);
            s.once('secureConnect', () => {
                clearTimeout(timer);
                const cert = s.getPeerCertificate(false);
                const actual = cert && cert.raw ? certificateFingerprint(cert.raw) : '(none)';
                if (actual !== pin) {
                    s.destroy();
                    reject(new Error(`Edge: TLS certificate mismatch (expected sha256 ${pin}, got ${actual}); request not sent`));
                    return;
                }
                resolve(s);
            });
            s.once('error', (e) => { clearTimeout(timer); reject(e); });
        });
    }
    const sock = socket;
    const allHeaders = { ...headers };
    if (body !== undefined)
        allHeaders['Content-Length'] = String(Buffer.byteLength(body));
    return new Promise((resolve, reject) => {
        const req = http.request({
            host, port, method, path: reqPath, headers: allHeaders, timeout: timeoutMs,
            ...(sock ? { createConnection: () => sock } : { agent: false }),
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error(`Edge: ${method} ${reqPath} timed out`)));
        req.on('error', reject);
        if (body !== undefined)
            req.write(body);
        req.end();
    });
}
// ── UNIFIED PRINTERS R3: big files and printer checks ───────────────────────
/** Inline cap of POST /print/jobs payload_data; bigger files go through POST /print/uploads. */
exports.INLINE_MAX_BYTES = 500 * 1024;
/** POST /print/uploads cap (functions/api/printUploads.js). */
exports.UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
/** Content type of a printable file from its first bytes, or null. */
function sniffPrintableType(b) {
    if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d)
        return 'application/pdf';
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
        return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
        return 'image/jpeg';
    if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
        return 'image/gif';
    if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d)
        return 'image/bmp';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
        && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
        return 'image/webp';
    if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00)
        || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)))
        return 'image/tiff';
    return null;
}
const RASTER_ONLY_LANGUAGES = ['escpos', 'esc/pos', 'phomemo', 'dymo', 'brotherql', 'brother_ql'];
/** Normalised language word: lower case, no spaces, "_" and "-" kept out of the comparison. */
function langKey(v) {
    return String(v === undefined || v === null ? '' : v).toLowerCase().replace(/[\s_/-]/g, '');
}
/** True when [word] names a raster-only (no label language) printer protocol. */
function isRasterOnlyWord(word) {
    return ['escpos', 'phomemo', 'dymo', 'brotherql'].includes(langKey(word));
}
/**
 * Why raw ZPL must not go to [printer] (a fleet listing entry), with the API's
 * error codes; null when it may. Same rule as functions/api/officePrint.js
 * officePayloadRefusal and printTargetKind.labelLanguageRefusal (including its
 * fallback to the stored printer type: a printer stored as ESCPOS / PHOMEMO /
 * DYMO / BROTHER_QL whose PC has not published a language is still refused).
 */
function zplRefusalFor(printer) {
    if (!printer)
        return null;
    const name = String(printer.name || printer.id || 'This printer');
    const family = String(printer.printer_family || printer.family || '').toLowerCase();
    const kind = String(printer.kind || '').toLowerCase();
    if (family === 'office' || kind === 'office') {
        return { code: 'OFFICE_PRINTER_NEEDS_DESIGN', message: `Printer ${name} is an office (A4) printer: it prints designs (print_label) and, when office.payload_types has "image", images / PDFs. ZPL is never sent to it.` };
    }
    const lang = String(printer.command_language || '').toLowerCase().replace(/\s/g, '');
    // The resolved language wins; with none, the stored type ("ESCPOS", "PHOMEMO:M110", "DYMO"...).
    const typeHead = String(printer.type || printer.printer_type || '').split(':')[0];
    const raster = lang ? RASTER_ONLY_LANGUAGES.includes(lang) : isRasterOnlyWord(typeHead);
    if (kind === 'receipt' || raster) {
        const what = kind === 'receipt' ? 'receipt / POS printer' : (lang || typeHead.toLowerCase());
        return { code: 'PRINTER_LANGUAGE_MISMATCH', message: `Printer ${name} has no label language (${what}): ZPL would print as text or junk. Use print_label or print_image.` };
    }
    return null;
}
/**
 * Why a bare image must not go to [printer] (a fleet listing entry): Epson
 * colour (ESC/Label) printers print designs, not bare images. Null when it
 * may. Same rule as functions/api/printTargetKind.js colorImageRefusal (a
 * forced non-ESC/Label language is the user's call).
 */
function imageRefusalFor(printer) {
    if (!printer)
        return null;
    if (String(printer.kind || '').toLowerCase() !== 'color')
        return null;
    const forced = langKey(printer.language_override);
    if (forced && forced !== 'esclabel')
        return null;
    const name = String(printer.name || printer.id || 'This printer');
    return {
        code: 'PRINTER_LANGUAGE_MISMATCH',
        message: `Printer ${name} is an Epson colour (ESC/Label) printer: it cannot print a bare image yet. Place the image in a design and send payload_type "template" (print_label) instead.`,
        accepted_payload_types: ['template'],
    };
}
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
            'User-Agent': 'labelinn-mcp/2.3.0',
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
    // UNIFIED PRINTERS: optional `family` (label|office) and `kind`
    // (label|receipt|color|office) filters, sent as query parameters.
    async listPrinters(status, filters) {
        const params = new URLSearchParams();
        if (status)
            params.set('status', status);
        if (filters?.family)
            params.set('family', filters.family);
        if (filters?.kind)
            params.set('kind', filters.kind);
        const qs = params.toString() ? `?${params.toString()}` : '';
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
    // UNIFIED PRINTERS: params type now carries optional office / media size.
    async createPrintJob(params) {
        return this.request('POST', '/print/jobs', params);
    }
    /**
     * UNIFIED PRINTERS R3: POST /print/uploads, then PUT the bytes to the signed
     * URL with the headers the API returned. Returns the upload_id to print with
     * (POST /print/jobs {payload_type: 'image', upload_id}).
     */
    async uploadPrintFile(bytes, contentType, fileName) {
        if (bytes.length > exports.UPLOAD_MAX_BYTES) {
            throw new Error(`API Error 413: PAYLOAD_TOO_LARGE: the file is ${bytes.length} bytes; at most ${exports.UPLOAD_MAX_BYTES} (25 MB).`);
        }
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        const up = await this.request('POST', '/print/uploads', { content_type: contentType, size_bytes: bytes.length, sha256, ...(fileName ? { file_name: fileName } : {}) });
        const put = await fetch(up.upload_url, { method: 'PUT', headers: up.headers, body: bytes });
        if (!put.ok) {
            throw new Error(`Upload failed: HTTP ${put.status} ${(await put.text()).substring(0, 200)}`);
        }
        return up.upload_id;
    }
    /**
     * UNIFIED PRINTERS R3: an image / PDF job from bytes — inline when small
     * (unchanged), else through POST /print/uploads automatically.
     */
    async createImageJobFromBytes(bytes, params, fileName) {
        const ct = sniffPrintableType(bytes);
        if (!ct)
            throw new Error('API Error 400: NOT_AN_IMAGE: the file is not a PDF or a PNG / JPEG / GIF / BMP / WebP / TIFF image.');
        // base64 grows by 4/3: payload_data must stay under the 500 KB inline cap.
        if (Math.ceil(bytes.length / 3) * 4 <= exports.INLINE_MAX_BYTES) {
            return this.createPrintJob({ ...params, payload_type: 'image', payload_data: Buffer.from(bytes).toString('base64') });
        }
        const uploadId = await this.uploadPrintFile(bytes, ct, fileName);
        return this.createPrintJob({ ...params, payload_type: 'image', upload_id: uploadId });
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
    // Pool routes resolve under /audit/compliance/* — the API gateway sends
    // /v1/compliance/* to the audit handler, which only matches paths after the
    // /v1/audit prefix is stripped. A bare /compliance/pools 404s.
    async createSerialPool(pool) {
        return this.request('POST', '/audit/compliance/pools', pool);
    }
    async listSerialPools() {
        return this.request('GET', '/audit/compliance/pools');
    }
    async allocateSerials(poolId, count) {
        return this.request('POST', `/audit/compliance/pools/${encodeURIComponent(poolId)}/allocate`, { count });
    }
    async voidSerials(poolId, serials, reason) {
        return this.request('POST', `/audit/compliance/pools/${encodeURIComponent(poolId)}/void`, { serials, reason });
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
    // The API reads the content from `payload` (a `data` field was ingested as
    // the raw JSON wrapper itself).
    async ingestData(data, format, sourceId) {
        return this.request('POST', '/connect/ingest', { payload: data, format, source_id: sourceId });
    }
    async testParse(data, format) {
        return this.request('POST', '/connect/test-parse', { payload: data, format });
    }
    async updateConnectorMappings(sourceId, mappings) {
        return this.request('PUT', `/connect/sources/${encodeURIComponent(sourceId)}/mappings`, { mappings });
    }
    async listConnectorSources() {
        return this.request('GET', '/connect/sources');
    }
    async printFromConnector(sourceId, designId, printerId) {
        return this.request('POST', `/connect/sources/${encodeURIComponent(sourceId)}/print`, { design_id: designId, printer_id: printerId });
    }
    // ── Edge Server (Local) ──
    edgeUrl = 'http://localhost:6631';
    edgeAuthToken = null;
    /** TLS pin for an https edge (edge.json `tlsSha256`). */
    edgeTlsSha256 = null;
    edgeAvailable = false;
    edgeDescriptor = null;
    setEdgeUrl(url) {
        this.edgeUrl = url;
    }
    setEdgeAuthToken(token) {
        this.edgeAuthToken = token;
    }
    /// True when a recent `discoverEdge()` call found a reachable local
    /// edge HTTP server. Tools use this to decide whether to attempt the
    /// edge path before falling back to cloud.
    isEdgeAvailable() {
        return this.edgeAvailable;
    }
    getEdgeDescriptor() {
        return this.edgeDescriptor;
    }
    getEdgeUrl() {
        return this.edgeUrl;
    }
    /// Locate the local edge HTTP server and confirm it answers. Order:
    ///   1. `LABELINN_EDGE_URL` env override (no auth probe — caller owns it);
    ///      an https URL needs `LABELINN_EDGE_TLS_SHA256` (the pin)
    ///   2. `$HOME/.labelinn/edge.json` descriptor written by the desktop app;
    ///      `scheme: "https"` + `tlsSha256` there → pinned https, otherwise http
    ///   3. Skip otherwise — `edgeAvailable` stays false
    ///
    /// Failures are silent; the cloud path always works as a fallback.
    /// Call this once at MCP server startup (and optionally on a timer if
    /// you want to re-probe after the desktop app restarts).
    async discoverEdge(probeTimeoutMs = 500) {
        this.edgeAvailable = false;
        this.edgeDescriptor = null;
        const envOverride = process.env.LABELINN_EDGE_URL?.trim();
        let url = envOverride && envOverride.length > 0 ? envOverride.replace(/\/+$/, '') : null;
        let token = process.env.LABELINN_EDGE_TOKEN?.trim() || null;
        let pin = null;
        let descriptor = null;
        try {
            pin = normalizeFingerprint(process.env.LABELINN_EDGE_TLS_SHA256?.trim());
        }
        catch {
            return false;
        }
        if (!url) {
            const descriptorPath = path.join(os.homedir(), '.labelinn', 'edge.json');
            try {
                const raw = await fs.promises.readFile(descriptorPath, 'utf-8');
                descriptor = JSON.parse(raw);
                if (descriptor && descriptor.port) {
                    const d = descriptor;
                    pin = normalizeFingerprint(d.tlsSha256);
                    // Auto TLS: the PC serves https with its own certificate and
                    // publishes its SHA-256 here. No fingerprint → plain http (TLS off
                    // or an app version from before auto TLS).
                    const scheme = pin ? (d.scheme || 'https') : 'http';
                    url = `${scheme}://${d.host || '127.0.0.1'}:${d.port}`;
                    token = token || d.authToken || null;
                }
            }
            catch {
                // No descriptor — desktop app not running, or no edge mode. Silent.
                return false;
            }
        }
        if (!url)
            return false;
        if (url.startsWith('https:') && !pin)
            return false; // nothing to trust it by
        // Probe `/local/v1/health` (public — works without a token).
        try {
            const r = await edgeHttp(url, 'GET', '/local/v1/health', { Accept: 'application/json' }, undefined, pin, probeTimeoutMs);
            if (r.status < 200 || r.status >= 300)
                return false;
        }
        catch {
            return false;
        }
        this.edgeUrl = url;
        this.edgeAuthToken = token;
        this.edgeTlsSha256 = pin;
        this.edgeDescriptor = descriptor;
        this.edgeAvailable = true;
        return true;
    }
    async edgeRequest(method, path, body) {
        const headers = { Accept: 'application/json' };
        if (this.edgeAuthToken) {
            headers['Authorization'] = `Bearer ${this.edgeAuthToken}`;
        }
        let payload;
        if (body !== undefined && body !== null) {
            payload = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        }
        const response = await edgeHttp(this.edgeUrl, method, path, headers, payload, this.edgeTlsSha256, 30000);
        const text = response.text;
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new Error(`Edge: Invalid JSON from ${path}`);
        }
        if (response.status < 200 || response.status >= 300) {
            // The LAN API answers {"error": "..."}; the cloud shape is {"error": {"message"}}.
            const e = parsed?.error;
            const msg = typeof e === 'string' ? e : e?.message || text.substring(0, 200);
            if (response.status === 404 && /not found/i.test(String(msg)) && !path.startsWith('/local/v1/jobs/')) {
                throw new Error(`Edge Error 404: ${method} ${path.split('?')[0]} is not served by this LabelInn app's LAN API. `
                    + `It serves: ${EDGE_SERVED_ROUTES.join(', ')}.`);
            }
            throw new Error(`Edge Error ${response.status}: ${msg}`);
        }
        return parsed;
    }
    // ── Smart routing: prefer local edge when it's up and the operation
    // has a local equivalent; transparently fall back to cloud otherwise.
    // Tools should call these instead of `createPrintJob` / `listPrinters`
    // directly when they want edge-first behaviour.
    /// Submit a print job. Routes through the local edge HTTP server when
    /// the payload type is supported locally (`zpl`, `template` → `design`).
    /// Falls back to the cloud REST API for `image` payloads (the edge
    /// can't download/rasterize remote URLs) or any edge probe failure.
    async createPrintJobSmart(params) {
        // UNIFIED PRINTERS: office sheet options (and a label size override) have
        // no equivalent in the local job schema, so such jobs go to the cloud.
        const cloudOnly = params.office !== undefined
            || params.media_width_mm !== undefined || params.media_height_mm !== undefined;
        // UNIFIED PRINTERS R3: raw ZPL is checked against the printer's kind
        // BEFORE the local route, with the API's own error codes — the desktop
        // app would otherwise accept it and fail it later (office / receipt).
        if (params.payload_type === 'zpl' && this.edgeAvailable && !cloudOnly) {
            let printer = null;
            try {
                printer = (await this.getPrinter(params.printer_id));
            }
            catch {
                printer = null; // unknown to the cloud: the PC's own guard decides
            }
            const refusal = zplRefusalFor(printer);
            if (refusal)
                throw new Error(`API Error 400: ${refusal.code}: ${refusal.message}`);
        }
        if (this.edgeAvailable && params.payload_type !== 'image' && !cloudOnly) {
            try {
                // Translate cloud → local schema. The edge router speaks camelCase
                // and uses `design` for template-style jobs with `designDataRows`.
                const localBody = {
                    printerId: params.printer_id,
                    jobName: params.job_name || 'mcp',
                    copies: params.copies || 1,
                    totalLabels: 1,
                };
                if (params.payload_type === 'zpl') {
                    localBody.payloadType = 'zpl';
                    localBody.payloadData = params.payload_data;
                }
                else {
                    // 'template' → 'design' on the local edge
                    localBody.payloadType = 'design';
                    localBody.designId = params.design_id;
                    if (params.data) {
                        localBody.designDataRows = [params.data];
                    }
                }
                return await this.edgeRequest('POST', '/local/v1/print/jobs', localBody);
            }
            catch (e) {
                // Edge attempted but failed — drop through to cloud. Don't poison
                // edgeAvailable; a single 4xx/5xx shouldn't disable the local path.
            }
        }
        return this.createPrintJob(params);
    }
    /// Refuses a bare image for an Epson colour printer with the API's own
    /// error (the server refuses it too; this answers before any upload).
    /// Best effort: an unknown printer is left to the API.
    async assertImageAllowed(printerId) {
        let printer = null;
        try {
            printer = (await this.getPrinter(printerId));
        }
        catch {
            printer = null;
        }
        const refusal = imageRefusalFor(printer);
        if (refusal)
            throw new Error(`API Error 400: ${refusal.code}: ${refusal.message}`);
    }
    /// List printers. Prefers the local edge's view (which is authoritative
    /// for printers physically attached to this machine) and falls back to
    /// the cloud fleet for the whole-company view.
    async listPrintersSmart(status, filters) {
        // UNIFIED PRINTERS: the cloud list carries `kind` / `family` / `office`
        // and applies the filters server-side, so a filtered list skips the edge.
        const filtered = !!(filters?.family || filters?.kind);
        if (this.edgeAvailable && !filtered) {
            try {
                const result = await this.edgeRequest('GET', '/local/v1/fleet/printers');
                if (result && Array.isArray(result.printers)) {
                    if (!status)
                        return result.printers;
                    return result.printers.filter((p) => p.status === status);
                }
            }
            catch {
                // fall through
            }
        }
        return this.listPrinters(status, filters);
    }
    /// Live printer status. The LAN API has no per-printer status route
    /// (GET /local/v1/fleet/printers/{id}/status always answered 404), so this
    /// goes to the cloud status endpoint directly.
    async getPrinterStatusSmart(printerId) {
        return this.getPrinterStatus(printerId);
    }
    async edgeHealth() {
        return this.edgeRequest('GET', '/local/v1/health');
    }
    async edgePrinters() {
        return this.edgeRequest('GET', '/local/v1/fleet/printers');
    }
    async edgePrintJob(printerId, payloadType, payload, copies) {
        // The LAN API reads `payloadData` (a `payload` field was ignored).
        return this.edgeRequest('POST', '/local/v1/print/jobs', { printerId, payloadType, payloadData: payload, copies: copies || 1 });
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
