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
import { z } from 'zod';

// ── Types ──
interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'skip' | 'blocked' | 'fixed';
  duration_ms: number;
  error?: string;
  fix_applied?: string;
  fix_file?: string;
  retries: number;
  timestamp: string;
  details?: unknown;
}

interface TestSession {
  id: string;
  started: string;
  ended?: string;
  phase: string;
  results: TestResult[];
  fixes: Array<{ file: string; description: string; timestamp: string }>;
  restarts: Array<{ service: string; reason: string; timestamp: string }>;
  notes: string[];
}

// ── In-memory store ──
const sessions: Map<string, TestSession> = new Map();
let activeSessionId: string | null = null;

function getActive(): TestSession {
  if (!activeSessionId || !sessions.has(activeSessionId)) {
    throw new Error('No active test session. Call skynet_start_session first.');
  }
  return sessions.get(activeSessionId)!;
}

export function registerTestingTools(server: any, _client: LabelInnClient) {
  // ── skynet_start_session ──
  server.tool(
    'skynet_start_session',
    'Start a new SKYNET autonomous test session. This initializes the test tracker. Call this BEFORE running any tests.',
    {
      description: z.string().describe('What this session is testing (e.g., "Full system E2E test")'),
    },
    async (params: { description: string }) => {
      const id = `skynet-${Date.now()}`;
      const session: TestSession = {
        id,
        started: new Date().toISOString(),
        phase: 'initialized',
        results: [],
        fixes: [],
        restarts: [],
        notes: [params.description],
      };
      sessions.set(id, session);
      activeSessionId = id;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `SKYNET Test Session started`,
            session_id: id,
            started: session.started,
            description: params.description,
            instructions: 'Now run tests using skynet_run_test. Record fixes with skynet_record_fix. End with skynet_end_session.',
          }, null, 2),
        }],
      };
    }
  );

  // ── skynet_run_test ──
  server.tool(
    'skynet_run_test',
    'Record the result of a test you just ran. Call this AFTER executing a test via other MCP tools. Status: pass, fail, skip, blocked.',
    {
      name: z.string().describe('Test name (e.g., "Print ZPL to Zebra ZD420")'),
      category: z.string().describe('Category: "health", "fleet", "print", "design", "verify", "rules", "edge", "audit", "sites", "connect", "error_handling"'),
      status: z.string().describe('"pass", "fail", "skip", or "blocked"'),
      error: z.string().optional().describe('Error message if failed'),
      details: z.record(z.string(), z.unknown()).optional().describe('Any additional details (response data, etc.)'),
      duration_ms: z.number().optional().describe('How long the test took in ms'),
    },
    async (params: { name: string; category: string; status: string; error?: string; details?: unknown; duration_ms?: number }) => {
      const session = getActive();
      const existing = session.results.find(r => r.name === params.name);
      const retries = existing ? existing.retries + 1 : 0;

      // If re-running a previously failed test and now it passes, mark as 'fixed'
      const finalStatus = (existing?.status === 'fail' && params.status === 'pass') ? 'fixed' : params.status;

      const result: TestResult = {
        id: `test-${session.results.length + 1}`,
        name: params.name,
        category: params.category,
        status: finalStatus as TestResult['status'],
        duration_ms: params.duration_ms || 0,
        error: params.error,
        retries,
        timestamp: new Date().toISOString(),
        details: params.details,
      };

      // Replace existing or add new
      if (existing) {
        const idx = session.results.indexOf(existing);
        result.fix_applied = existing.fix_applied;
        result.fix_file = existing.fix_file;
        session.results[idx] = result;
      } else {
        session.results.push(result);
      }

      session.phase = params.category;

      const summary = {
        test: params.name,
        status: finalStatus,
        retry: retries,
        total_tests: session.results.length,
        passed: session.results.filter(r => r.status === 'pass' || r.status === 'fixed').length,
        failed: session.results.filter(r => r.status === 'fail').length,
      };

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }
  );

  // ── skynet_record_fix ──
  server.tool(
    'skynet_record_fix',
    'Record that you applied a code fix. Call this after editing a file to fix a failing test.',
    {
      test_name: z.string().describe('Which test this fix is for'),
      file: z.string().describe('File path that was modified'),
      description: z.string().describe('What was changed and why'),
    },
    async (params: { test_name: string; file: string; description: string }) => {
      const session = getActive();
      session.fixes.push({
        file: params.file,
        description: params.description,
        timestamp: new Date().toISOString(),
      });

      // Link fix to the test result
      const test = session.results.find(r => r.name === params.test_name);
      if (test) {
        test.fix_applied = params.description;
        test.fix_file = params.file;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Fix recorded for "${params.test_name}"`,
            file: params.file,
            description: params.description,
            total_fixes: session.fixes.length,
            next_step: `Now restart the affected service and re-run the test "${params.test_name}" to verify the fix.`,
          }, null, 2),
        }],
      };
    }
  );

  // ── skynet_record_restart ──
  server.tool(
    'skynet_record_restart',
    'Record that you restarted a service. Call this after restarting Edge Server, app, or other services.',
    {
      service: z.string().describe('What was restarted: "edge_server", "app", "relay", "cloud_function"'),
      reason: z.string().describe('Why it was restarted'),
    },
    async (params: { service: string; reason: string }) => {
      const session = getActive();
      session.restarts.push({
        service: params.service,
        reason: params.reason,
        timestamp: new Date().toISOString(),
      });

      return {
        content: [{
          type: 'text',
          text: `Restart recorded: ${params.service} — ${params.reason}. Total restarts this session: ${session.restarts.length}`,
        }],
      };
    }
  );

  // ── skynet_add_note ──
  server.tool(
    'skynet_add_note',
    'Add a note to the test session. Use for observations, warnings, or context.',
    {
      note: z.string().describe('The note to add'),
    },
    async (params: { note: string }) => {
      const session = getActive();
      session.notes.push(`[${new Date().toISOString()}] ${params.note}`);
      return { content: [{ type: 'text', text: `Note added. Total notes: ${session.notes.length}` }] };
    }
  );

  // ── skynet_get_status ──
  server.tool(
    'skynet_get_status',
    'Get current test session status: how many passed, failed, fixes applied, etc.',
    {},
    async () => {
      const session = getActive();
      const results = session.results;
      const status = {
        session_id: session.id,
        phase: session.phase,
        duration_minutes: Math.round((Date.now() - new Date(session.started).getTime()) / 60000 * 10) / 10,
        tests: {
          total: results.length,
          passed: results.filter(r => r.status === 'pass').length,
          fixed: results.filter(r => r.status === 'fixed').length,
          failed: results.filter(r => r.status === 'fail').length,
          skipped: results.filter(r => r.status === 'skip').length,
          blocked: results.filter(r => r.status === 'blocked').length,
        },
        fixes_applied: session.fixes.length,
        restarts: session.restarts.length,
        failing_tests: results.filter(r => r.status === 'fail').map(r => ({
          name: r.name,
          category: r.category,
          error: r.error,
          retries: r.retries,
        })),
      };

      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  );

  // ── skynet_end_session ──
  server.tool(
    'skynet_end_session',
    'End the test session and generate a full report. Call this when all tests are done.',
    {
      conclusion: z.string().optional().describe('Your conclusion about the system state'),
    },
    async (params: { conclusion?: string }) => {
      const session = getActive();
      session.ended = new Date().toISOString();
      const results = session.results;

      const durationMin = Math.round((new Date(session.ended).getTime() - new Date(session.started).getTime()) / 60000 * 10) / 10;

      const passed = results.filter(r => r.status === 'pass').length;
      const fixed = results.filter(r => r.status === 'fixed').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const skipped = results.filter(r => r.status === 'skip').length;
      const blocked = results.filter(r => r.status === 'blocked').length;

      // Group by category
      const byCategory: Record<string, { pass: number; fail: number; fixed: number; skip: number; blocked: number }> = {};
      for (const r of results) {
        if (!byCategory[r.category]) byCategory[r.category] = { pass: 0, fail: 0, fixed: 0, skip: 0, blocked: 0 };
        if (r.status === 'pass') byCategory[r.category].pass++;
        else if (r.status === 'fail') byCategory[r.category].fail++;
        else if (r.status === 'fixed') byCategory[r.category].fixed++;
        else if (r.status === 'skip') byCategory[r.category].skip++;
        else if (r.status === 'blocked') byCategory[r.category].blocked++;
      }

      const report = {
        title: '🤖 SKYNET AUTONOMOUS TEST REPORT',
        session_id: session.id,
        started: session.started,
        ended: session.ended,
        duration_minutes: durationMin,
        overall_status: failed === 0 ? '✅ ALL SYSTEMS OPERATIONAL' : `⚠️ ${failed} ISSUE(S) REMAINING`,
        summary: {
          total_tests: results.length,
          passed: passed,
          fixed_by_ai: fixed,
          failed: failed,
          skipped: skipped,
          blocked: blocked,
          success_rate: results.length > 0 ? Math.round((passed + fixed) / results.length * 100) : 0,
        },
        by_category: byCategory,
        fixes_applied: session.fixes.map(f => ({
          file: f.file,
          description: f.description,
          timestamp: f.timestamp,
        })),
        restarts: session.restarts,
        still_failing: results.filter(r => r.status === 'fail').map(r => ({
          name: r.name,
          category: r.category,
          error: r.error,
          retries: r.retries,
        })),
        all_results: results.map(r => ({
          name: r.name,
          category: r.category,
          status: r.status,
          retries: r.retries,
          error: r.error || undefined,
          fix: r.fix_applied || undefined,
        })),
        notes: session.notes,
        conclusion: params.conclusion || (failed === 0
          ? 'All tests passed. System is fully operational.'
          : `${failed} test(s) still failing after self-heal attempts. Manual intervention may be needed.`),
      };

      activeSessionId = null;

      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }
  );

  // ── skynet_get_test_plan ──
  server.tool(
    'skynet_get_test_plan',
    'Get the full SKYNET test plan — all test phases and individual tests. Use this to know what to test.',
    {},
    async () => {
      const plan = {
        title: 'SKYNET Autonomous Test Plan',
        version: '1.0',
        phases: [
          {
            phase: 1,
            name: 'System Health',
            category: 'health',
            tests: [
              { name: 'Edge Server health', tool: 'system_health_check', expect: 'overall = HEALTHY' },
              { name: 'Cloud API reachable', tool: 'get_usage_stats', expect: 'returns usage data' },
              { name: 'USB devices detected', tool: 'check_usb_devices', expect: 'printer + scanner visible' },
              { name: 'Edge diagnostics', tool: 'run_diagnostics', expect: 'all checks pass' },
            ],
          },
          {
            phase: 2,
            name: 'Fleet Management',
            category: 'fleet',
            tests: [
              { name: 'Discover printers', tool: 'discover_printers', expect: 'discovery session created' },
              { name: 'List printers', tool: 'list_printers', expect: 'at least 1 printer' },
              { name: 'Get printer status', tool: 'get_printer_status', expect: 'status = online' },
              { name: 'Get printer details', tool: 'get_printer_details', expect: 'model, firmware, DPI info' },
              { name: 'Get printer config', tool: 'get_printer_config', expect: 'config with speed, darkness' },
              { name: 'Set printer media', tool: 'set_printer_media', expect: 'media settings updated' },
              { name: 'Calibrate printer', tool: 'calibrate_printer', expect: 'calibration command sent' },
              { name: 'Identify printer (LED)', tool: 'identify_printer', expect: 'printer LEDs blink' },
              { name: 'Test print', tool: 'test_print', expect: 'test label printed' },
            ],
          },
          {
            phase: 3,
            name: 'Design CRUD',
            category: 'design',
            tests: [
              { name: 'List designs', tool: 'list_designs', expect: 'returns design array' },
              { name: 'Create design', tool: 'create_design', expect: 'new design created with ID' },
              { name: 'Get design', tool: 'get_design', expect: 'full design with elements' },
              { name: 'Add text element', tool: 'add_design_element', expect: 'text element added' },
              { name: 'Add barcode element', tool: 'add_design_element', expect: 'barcode element added' },
              { name: 'Add QR code element', tool: 'add_design_element', expect: 'QR element added' },
              { name: 'Update element position', tool: 'update_design_element', expect: 'position changed' },
              { name: 'Bind variable to element', tool: 'update_design_element', expect: 'data_source set' },
              { name: 'Get design variables', tool: 'get_design_variables', expect: 'shows bound variables' },
              { name: 'Render preview', tool: 'render_design_preview', expect: 'preview URL returned' },
              { name: 'Clone design', tool: 'clone_design', expect: 'clone created' },
              { name: 'Delete element', tool: 'delete_design_element', expect: 'element removed' },
              { name: 'Delete design', tool: 'delete_design', expect: 'design deleted' },
            ],
          },
          {
            phase: 4,
            name: 'Print Operations',
            category: 'print',
            tests: [
              { name: 'Print ZPL', tool: 'print_zpl', expect: 'job created, label printed' },
              { name: 'Print from template', tool: 'print_label', expect: 'template printed with data' },
              { name: 'Print with variables', tool: 'print_label', expect: 'variables filled correctly' },
              { name: 'Batch print (multi-row)', tool: 'batch_print', expect: 'all rows printed' },
              { name: 'List jobs', tool: 'list_jobs', expect: 'shows recent jobs' },
              { name: 'Get job details', tool: 'get_job', expect: 'job status = completed' },
              { name: 'Cancel job', tool: 'cancel_job', expect: 'job cancelled' },
              { name: 'Reprint job', tool: 'reprint_job', expect: 'reprint executed' },
            ],
          },
          {
            phase: 5,
            name: 'Label Verification (Scanner)',
            category: 'verify',
            tests: [
              { name: 'Set expected barcodes', tool: 'edge_verify_expect', expect: 'expectations set' },
              { name: 'Print label with barcode', tool: 'edge_print', expect: 'label printed' },
              { name: 'Scan barcode', tool: 'edge_verify_scan', expect: 'barcode scanned' },
              { name: 'Verify match', tool: 'edge_verify_status', expect: 'scan matches expected' },
              { name: 'Check verify audit', tool: 'edge_verify_audit', expect: 'scan logged' },
            ],
          },
          {
            phase: 6,
            name: 'Rules Engine',
            category: 'rules',
            tests: [
              { name: 'Create rule', tool: 'create_rule', expect: 'rule created' },
              { name: 'List rules', tool: 'list_rules', expect: 'rule appears in list' },
              { name: 'Test rule (dry-run)', tool: 'test_rule', expect: 'conditions match, actions shown' },
              { name: 'Update rule', tool: 'update_rule', expect: 'rule updated' },
              { name: 'Edge rules evaluate', tool: 'edge_rules_evaluate', expect: 'local evaluation works' },
              { name: 'Delete rule', tool: 'delete_rule', expect: 'rule deleted' },
            ],
          },
          {
            phase: 7,
            name: 'Edge Server Local',
            category: 'edge',
            tests: [
              { name: 'Edge health', tool: 'edge_health', expect: 'server UP' },
              { name: 'Edge printers', tool: 'edge_printers', expect: 'local printers listed' },
              { name: 'Edge print (LAN only)', tool: 'edge_print', expect: 'printed without cloud' },
              { name: 'Edge metrics', tool: 'edge_metrics', expect: 'latency P50/P95/P99' },
              { name: 'Edge fleet health', tool: 'edge_fleet_health', expect: 'health scores' },
              { name: 'Edge discover', tool: 'edge_discover', expect: 'LAN scan executed' },
              { name: 'Edge rules cache', tool: 'edge_rules_cache', expect: 'cached rules shown' },
              { name: 'Edge audit', tool: 'edge_audit', expect: 'local audit events' },
            ],
          },
          {
            phase: 8,
            name: 'Audit & Compliance',
            category: 'audit',
            tests: [
              { name: 'Get audit trail', tool: 'get_audit_trail', expect: 'audit entries returned' },
              { name: 'Get audit summary', tool: 'get_audit_summary', expect: 'counts by action' },
              { name: 'Create serial pool', tool: 'create_serial_pool', expect: 'pool created' },
              { name: 'Allocate serials', tool: 'allocate_serials', expect: 'serials returned' },
              { name: 'Void serials', tool: 'void_serials', expect: 'serials voided with reason' },
            ],
          },
          {
            phase: 9,
            name: 'Error Handling & Recovery',
            category: 'error_handling',
            tests: [
              { name: 'Print to offline printer', tool: 'print_label', expect: 'graceful error message' },
              { name: 'Invalid ZPL code', tool: 'print_zpl', expect: 'validation error returned' },
              { name: 'Get non-existent design', tool: 'get_design', expect: '404 not found' },
              { name: 'Cancel already completed job', tool: 'cancel_job', expect: 'graceful error' },
              { name: 'Edge Server down recovery', tool: 'edge_health', expect: 'detect down + report' },
            ],
          },
        ],
        self_heal_protocol: {
          description: 'When a test fails, follow this protocol:',
          steps: [
            '1. Record the failure: skynet_run_test(status="fail", error="...")',
            '2. Get logs: get_edge_logs(level="error", limit=20)',
            '3. Diagnose: Read error details, search codebase for the root cause',
            '4. Fix: Edit the source code file',
            '5. Record the fix: skynet_record_fix(test_name, file, description)',
            '6. Restart: restart_edge_server(reason) or other restart method',
            '7. Record restart: skynet_record_restart(service, reason)',
            '8. Wait 3 seconds, then re-test',
            '9. If still failing after 3 retries, mark as BLOCKED and continue',
          ],
          max_retries: 3,
          max_restarts_per_session: 10,
        },
      };

      return { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
    }
  );
}
