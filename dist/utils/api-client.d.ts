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
/** SHA-256 of a certificate's DER bytes, lowercase hex. */
export declare function certificateFingerprint(der: Buffer): string;
/** "AA:BB:.." or "aabb.." → 64 lowercase hex digits; null when empty. */
export declare function normalizeFingerprint(fp: string | null | undefined): string | null;
/**
 * One HTTP request to the edge. For https the TLS socket is opened first and
 * its certificate compared with the pin BEFORE any request byte is written;
 * CA and hostname checks are skipped on purpose (the PC's certificate is
 * self-signed, the pin replaces them).
 */
export declare function edgeHttp(baseUrl: string, method: string, reqPath: string, headers: Record<string, string>, body: string | undefined, pin: string | null, timeoutMs: number): Promise<{
    status: number;
    text: string;
}>;
/** Inline cap of POST /print/jobs payload_data; bigger files go through POST /print/uploads. */
export declare const INLINE_MAX_BYTES: number;
/** POST /print/uploads cap (functions/api/printUploads.js). */
export declare const UPLOAD_MAX_BYTES: number;
/** Content type of a printable file from its first bytes, or null. */
export declare function sniffPrintableType(b: Uint8Array): string | null;
/**
 * Why raw ZPL must not go to [printer] (a fleet listing entry), with the API's
 * error codes; null when it may. Same rule as functions/api/officePrint.js
 * officePayloadRefusal and printTargetKind.labelLanguageRefusal (including its
 * fallback to the stored printer type: a printer stored as ESCPOS / PHOMEMO /
 * DYMO / BROTHER_QL whose PC has not published a language is still refused).
 */
export declare function zplRefusalFor(printer: Record<string, unknown> | null | undefined): {
    code: string;
    message: string;
} | null;
/**
 * Why a bare image must not go to [printer] (a fleet listing entry): Epson
 * colour (ESC/Label) printers print designs, not bare images. Null when it
 * may. Same rule as functions/api/printTargetKind.js colorImageRefusal (a
 * forced non-ESC/Label language is the user's call).
 */
export declare function imageRefusalFor(printer: Record<string, unknown> | null | undefined): {
    code: string;
    message: string;
    accepted_payload_types: string[];
} | null;
export declare class LabelInnClient {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl?: string);
    private request;
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body?: unknown): Promise<T>;
    put<T = unknown>(path: string, body?: unknown): Promise<T>;
    del<T = unknown>(path: string): Promise<T>;
    listPrinters(status?: string, filters?: PrinterListFilters): Promise<unknown[]>;
    getPrinter(printerId: string): Promise<unknown>;
    getPrinterStatus(printerId: string): Promise<unknown>;
    listDesigns(limit?: number): Promise<unknown[]>;
    getDesign(designId: string): Promise<unknown>;
    getDesignVariables(designId: string): Promise<unknown>;
    cloneDesign(designId: string, name?: string): Promise<unknown>;
    createPrintJob(params: PrintJobParams): Promise<unknown>;
    /**
     * UNIFIED PRINTERS R3: POST /print/uploads, then PUT the bytes to the signed
     * URL with the headers the API returned. Returns the upload_id to print with
     * (POST /print/jobs {payload_type: 'image', upload_id}).
     */
    uploadPrintFile(bytes: Uint8Array, contentType: string, fileName?: string): Promise<string>;
    /**
     * UNIFIED PRINTERS R3: an image / PDF job from bytes — inline when small
     * (unchanged), else through POST /print/uploads automatically.
     */
    createImageJobFromBytes(bytes: Uint8Array, params: Omit<PrintJobParams, 'payload_type' | 'payload_data' | 'image_url' | 'upload_id'>, fileName?: string): Promise<unknown>;
    listJobs(options?: {
        status?: string;
        limit?: number;
    }): Promise<unknown[]>;
    getJob(jobId: string): Promise<unknown>;
    cancelJob(jobId: string): Promise<unknown>;
    reprintJob(jobId: string, options?: {
        printer_id?: string;
        copies?: number;
    }): Promise<unknown>;
    listWebhooks(): Promise<unknown[]>;
    createWebhook(url: string, events: string[], description?: string): Promise<unknown>;
    deleteWebhook(webhookId: string): Promise<unknown>;
    getUsage(): Promise<unknown>;
    getUsageDaily(): Promise<unknown>;
    discoverPrinters(): Promise<unknown>;
    getDiscoveryResults(sessionId: string): Promise<unknown>;
    addDiscoveredPrinter(sessionId: string, printerAddress: string): Promise<unknown>;
    updatePrinter(printerId: string, data: Record<string, unknown>): Promise<unknown>;
    identifyPrinter(printerId: string): Promise<unknown>;
    setPrinterMedia(printerId: string, media: Record<string, unknown>): Promise<unknown>;
    createPrinterGroup(name: string, printerIds: string[], description?: string): Promise<unknown>;
    listPrinterGroups(): Promise<unknown[]>;
    deletePrinterGroup(groupId: string): Promise<unknown>;
    createDesign(data: Record<string, unknown>): Promise<unknown>;
    updateDesign(designId: string, data: Record<string, unknown>): Promise<unknown>;
    deleteDesign(designId: string): Promise<unknown>;
    addElement(designId: string, element: Record<string, unknown>): Promise<unknown>;
    updateElement(designId: string, elementId: string, data: Record<string, unknown>): Promise<unknown>;
    deleteElement(designId: string, elementId: string): Promise<unknown>;
    renderDesign(designId: string, data?: Record<string, unknown>): Promise<unknown>;
    publishDesign(designId: string, note?: string): Promise<unknown>;
    listSnapshots(designId: string, limit?: number): Promise<unknown>;
    getSnapshot(designId: string, snapshotId: string): Promise<unknown>;
    printDesign(designId: string, printerId: string, data?: Record<string, unknown>, copies?: number): Promise<unknown>;
    renderLabel(designId: string, data?: unknown, format?: string, dpi?: number): Promise<unknown>;
    renderHtml(params: {
        html: string;
        css?: string;
        width?: number;
        height?: number;
        libraries?: string[];
        data?: Record<string, unknown>;
        thermal_mode?: boolean;
        dpi?: number;
    }): Promise<unknown>;
    getRenderStatus(renderId: string): Promise<unknown>;
    createRule(rule: Record<string, unknown>): Promise<unknown>;
    listRules(): Promise<unknown[]>;
    getRule(ruleId: string): Promise<unknown>;
    updateRule(ruleId: string, data: Record<string, unknown>): Promise<unknown>;
    deleteRule(ruleId: string): Promise<unknown>;
    testRule(ruleId: string, sampleData: Record<string, unknown>): Promise<unknown>;
    getAuditTrail(options?: {
        action?: string;
        limit?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<unknown>;
    getAuditSummary(): Promise<unknown>;
    createSerialPool(pool: Record<string, unknown>): Promise<unknown>;
    listSerialPools(): Promise<unknown[]>;
    allocateSerials(poolId: string, count: number): Promise<unknown>;
    voidSerials(poolId: string, serials: string[], reason: string): Promise<unknown>;
    createSite(site: Record<string, unknown>): Promise<unknown>;
    listSites(): Promise<unknown[]>;
    getSite(siteId: string): Promise<unknown>;
    updateSite(siteId: string, data: Record<string, unknown>): Promise<unknown>;
    deleteSite(siteId: string): Promise<unknown>;
    assignPrintersToSite(siteId: string, printerIds: string[]): Promise<unknown>;
    getSiteAnalytics(siteId: string): Promise<unknown>;
    findNearestSite(lat: number, lon: number): Promise<unknown>;
    getPredictions(printerId: string): Promise<unknown>;
    getFleetTrends(period?: string): Promise<unknown>;
    getQualityScore(printerId: string): Promise<unknown>;
    simulatePrint(designId: string, printerId?: string, copies?: number): Promise<unknown>;
    ingestData(data: unknown, format?: string, sourceId?: string): Promise<unknown>;
    testParse(data: unknown, format?: string): Promise<unknown>;
    updateConnectorMappings(sourceId: string, mappings: Record<string, string>): Promise<unknown>;
    listConnectorSources(): Promise<unknown[]>;
    printFromConnector(sourceId: string, designId: string, printerId: string): Promise<unknown>;
    private edgeUrl;
    private edgeAuthToken;
    /** TLS pin for an https edge (edge.json `tlsSha256`). */
    private edgeTlsSha256;
    private edgeAvailable;
    private edgeDescriptor;
    setEdgeUrl(url: string): void;
    setEdgeAuthToken(token: string | null): void;
    isEdgeAvailable(): boolean;
    getEdgeDescriptor(): EdgeDescriptor | null;
    getEdgeUrl(): string;
    discoverEdge(probeTimeoutMs?: number): Promise<boolean>;
    private edgeRequest;
    createPrintJobSmart(params: PrintJobParams): Promise<unknown>;
    assertImageAllowed(printerId: string): Promise<void>;
    listPrintersSmart(status?: string, filters?: PrinterListFilters): Promise<unknown[]>;
    getPrinterStatusSmart(printerId: string): Promise<unknown>;
    edgeHealth(): Promise<unknown>;
    edgePrinters(): Promise<unknown>;
    edgePrintJob(printerId: string, payloadType: string, payload: string, copies?: number): Promise<unknown>;
    edgeMetrics(): Promise<unknown>;
    edgeFleetHealth(): Promise<unknown>;
    edgePrinterHealth(printerId: string): Promise<unknown>;
    edgeVerifyScan(barcode: string, jobId?: string): Promise<unknown>;
    edgeVerifyExpect(barcodes: string[], jobId?: string): Promise<unknown>;
    edgeVerifyStatus(): Promise<unknown>;
    edgeVerifyAudit(limit?: number): Promise<unknown>;
    edgeRulesCache(): Promise<unknown>;
    edgeRulesEvaluate(trigger: string, context: Record<string, unknown>): Promise<unknown>;
    edgeAuditRecent(limit?: number, action?: string): Promise<unknown>;
    edgeDiscover(): Promise<unknown>;
    edgeRestart(): Promise<unknown>;
    edgeLogs(limit?: number, level?: string): Promise<unknown>;
    edgeDiagnostics(): Promise<unknown>;
    edgeConfig(): Promise<unknown>;
    edgeUpdateConfig(config: Record<string, unknown>): Promise<unknown>;
    edgeUsbDevices(): Promise<unknown>;
    edgeNetworkScan(): Promise<unknown>;
    edgeCalibrateMedia(printerId: string): Promise<unknown>;
    edgeTestPrint(printerId: string): Promise<unknown>;
    edgePrinterConfig(printerId: string): Promise<unknown>;
    edgeUpdatePrinterConfig(printerId: string, config: Record<string, unknown>): Promise<unknown>;
}
export {};
