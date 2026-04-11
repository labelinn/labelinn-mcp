/**
 * SKYNET Autonomous Testing MCP tools
 * ====================================
 * Test session management for the self-healing AI test loop.
 * The AI agent uses these tools to:
 * 1. Start a test session
 * 2. Run tests with expected outcomes
 * 3. Record failures and fixes
 * 4. Generate comprehensive reports
 */
import { LabelInnClient } from '../utils/api-client.js';
export declare function registerTestingTools(server: any, _client: LabelInnClient): void;
