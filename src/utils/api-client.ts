/**
 * LabelInn API HTTP Client
 * Wraps the LabelInn REST API for use by MCP tools.
 */

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
      'User-Agent': 'labelinn-mcp/2.0.0',
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
  async listPrinters(status?: string): Promise<unknown[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
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
  async createPrintJob(params: {
    printer_id: string;
    payload_type: 'zpl' | 'template' | 'image';
    payload_data?: string;
    design_id?: string;
    image_url?: string;
    data?: Record<string, unknown>;
    copies?: number;
    job_name?: string;
  }): Promise<unknown> {
    return this.request('POST', '/print/jobs', params);
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

  async createSerialPool(pool: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/compliance/pools', pool);
  }

  async listSerialPools(): Promise<unknown[]> {
    return this.request('GET', '/compliance/pools');
  }

  async allocateSerials(poolId: string, count: number): Promise<unknown> {
    return this.request('POST', `/compliance/pools/${encodeURIComponent(poolId)}/allocate`, { count });
  }

  async voidSerials(poolId: string, serials: string[], reason: string): Promise<unknown> {
    return this.request('POST', `/compliance/pools/${encodeURIComponent(poolId)}/void`, { serials, reason });
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
  async ingestData(data: unknown, format?: string, sourceId?: string): Promise<unknown> {
    return this.request('POST', '/connect/ingest', { data, format, source_id: sourceId });
  }

  async testParse(data: unknown, format?: string): Promise<unknown> {
    return this.request('POST', '/connect/test-parse', { data, format });
  }

  async listConnectorSources(): Promise<unknown[]> {
    return this.request('GET', '/connect/sources');
  }

  async printFromConnector(sourceId: string, designId: string, printerId: string): Promise<unknown> {
    return this.request('POST', `/connect/sources/${encodeURIComponent(sourceId)}/print`, { design_id: designId, printer_id: printerId });
  }

  // ── Edge Server (Local) ──
  private edgeUrl: string = 'http://localhost:6631';

  setEdgeUrl(url: string) {
    this.edgeUrl = url;
  }

  private async edgeRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.edgeUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const text = await response.text();

    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error(`Edge: Invalid JSON from ${path}`); }
    if (!response.ok) {
      const err = parsed as ApiError;
      throw new Error(`Edge Error ${response.status}: ${err?.error?.message || text.substring(0, 200)}`);
    }
    return parsed as T;
  }

  async edgeHealth(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/health');
  }

  async edgePrinters(): Promise<unknown> {
    return this.edgeRequest('GET', '/local/v1/fleet/printers');
  }

  async edgePrintJob(printerId: string, payloadType: string, payload: string, copies?: number): Promise<unknown> {
    return this.edgeRequest('POST', '/local/v1/print/jobs', { printerId, payloadType, payload, copies: copies || 1 });
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
