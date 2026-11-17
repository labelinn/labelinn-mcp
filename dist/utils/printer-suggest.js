"use strict";
/**
 * UNIFIED PRINTERS R3 — suggest_printer and explain_error knowledge, shared by
 * the npm MCP server (tools/context.ts). The hosted MCP server
 * (functions/api/mcp.js) carries a JS twin of [suggestPrinters].
 *
 * Printers are GET /v1/fleet/printers entries: kind (label | receipt | color |
 * office), printer_family, office.payload_types, command_language, site_id,
 * status, is_locked, is_hidden, last_heartbeat, receipt_roll_mm.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_ERROR_CODES = exports.SUGGEST_FORMATS = void 0;
exports.formatProblem = formatProblem;
exports.suggestPrinters = suggestPrinters;
/** Formats suggest_printer understands → what a printer must take. */
exports.SUGGEST_FORMATS = ['zpl', 'escpos', 'receipt', 'image', 'png', 'jpeg', 'pdf', 'template', 'design', 'office', 'color'];
const RASTER_ONLY = ['escpos', 'esc/pos', 'phomemo', 'dymo', 'brotherql', 'brother_ql'];
function str(v) { return v === undefined || v === null ? '' : String(v).trim().toLowerCase(); }
function officeTakesImages(p) {
    const o = p.office;
    return !!o && Array.isArray(o.payload_types) && o.payload_types.map(str).includes('image');
}
/** Why [p] cannot print [format], or null when it can. */
function formatProblem(p, format) {
    const kind = str(p.kind) || (str(p.printer_family || p.family) === 'office' ? 'office' : 'label');
    const lang = str(p.command_language).replace(/\s/g, '');
    switch (format) {
        case 'zpl':
            if (kind !== 'label')
                return `kind ${kind} takes no ZPL`;
            if (RASTER_ONLY.includes(lang))
                return `${lang} printer has no label language`;
            return null;
        case 'escpos':
        case 'receipt':
            return kind === 'receipt' ? null : 'not a receipt (ESC/POS) printer';
        case 'image':
        case 'png':
        case 'jpeg':
            if (kind === 'color')
                return 'Epson colour printers print designs, not bare images (use template)';
            return kind !== 'office' || officeTakesImages(p) ? null : 'office printer whose PC does not print images yet';
        case 'pdf':
            return kind === 'office' && officeTakesImages(p) ? null : 'PDFs print on office printers with "image" in office.payload_types only';
        case 'office':
            return kind === 'office' ? null : 'not an office (A4) printer';
        case 'color':
            return kind === 'color' ? null : 'not an Epson colour printer';
        case 'template':
        case 'design':
            return null; // every kind prints a design (MediaFit adapts the media)
        default:
            return `unknown format "${format}"`;
    }
}
/**
 * The printers that can print [format] (optionally at [siteId]), best first:
 * online before others, ZPL-speaking printers first for "zpl", then the most
 * recent heartbeat. Locked and hidden printers are never suggested.
 */
function suggestPrinters(printers, format, siteId) {
    const f = str(format);
    const site = siteId ? String(siteId).trim() : null;
    if (!exports.SUGGEST_FORMATS.includes(f)) {
        return { format: f, site_id: site, suggestion: null, candidates: [], excluded: [],
            reason: `Unknown format "${format}". Use one of: ${exports.SUGGEST_FORMATS.join(', ')}.` };
    }
    const excluded = [];
    const ok = [];
    for (const p of printers || []) {
        let why = null;
        if (p.is_locked === true)
            why = 'locked';
        else if (p.is_hidden === true)
            why = 'hidden';
        else if (site && String(p.site_id || '') !== site)
            why = `not at site ${site}`;
        else
            why = formatProblem(p, f);
        if (why)
            excluded.push({ id: p.id, name: p.name, reason: why });
        else
            ok.push(p);
    }
    const ts = (p) => { const t = Date.parse(String(p.last_heartbeat || '')); return Number.isFinite(t) ? t : 0; };
    const online = (p) => (p.is_online === true || str(p.status) === 'online' ? 1 : 0);
    const zplNative = (p) => (f === 'zpl' && str(p.command_language) === 'zpl' ? 1 : 0);
    ok.sort((a, b) => online(b) - online(a) || zplNative(b) - zplNative(a) || ts(b) - ts(a));
    const best = ok[0] || null;
    return {
        format: f,
        site_id: site,
        suggestion: best,
        candidates: ok.slice(0, 5),
        excluded,
        ...(best ? {} : { reason: `No printer${site ? ` at site ${site}` : ''} can print ${f}.` }),
        ...(best && online(best) === 0 ? { reason: 'No suitable printer is online; the suggestion is the most recently seen one (the job waits until it is back).' } : {}),
    };
}
/** explain_error knowledge for the API's print error codes. */
exports.PRINT_ERROR_CODES = {
    OFFICE_PRINTER_NEEDS_DESIGN: {
        explanation: 'An office (A4) printer was sent label language (ZPL, raw, GHS row) or an image its computer cannot print.',
        causes: ['print_zpl / payload_type "zpl" aimed at an office printer', 'An image / PDF to an office printer whose office.payload_types lacks "image"'],
        fixes: ['Use print_label with a design (payload_type "template")', 'For images / PDFs: update LabelInn on the computer that owns the printer'],
    },
    PRINTER_LANGUAGE_MISMATCH: {
        explanation: 'Raw ZPL was sent to a printer with no label language (ESC/POS receipt, Phomemo, DYMO, Brother QL), or a bare image was sent to an Epson colour (ESC/Label) printer.',
        causes: ['print_zpl aimed at a receipt or raster-only printer (also when only its stored type says so)', 'print_image / payload_type "image" aimed at an Epson colour printer (accepted_payload_types: [template])'],
        fixes: ['Use print_label (a design); for an Epson colour printer place the image in a design', 'Pick a ZPL printer: list_printers kind "label"'],
    },
    INVALID_KIND: {
        explanation: 'The kind filter is not one of label, receipt, color, office.',
        causes: ['A typo or an old value in ?kind='],
        fixes: ['Use kind label, receipt, color or office'],
    },
    INVALID_FAMILY: {
        explanation: 'The family filter is not label or office.',
        causes: ['A typo in ?family='],
        fixes: ['Use family label or office'],
    },
    OFFICE_OPTIONS_FOR_LABEL_PRINTER: {
        explanation: '`office` sheet options were sent for a label / receipt / colour printer.',
        causes: ['A job built for an A4 printer sent to a label printer'],
        fixes: ['Leave out `office`, or pick an office printer'],
    },
    INVALID_OFFICE_OPTIONS: {
        explanation: 'The `office` sheet options are not valid (unknown sheet, grid that does not fit, start_at past the last cell).',
        causes: ['Wrong sheet id', 'Grid larger than the paper', 'start_at beyond the sheet'],
        fixes: ['Use a sheet id like "a4-21" or "us-30", or a grid that fits the paper'],
    },
    NOT_AN_IMAGE: {
        explanation: 'The file is not a printable image, or it is a PDF and the printer cannot print PDFs.',
        causes: ['A web page URL instead of a direct image link', 'A PDF sent to a label / receipt / colour printer', 'A PDF to an office printer whose computer runs an older LabelInn'],
        fixes: ['Use a direct link to a PNG / JPEG file', 'Send PDFs to an office printer with "image" in office.payload_types', 'Convert the PDF to PNG for a label printer'],
    },
    PAYLOAD_TOO_LARGE: {
        explanation: 'The file is larger than the limit: 500 KB inline (payload_data), 25 MB through image_url or POST /print/uploads.',
        causes: ['A big scan or multi-page PDF sent inline', 'A file over 25 MB'],
        fixes: ['Send it with image_url or file_path (uploaded automatically up to 25 MB)', 'Split a long PDF into smaller jobs (at most 300 pages each)'],
    },
    PRINTER_APP_TOO_OLD: {
        explanation: 'The computer that owns the printer runs a LabelInn version that cannot print this job (an uploaded file over 500 KB, or an image / PDF on an A4 printer). Nothing was printed.',
        causes: ['Two computers share the printer and the one that took the job is not updated', 'No computer with the current app has been online in the last 15 minutes'],
        fixes: ['Update LabelInn on that computer', 'Keep a computer with the current version running, then retry the job', 'For label printers: send files of at most 500 KB inline'],
    },
    UPLOAD_NOT_FOUND: {
        explanation: 'The upload_id does not exist in this company.',
        causes: ['A typo', 'An upload made with another API key\'s company'],
        fixes: ['Create a new upload with POST /print/uploads'],
    },
    UPLOAD_NOT_RECEIVED: {
        explanation: 'The upload was created but the file was never PUT to its upload_url.',
        causes: ['The PUT failed or was not sent', 'The upload URL expired (15 minutes)'],
        fixes: ['PUT the file with the returned headers, or create a new upload'],
    },
    UPLOAD_EXPIRED: {
        explanation: 'The uploaded file was deleted after its retention period (24 h unused, 72 h after the last job).',
        causes: ['A reprint / retry long after the original job'],
        fixes: ['Upload the file again and create a new job'],
    },
    UPLOAD_HASH_MISMATCH: {
        explanation: 'The uploaded bytes do not match the sha256 given when the upload was created.',
        causes: ['A different file was uploaded', 'The hash was computed on base64 text instead of the raw bytes'],
        fixes: ['Compute sha256 over the raw file bytes and upload again'],
    },
    UPLOAD_SIZE_MISMATCH: {
        explanation: 'The uploaded file size differs from size_bytes.',
        causes: ['Wrong size_bytes'],
        fixes: ['Create the upload with the exact byte size'],
    },
    UPLOAD_TYPE_MISMATCH: {
        explanation: 'The uploaded file is not the content_type declared (a PDF declared as an image, or the reverse).',
        causes: ['Wrong content_type'],
        fixes: ['Declare application/pdf for PDFs and image/* for images'],
    },
    UNSUPPORTED_MEDIA_TYPE: {
        explanation: 'This content_type cannot be printed.',
        causes: ['Word / Excel / SVG / HTML files'],
        fixes: ['Upload a PDF or a PNG / JPEG / GIF / BMP / WebP / TIFF image'],
    },
    CLOUD_PRINTING_OFF: {
        explanation: 'The company switched off print jobs from the web, API and integrations.',
        causes: ['Settings → Privacy → Cloud features'],
        fixes: ['Ask the owner to switch cloud printing on, or print from the desktop app'],
    },
    PRINTER_LOCKED: {
        explanation: 'The printer is locked (maintenance, calibration, media change).',
        causes: ['An operator locked it'],
        fixes: ['Wait until it is unlocked, or pick another printer'],
    },
};
