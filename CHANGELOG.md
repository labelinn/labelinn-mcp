# Changelog

## 2.3.0 - 2026-11-16

Brings the npm server in line with the hosted MCP (functions/api/mcp.js) and the API's print rules.

- print_image: Epson colour printers refuse a bare image (PRINTER_LANGUAGE_MISMATCH, accepted_payload_types [template]); put the image in a design and use print_label. The tool says so in its description and checks the printer's kind before any upload.
- suggest_printer: for the formats image / png / jpeg a colour printer is excluded with the reason "Epson colour printers print designs, not bare images (use template)".
- `office` options gained `fill_order` (top_left_lr default, top_right_rl, bottom_left_lr, bottom_right_rl): the order labels fill the sheet cells.
- print_zpl (desktop route): ZPL is also refused for a printer whose stored type is ESCPOS / PHOMEMO / DYMO / BROTHER_QL while no command language has been resolved yet (same as the server).
- explain_error: PRINTER_LANGUAGE_MISMATCH also covers a bare image sent to a colour printer.
- User-Agent now reports the real version.
