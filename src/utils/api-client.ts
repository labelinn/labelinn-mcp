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

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import * as tls from 'node:tls';

interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/** UNIFIED PRINTERS: `office` body of a print job sent to an office (A4/Letter) printer. */
export interface OfficePrintOptions {
  sheet?: string;
  grid?: {
    cols: number;
    rows: number;
    label_width_mm: number;
    label_height_mm: number;
    left_mm?: number;
    top_mm?: number;
    h_gap_mm?: number;
    v_gap_mm?: number;
  };
  paper?: 'a4' | 'letter' | 'a5' | 'legal';
  start_at?: number;
  collate?: boolean;
  color?: 'color' | 'grayscale' | 'black_white';
}

/** UNIFIED PRINTERS: list_printers filters. */
export interface PrinterListFilters {
  family?: 'label' | 'office';
  kind?: 'label' | 'receipt' | 'color' | 'office';
}

/** UNIFIED PRINTERS: body of POST /print/jobs as the MCP tools build it. */
export interface PrintJobParams {
  printer_id: string;
  payload_type: 'zpl' | 'template' | 'image';
  payload_data?: string;
  design_id?: string;
  image_url?: string;
  /** UNIFIED PRINTERS R3: a file sent with POST /print/uploads (files over 500 KB). */
  upload_id?: string;
  data?: Record<string, unknown>;
  copies?: number;
  job_name?: string;
  media_width_mm?: number;
  media_height_mm?: number;
  office?: OfficePrintOptions;
}

interface EdgeDescriptor {
  version: number;
  host: string;
  port: number;
  authToken?: string;
  deviceId?: string;
  companyId?: string;
  mode?: string;
  /** "https" when the PC serves its LAN API with its own self-signed certificate. */
  scheme?: string;
  /** SHA-256 of that certificate (DER, lowercase hex) — the pin. */
  tlsSha256?: string;
  startedAt?: string;
}

/** Routes the desktop app's LAN API actually serves (edge_isolate_entry.dart). */
const EDGE_SERVED_ROUTES = [
  'GET /local/v1/health', 'POST /local/v1/print/jobs', 'GET /local/v1/jobs/{id}',
  'GET /local/v1/fleet/printers', 'GET /local/v1/fleet/peers', 'POST /local/v1/fleet/discover',
  'GET /local/v1/fleet/discover/{id}', 'GET /local/v1/designs', 'GET /local/v1/designs/{id}',
  'GET /local/v1/rules/schedule/status', 'POST /local/v1/rules/schedule/run-now',
  'GET /local/v1/audit/recent',
];

/** SHA-256 of a certificate's DER bytes, lowercase hex. */
export function certificateFingerprint(der: Buffer): string {
  return crypto.createHash('sha256').update(der).digest('hex');
}

/** "AA:BB:.." or "aabb.." → 64 lowercase hex digits; null when empty. */
export function normalizeFingerprint(fp: string | null | undefined): string | null {
  if (!fp) return null;
  const clean = String(fp).replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (clean.length !== 64) throw new Error(`Edge: tlsSha256 must be 64 hex digits, got "${fp}"`);
  return clean;
}

/**
 * One HTTP request to the edge. For https the TLS socket is opened first and
 * its certificate compared with the pin BEFORE any request byte is written;
 * CA and hostname checks are skipped on purpose (the PC's certificate is
 * self-signed, the pin replaces them).
 */
export async function edgeHttp(
  baseUrl: string, method: string, reqPath: string, headers: Record<string, string>,
  body: string | undefined, pin: string | null, timeoutMs: number,
): Promise<{ status: number; text: string }> {
  const u = new URL(baseUrl);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
  let socket: tls.TLSSocket | null = null;
  if (u.protocol === 'https:') {
    if (!pin) throw new Error('Edge: https needs a tlsSha256 pin (the edge certificate is self-signed)');
    socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
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
  const allHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) allHeaders['Content-Length'] = String(Buffer.byteLength(body));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host, port, method, path: reqPath, headers: allHeaders, timeout: timeoutMs,
      ...(sock ? { createConnection: () => sock } : { agent: false }),
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Edge: ${method} ${reqPath} timed out`)));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// ── UNIFIED PRINTERS R3: big files and printer checks ───────────────────────

/** Inline cap of POST /print/jobs payload_data; bigger files go through POST /print/uploads. */
export const INLINE_MAX_BYTES = 500 * 1024;
/** POST /print/uploads cap (functions/api/printUploads.js). */
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Content type of a printable file from its first bytes, or null. */
export function sniffPrintableType(b: Uint8Array): string | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'application/pdf';
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00)
    || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))) return 'image/tiff';
  return null;
}

const RASTER_ONLY_LANGUAGES = ['escpos', 'esc/pos', 'phomemo', 'dymo', 'brotherql', 'brother_ql'];

/** Normalised language word: lower case, no spaces, "_" and "-" kept out of the comparison. */
function langKey(v: unknown): string {
  return String(v === undefined || v === null ? '' : v).toLowerCase().replace(/[\s_/-]/g, '');
}

/** True when [word] names a raster-only (no label language) printer protocol. */
function isRasterOnlyWord(word: unknown): boolean {
  return ['escpos', 'phomemo', 'dymo', 'brotherql'].includes(langKey(word));
}

/**
 * Why raw ZPL must not go to [printer] (a fleet listing entry), with the API's
 * error codes; null when it may. Same rule as functions/api/officePrint.js
 * officePayloadRefusal and printTargetKind.labelLanguageRefusal (including its
 * fallback to the stored printer type: a printer stored as ESCPOS / PHOMEMO /
 * DYMO / BROTHER_QL whose PC has not published a language is still refused).
 */
export function zplRefusalFor(printer: Record<string, unknown> | null | undefined): { code: string; message: string } | null {
  if (!printer) return null;
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
export function imageRefusalFor(printer: Record<string, unknown> | null | undefined): { code: string; message: string; accepted_payload_types: string[] } | null {
  if (!printer) return null;
  if (String(printer.kind || '').toLowerCase() !== 'color') return null;
  const forced = langKey(printer.language_override);
  if (forced && forced !== 'esclabel') return null;
  const name = String(printer.name || printer.id || 'This printer');
  return {
    code: 'PRINTER_LANGUAGE_MISMATCH',
    message: `Printer ${name} is an Epson colour (ESC/Label) printer: it cannot print a bare image yet. Place the image in a design and send payload_type "template" (print_label) instead.`,
    accepted_payload_types: ['template'],
  };
}

export class LabelInnClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://labelinn.com/v1';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'labelinn-mcp/2.3.0',
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response from ${method} ${path}: ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      const err = parsed as ApiError;
      throw new Error(
        `API Error ${response.status}: ${err?.error?.message || err?.error?.code || text.substring(0, 200)}`
      );
    }

    // Unwrap {data: ...} envelope if present
    const obj = parsed as Record<string, unknown>;
    return (obj.data !== undefined ? obj.data : parsed) as T;
  }

  // ── Generic HTTP helpers ──
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async del<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ── Fleet ──
  // UNIFIED PRINTERS: optional `family` (label|office) and `kind`
  // (label|receipt|color|office) filters, sent as query parameters.
  async listPrinters(status?: string, filters?: PrinterListFilters): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (filters?.family) params.set('family', filters.family);
    if (filters?.kind) params.set('kind', filters.kind);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/fleet/printers${qs}`);
  }

  async getPrinter(printerId: string): Promise<unknown> {
    return this.request('GET', `/fleet/printers/${encodeURIComponent(printerId)}`);
  }

  async getPrinterStatus(printerId: string): Promise<unknown> {
    return this.request('GET', `/fleet/printers/${encodeURIComponent(printerId)}/status`);
  }

  // ── Designs ──
  async listDesigns(limit?: number): Promise<unknown[]> {
    const qs = limit ? `?limit=${limit}` : '';
    return this.request('GET', `/designs${qs}`);
  }

  async getDesign(designId: string): Promise<unknown> {
    return this.request('GET', `/designs/${encodeURIComponent(designId)}`);
  }

  async getDesignVariables(designId: string): Promise<unknown> {
    return this.request('GET', `/designs/${encodeURIComponent(designId)}/variables`);
  }

  async cloneDesign(designId: string, name?: string): Promise<unknown> {
    return this.request('POST', `/designs/${encodeURIComponent(designId)}/clone`, { name });
  }

  // ── Print Jobs ──
  // UNIFIED PRINTERS: params type now carries optional office / media size.
  async createPrintJob(params: PrintJobParams): Promise<unknown> {
    return this.request('POST', '/print/jobs', params);
  }

  /**
   * UNIFIED PRINTERS R3: POST /print/uploads, then PUT the bytes to the signed
   * URL with the headers the API returned. Returns the upload_id to print with
   * (POST /print/jobs {payload_type: 'image', upload_id}).
   */
  async uploadPrintFile(bytes: Uint8Array, contentType: string, fileName?: string): Promise<string> {
    if (bytes.length > UPLOAD_MAX_BYTES) {
      throw new Error(`API Error 413: PAYLOAD_TOO_LARGE: the file is ${bytes.length} bytes; at most ${UPLOAD_MAX_BYTES} (25 MB).`);
    }
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const up = await this.request<{ upload_id: string; upload_url: string; headers: Record<string, string> }>(
      'POST', '/print/uploads',
      { content_type: contentType, size_bytes: bytes.length, sha256, ...(fileName ? { file_name: fileName } : {}) },
    );
    const put = await fetch(up.upload_url, { method: 'PUT', headers: up.headers, body: bytes as unknown as BodyInit });
    if (!put.ok) {
      throw new Error(`Upload failed: HTTP ${put.status} ${(await put.text()).substring(0, 200)}`);
    }
    return up.upload_id;
  }

  /**
   * UNIFIED PRINTERS R3: an image / PDF job from bytes — inline when small
   * (unchanged), else through POST /print/uploads automatically.
   */
  async createImageJobFromBytes(bytes: Uint8Array, params: Omit<PrintJobParams, 'payload_type' | 'payload_data' | 'image_url' | 'upload_id'>, fileName?: string): Promise<unknown> {
    const ct = sniffPrintableType(bytes);
    if (!ct) throw new Error('API Error 400: NOT_AN_IMAGE: the file is not a PDF or a PNG / JPEG / GIF / BMP / WebP / TIFF image.');
    // base64 grows by 4/3: payload_data must stay under the 500 KB inline cap.
    if (Math.ceil(bytes.length / 3) * 4 <= INLINE_MAX_BYTES) {
      return this.createPrintJob({ ...params, payload_type: 'image', payload_data: Buffer.from(bytes).toString('base64') });
    }
    const uploadId = await this.uploadPrintFile(bytes, ct, fileName);
    return this.createPrintJob({ ...params, payload_type: 'image', upload_id: uploadId });
  }

  async listJobs(options?: { status?: string; limit?: number }): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/print/jobs${qs}`);
  }

  async getJob(jobId: string): Promise<unknown> {
    return this.request('GET', `/print/jobs/${encodeURIComponent(jobId)}`);
  }

  async cancelJob(jobId: string): Promise<unknown> {
    return this.request('DELETE', `/print/jobs/${encodeURIComponent(jobId)}`);
  }

  async reprintJob(jobId: string, options?: { printer_id?: string; copies?: number }): Promise<unknown> {
    return this.request('POST', `/print/jobs/${encodeURIComponent(jobId)}/reprint`, options);
  }

  // ── Webhooks ──
  async listWebhooks(): Promise<unknown[]> {
    return this.request('GET', '/webhooks');
  }

  async createWebhook(url: string, events: string[], description?: string): Promise<unknown> {
    return this.request('POST', '/webhooks', { url, events, description });
  }

  async deleteWebhook(webhookId: string): Promise<unknown> {
    return this.request('DELETE', `/webhooks/${encodeURIComponent(webhookId)}`);
  }

  // ── Usage ──
  async getUsage(): Promise<unknown> {
    return this.request('GET', '/usage');
  }

  async getUsageDaily(): Promise<unknown> {
    return this.request('GET', '/usage/daily');
  }

  // ── Fleet Extended ──
  async discoverPrinters(): Promise<unknown> {
    return this.request('POST', '/fleet/discover');
  }

  async getDiscoveryResults(sessionId: string): Promise<unknown> {
    return this.request('GET', `/fleet/discover/${encodeURIComponent(sessionId)}`);
  }

  async addDiscoveredPrinter(sessionId: string, printerAddress: string): Promise<unknown> {
    return this.request('POST', `/fleet/discover/${encodeURIComponent(sessionId)}/add`, { printer_address: printerAddress });
  }

  async updatePrinter(printerId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PUT', `/fleet/printers/${encodeURIComponent(printerId)}`, data);
  }

  async identifyPrinter(printerId: string): Promise<unknown> {
    return this.request('POST', `/fleet/printers/${encodeURIComponent(printerId)}/identify`);
  }

  async setPrinterMedia(printerId: string, media: Record<string, unknown>): Promise<unknown> {
    return this.request('PUT', `/fleet/printers/${encodeURIComponent(printerId)}/media`, media);
  }

  async createPrinterGroup(name: string, printerIds: string[], description?: string): Promise<unknown> {
    return this.request('POST', '/fleet/groups', { name, printer_ids: printerIds, description });
  }

  async listPrinterGroups(): Promise<unknown[]> {
    return this.request('GET', '/fleet/groups');
  }

  async deletePrinterGroup(groupId: string): Promise<unknown> {
    return this.request('DELETE', `/fleet/groups/${encodeURIComponent(groupId)}`);
  }

  // ── Design Editing ──
  async createDesign(data: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/designs', data);
  }

  async updateDesign(designId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PUT', `/designs/${encodeURIComponent(designId)}`, data);
  }

  async deleteDesign(designId: string): Promise<unknown> {
    return this.request('DELETE', `/designs/${encodeURIComponent(designId)}`);
  }

  async addElement(designId: string, element: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', `/designs/${encodeURIComponent(designId)}/elements`, element);
  }

  async updateElement(designId: string, elementId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PATCH', `/designs/${encodeURIComponent(designId)}/elements/${encodeURIComponent(elementId)}`, data);
  }

  async deleteElement(designId: string, elementId: string): Promise<unknown> {
    return this.request('DELETE', `/designs/${encodeURIComponent(designId)}/elements/${encodeURIComponent(elementId)}`);
  }

  async renderDesign(designId: string, data?: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', `/designs/${encodeURIComponent(designId)}/render`, { data });
  }

  async publishDesign(designId: string, note?: string): Promise<unknown> {
    return this.request('POST', `/designs/${encodeURIComponent(designId)}/publish`, note ? { note } : {});
  }

  async listSnapshots(designId: string, limit?: number): Promise<unknown> {
    const qs = limit ? `?limit=${limit}` : '';
    return this.request('GET', `/designs/${encodeURIComponent(designId)}/snapshots${qs}`);
  }

  async getSnapshot(designId: string, snapshotId: string): Promise<unknown> {
    return this.request('GET', `/designs/${encodeURIComponent(designId)}/snapshots/${encodeURIComponent(snapshotId)}`);
  }

  async printDesign(designId: string, printerId: string, data?: Record<string, unknown>, copies?: number): Promise<unknown> {
    return this.request('POST', `/designs/${encodeURIComponent(designId)}/print`, { printer_id: printerId, data, copies });
  }

  // ── Render-as-a-Service ──
  async renderLabel(designId: string, data?: unknown, format?: string, dpi?: number): Promise<unknown> {
    return this.request('POST', '/render', { design_id: designId, data, format, dpi });
  }

  async renderHtml(params: { html: string; css?: string; width?: number; height?: number; libraries?: string[]; data?: Record<string, unknown>; thermal_mode?: boolean; dpi?: number }): Promise<unknown> {
    return this.request('POST', '/render/html', params);
  }

  async getRenderStatus(renderId: string): Promise<unknown> {
    return this.request('GET', `/render/${encodeURIComponent(renderId)}`);
  }

  // ── Rules Engine ──
  async createRule(rule: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/rules', rule);
  }

  async listRules(): Promise<unknown[]> {
    return this.request('GET', '/rules');
  }

  async getRule(ruleId: string): Promise<unknown> {
    return this.request('GET', `/rules/${encodeURIComponent(ruleId)}`);
  }

  async updateRule(ruleId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PUT', `/rules/${encodeURIComponent(ruleId)}`, data);
  }

  async deleteRule(ruleId: string): Promise<unknown> {
    return this.request('DELETE', `/rules/${encodeURIComponent(ruleId)}`);
  }

  async testRule(ruleId: string, sampleData: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', `/rules/${encodeURIComponent(ruleId)}/test`, { sample_data: sampleData });
  }

  // ── Audit & Compliance ──
  async getAuditTrail(options?: { action?: string; limit?: number; date_from?: string; date_to?: string }): Promise<unknown> {
    const params = new URLSearchParams();
    if (options?.action) params.set('action', options.action);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.date_from) params.set('date_from', options.date_from);
    if (options?.date_to) params.set('date_to', options.date_to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/audit/trail${qs}`);
  }

  async getAuditSummary(): Promise<unknown> {
    return this.request('GET', '/audit/summary');
  }

  // Pool routes resolve under /audit/compliance/* — the API gateway sends
  // /v1/compliance/* to the audit handler, which only matches paths after the
  // /v1/audit prefix is stripped. A bare /compliance/pools 404s.
  async createSerialPool(pool: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/audit/compliance/pools', pool);
  }

  async listSerialPools(): Promise<unknown[]> {
    return this.request('GET', '/audit/compliance/pools');
  }

  async allocateSerials(poolId: string, count: number): Promise<unknown> {
    return this.request('POST', `/audit/compliance/pools/${encodeURIComponent(poolId)}/allocate`, { count });
  }

  async voidSerials(poolId: string, serials: string[], reason: string): Promise<unknown> {
    return this.request('POST', `/audit/compliance/pools/${encodeURIComponent(poolId)}/void`, { serials, reason });
  }

  // ── Sites & Geo ──
  async createSite(site: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/sites', site);
  }

  async listSites(): Promise<unknown[]> {
    return this.request('GET', '/sites');
  }

  async getSite(siteId: string): Promise<unknown> {
    return this.request('GET', `/sites/${encodeURIComponent(siteId)}`);
  }

  async updateSite(siteId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PUT', `/sites/${encodeURIComponent(siteId)}`, data);
  }

  async deleteSite(siteId: string): Promise<unknown> {
    return this.request('DELETE', `/sites/${encodeURIComponent(siteId)}`);
  }

  async assignPrintersToSite(siteId: string, printerIds: string[]): Promise<unknown> {
    return this.request('POST', `/sites/${encodeURIComponent(siteId)}/printers`, { printer_ids: printerIds });
  }

  async getSiteAnalytics(siteId: string): Promise<unknown> {
    return this.request('GET', `/sites/${encodeURIComponent(siteId)}/analytics`);
  }

  async findNearestSite(lat: number, lon: number): Promise<unknown> {
    return this.request('GET', `/sites/nearest?lat=${lat}&lon=${lon}`);
  }

  // ── Analytics & Predictions ──
  async getPredictions(printerId: string): Promise<unknown> {
    return this.request('GET', `/analytics/predictions/${encodeURIComponent(printerId)}`);
  }

  async getFleetTrends(period?: string): Promise<unknown> {
    const qs = period ? `?period=${period}` : '';
    return this.request('GET', `/analytics/fleet/trends${qs}`);
  }

  async getQualityScore(printerId: string): Promise<unknown> {
    return this.request('GET', `/analytics/quality/${encodeURIComponent(printerId)}`);
  }

  async simulatePrint(designId: string, printerId?: string, copies?: number): Promise<unknown> {
    return this.request('POST', '/analytics/digital-twin/simulate', { designId, printerId, copies });
  }

  // ── Data Connect ──
  // The API reads the content from `payload` (a `data` field was ingested as
  // the raw JSON wrapper itself).
  async ingestData(data: unknown, format?: string, sourceId?: string): Promise<unknown> {
    return this.request('POST', '/connect/ingest', { payload: data, format, source_id: sourceId });
  }

  async testParse(data: unknown, format?: string): Promise<unknown> {
    return this.request('POST', '/connect/test-parse', { payload: data, format });
  }

  async updateConnectorMappings(sourceId: string, mappings: Record<string, string>): Promise<unknown> {
    return this.request('PUT', `/connect/sources/${encodeURIComponent(sourceId)}/mappings`, { mappings });
  }

  async listConnectorSources(): Promise<unknown[]> {
    return this.request('GET', '/connect/sources');
  }

  async printFromConnector(sourceId: string, designId: string, printerId: string): Promise<unknown> {
    return this.request('POST', `/connect/sources/${encodeURIComponent(sourceId)}/print`, { design_id: designId, printer_id: printerId });
  }

  // ── Edge Server (Local) ──
  private edgeUrl: string = 'http://localhost:6631';
  private edgeAuthToken: string | null = null;
  /** TLS pin for an https edge (edge.json `tlsSha256`). */
  private edgeTlsSha256: string | null = null;
  private edgeAvailable: boolean = false;
  private edgeDescriptor: EdgeDescriptor | null = null;

  setEdgeUrl(url: string) {
    this.edgeUrl = url;
  }

  setEdgeAuthToken(token: string | null) {
    this.edgeAuthToken = token;
  }

  /// True when a recent `discoverEdge()` call found a reachable local
  /// edge HTTP server. Tools use this to decide whether to attempt the
  /// edge path before falling back to cloud.
  isEdgeAvailable(): boolean {
    return this.edgeAvailable;
  }

  getEdgeDescriptor(): EdgeDescriptor | null {
    return this.edgeDescriptor;
  }

  getEdgeUrl(): string {
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
  async discoverEdge(probeTimeoutMs: number = 500): Promise<boolean> {
    this.edgeAvailable = false;
    this.edgeDescriptor = null;

    const envOverride = process.env.LABELINN_EDGE_URL?.trim();
    let url = envOverride && envOverride.length > 0 ? envOverride.replace(/\/+$/, '') : null;
    let token: string | null = process.env.LABELINN_EDGE_TOKEN?.trim() || null;
    let pin: string | null = null;
    let descriptor: EdgeDescriptor | null = null;
    try {
      pin = normalizeFingerprint(process.env.LABELINN_EDGE_TLS_SHA256?.trim());
    } catch {
      return false;
    }

    if (!url) {
      const descriptorPath = path.join(os.homedir(), '.labelinn', 'edge.json');
      try {
        const raw = await fs.promises.readFile(descriptorPath, 'utf-8');
        descriptor = JSON.parse(raw) as EdgeDescriptor;
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
      } catch {
        // No descriptor — desktop app not running, or no edge mode. Silent.
        return false;
      }
    }

    if (!url) return false;
    if (url.startsWith('https:') && !pin) return false; // nothing to trust it by

    // Probe `/local/v1/health` (public — works without a token).
    try {
      const r = await edgeHttp(url, 'GET', '/local/v1/health', { Accept: 'application/json' }, undefined, pin, probeTimeoutMs);
      if (r.status < 200 || r.status >= 300) return false;
    } catch {
      return false;
    }

    this.edgeUrl = url;
    this.edgeAuthToken = token;
    this.edgeTlsSha256 = pin;
    this.edgeDescriptor = descriptor;
    this.edgeAvailable = true;
    return true;
  }

  private async edgeRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.edgeAuthToken) {
      headers['Authorization'] = `Bearer ${this.edgeAuthToken}`;
    }
    let payload: string | undefined;
    if (body !== undefined && body !== null) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const response = await edgeHttp(this.edgeUrl, method, path, headers, payload, this.edgeTlsSha256, 30000);
    const text = response.text;

    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error(`Edge: Invalid JSON from ${path}`); }
    if (response.status < 200 || response.status >= 300) {
      // The LAN API answers {"error": "..."}; the cloud shape is {"error": {"message"}}.
      const e = (parsed as { error?: unknown })?.error;
      const msg = typeof e === 'string' ? e : (e as ApiError['error'])?.message || text.substring(0, 200);
      if (response.status === 404 && /not found/i.test(String(msg)) && !path.startsWith('/local/v1/jobs/')) {
        throw new Error(`Edge Error 404: ${method} ${path.split('?')[0]} is not served by this LabelInn app's LAN API. `
          + `It serves: ${EDGE_SERVED_ROUTES.join(', ')}.`);
      }
      throw new Error(`Edge Error ${response.status}: ${msg}`);
    }
    return parsed as T;
  }

  // ── Smart routing: prefer local edge when it's up and the operation
  // has a local equivalent; transparently fall back to cloud otherwise.
  // Tools should call these instead of `createPrintJob` / `listPrinters`
  // directly when they want edge-first behaviour.

  /// Submit a print job. Routes through the local edge HTTP server when
  /// the payload type is supported locally (`zpl`, `template` → `design`).
  /// Falls back to the cloud REST API for `image` payloads (the edge
  /// can't download/rasterize remote URLs) or any edge probe failure.
  async createPrintJobSmart(params: PrintJobParams): Promise<unknown> {
    // UNIFIED PRINTERS: office sheet options (and a label size override) have
    // no equivalent in the local job schema, so such jobs go to the cloud.
    const cloudOnly = params.office !== undefined
      || params.media_width_mm !== undefined || params.media_height_mm !== undefined;
    // UNIFIED PRINTERS R3: raw ZPL is checked against the printer's kind
    // BEFORE the local route, with the API's own error codes — the desktop
    // app would otherwise accept it and fail it later (office / receipt).
    if (params.payload_type === 'zpl' && this.edgeAvailable && !cloudOnly) {
      let printer: Record<string, unknown> | null = null;
      try {
        printer = (await this.getPrinter(params.printer_id)) as Record<string, unknown>;
      } catch {
        printer = null; // unknown to the cloud: the PC's own guard decides
      }
      const refusal = zplRefusalFor(printer);
      if (refusal) throw new Error(`API Error 400: ${refusal.code}: ${refusal.message}`);
    }
    if (this.edgeAvailable && params.payload_type !== 'image' && !cloudOnly) {
      try {
        // Translate cloud → local schema. The edge router speaks camelCase
        // and uses `design` for template-style jobs with `designDataRows`.
        const localBody: Record<string, unknown> = {
          printerId: params.printer_id,
          jobName: params.job_name || 'mcp',
          copies: params.copies || 1,
          totalLabels: 1,
        };
        if (params.payload_type === 'zpl') {
          localBody.payloadType = 'zpl';
          localBody.payloadData = params.payload_data;
        } else {
          // 'template' → 'design' on the local edge
          localBody.payloadType = 'design';
          localBody.designId = params.design_id;
          if (params.data) {
            localBody.designDataRows = [params.data];
          }
        }
        return await this.edgeRequest('POST', '/local/v1/print/jobs', localBody);
      } catch (e) {
        // Edge attempted but failed — drop through to cloud. Don't poison
        // edgeAvailable; a single 4xx/5xx shouldn't disable the local path.
      }
    }
    return this.createPrintJob(params);
  }

  /// Refuses a bare image for an Epson colour printer with the API's own
  /// error (the server refuses it too; this answers before any upload).
  /// Best effort: an unknown printer is left to the API.
  async assertImageAllowed(printerId: string): Promise<void> {
    let printer: Record<string, unknown> | null = null;
    try {
      printer = (await this.getPrinter(printerId)) as Record<string, unknown>;
    } catch {
      printer = null;
    }
    const refusal = imageRefusalFor(printer);
    if (refusal) throw new Error(`API Error 400: ${refusal.code}: ${refusal.message}`);
  }

  /// List printers. Prefers the local edge's view (which is authoritative
  /// for printers physically attached to this machine) and falls back to
  /// the cloud fleet for the whole-company view.
  async listPrintersSmart(status?: string, filters?: PrinterListFilters): Promise<unknown[]> {
    // UNIFIED PRINTERS: the cloud list carries `kind` / `family` / `office`
    // and applies the filters server-side, so a filtered list skips the edge.
    const filtered = !!(filters?.family || filters?.kind);
    if (this.edgeAvailable && !filtered) {
      try {
        const result = await this.edgeRequest<{ printers: unknown[] }>(
          'GET',
          '/local/v1/fleet/printers',
        );
        if (result && Array.isArray(result.printers)) {
          if (!status) return result.printers;
          return result.printers.filter(
            (p) => (p as { status?: string; isOnline?: boolean }).status === status,
          );
        }
      } catch {
        // fall through
      }
    }
    return this.listPrinters(status, filters);
  }

  /// Live printer status. The LAN API has no per-printer status route
  /// (GET /local/v1/fleet/printers/{id}/status always answered 404), so this
  /// goes to the cloud status endpoint directly.
  async getPrinterStatusSmart(printerId: string): Promise<unknown> {
    return this.getPrinterStatus(printerId);
  }

  async edgeHealth(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/health');
  }

  async edgePrinters(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/fleet/printers');
  }

  async edgePrintJob(printerId: string, payloadType: string, payload: string, copies?: number): Promise<unknown> {
    // The LAN API reads `payloadData` (a `payload` field was ignored).
    return this.edgeRequest('POST', '/local/v1/print/jobs', { printerId, payloadType, payloadData: payload, copies: copies || 1 });
  }

  async edgeMetrics(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/metrics');
  }

  async edgeFleetHealth(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/fleet/health');
  }

  async edgePrinterHealth(printerId: string): Promise<unknown> {
    return this.edgeRequest('GET', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/health-score`);
  }

  async edgeVerifyScan(barcode: string, jobId?: string): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/verify/scan', { barcode, jobId });
  }

  async edgeVerifyExpect(barcodes: string[], jobId?: string): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/verify/expect', { barcodes, jobId });
  }

  async edgeVerifyStatus(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/verify/status');
  }

  async edgeVerifyAudit(limit?: number): Promise<unknown> {
    const qs = limit ? `?limit=${limit}` : '';
    return this.edgeRequest('GET', `/local/v1/verify/audit${qs}`);
  }

  async edgeRulesCache(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/rules/cache');
  }

  async edgeRulesEvaluate(trigger: string, context: Record<string, unknown>): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/rules/evaluate', { trigger, context });
  }

  async edgeAuditRecent(limit?: number, action?: string): Promise<unknown> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (action) params.set('action', action);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.edgeRequest('GET', `/local/v1/audit/recent${qs}`);
  }

  async edgeDiscover(): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/fleet/discover');
  }

  // ── Edge System Control ──
  async edgeRestart(): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/system/restart');
  }

  async edgeLogs(limit?: number, level?: string): Promise<unknown> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (level) params.set('level', level);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.edgeRequest('GET', `/local/v1/system/logs${qs}`);
  }

  async edgeDiagnostics(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/system/diagnostics');
  }

  async edgeConfig(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/system/config');
  }

  async edgeUpdateConfig(config: Record<string, unknown>): Promise<unknown> {
    return this.edgeRequest('PUT', '/local/v1/system/config', config);
  }

  async edgeUsbDevices(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/system/usb-devices');
  }

  async edgeNetworkScan(): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/system/network-scan');
  }

  async edgeCalibrateMedia(printerId: string): Promise<unknown> {
    return this.edgeRequest('POST', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/calibrate`);
  }

  async edgeTestPrint(printerId: string): Promise<unknown> {
    return this.edgeRequest('POST', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/test-print`);
  }

  async edgePrinterConfig(printerId: string): Promise<unknown> {
    return this.edgeRequest('GET', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/config`);
  }

  async edgeUpdatePrinterConfig(printerId: string, config: Record<string, unknown>): Promise<unknown> {
    return this.edgeRequest('PUT', `/local/v1/fleet/printers/${encodeURIComponent(printerId)}/config`, config);
  }
}
