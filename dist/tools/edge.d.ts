/**
 * Edge Server MCP tools — local LAN operations
 * These tools talk directly to the Edge Server on the local network,
 * bypassing the cloud entirely. Useful for testing, verification, and real-time ops.
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerEdgeTools(server: any, client: LabelInnClient): void;
