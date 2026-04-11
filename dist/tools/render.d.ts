/**
 * Render-as-a-Service MCP tools
 *
 * Allows AI agents to render labels without printing.
 * - render_label: Render a design with data → get PNG/ZPL
 * - render_html: Render raw HTML/CSS → get PNG
 * - render_status: Poll a render job for completion and output URL
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerRenderTools(server: any, client: LabelInnClient): void;
