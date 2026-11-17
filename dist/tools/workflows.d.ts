/**
 * Workflow (node-graph automation) MCP tools.
 *
 * A workflow is nodes[] + edges[]. ONE record (a flat key→value map) flows
 * along each edge; nodes read / route / fill it. Mirrors the cloud function
 * MCP (functions/api/mcp.js) and the /v1/workflows REST endpoints.
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerWorkflowTools(server: any, client: LabelInnClient): void;
