/**
 * UNIFIED PRINTERS R3 — suggest_printer and explain_error knowledge, shared by
 * the npm MCP server (tools/context.ts). The hosted MCP server
 * (functions/api/mcp.js) carries a JS twin of [suggestPrinters].
 *
 * Printers are GET /v1/fleet/printers entries: kind (label | receipt | color |
 * office), printer_family, office.payload_types, command_language, site_id,
 * status, is_locked, is_hidden, last_heartbeat, receipt_roll_mm.
 */
type Printer = Record<string, unknown>;
/** Formats suggest_printer understands → what a printer must take. */
export declare const SUGGEST_FORMATS: readonly ["zpl", "escpos", "receipt", "image", "png", "jpeg", "pdf", "template", "design", "office", "color"];
/** Why [p] cannot print [format], or null when it can. */
export declare function formatProblem(p: Printer, format: string): string | null;
/**
 * The printers that can print [format] (optionally at [siteId]), best first:
 * online before others, ZPL-speaking printers first for "zpl", then the most
 * recent heartbeat. Locked and hidden printers are never suggested.
 */
export declare function suggestPrinters(printers: Printer[], format: string, siteId?: string | null): {
    format: string;
    site_id: string | null;
    suggestion: Printer | null;
    candidates: Printer[];
    excluded: {
        id: unknown;
        name: unknown;
        reason: string;
    }[];
    reason?: string;
};
/** explain_error knowledge for the API's print error codes. */
export declare const PRINT_ERROR_CODES: Record<string, {
    explanation: string;
    causes: string[];
    fixes: string[];
}>;
export {};
