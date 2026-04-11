/**
 * System Control MCP tools — manage Edge Server, hardware, diagnostics
 * These tools give the AI agent control over the local system for
 * autonomous testing and self-healing.
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerSystemTools(server: any, client: LabelInnClient): void;
