/**
 * MCP Context Tools — Factory-aware intelligence layer
 *
 * Higher-level tools that aggregate data from multiple sources to give
 * AI agents the situational awareness needed for intelligent decisions.
 * These are beyond CRUD — they synthesize context.
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerContextTools(server: any, client: LabelInnClient): void;
