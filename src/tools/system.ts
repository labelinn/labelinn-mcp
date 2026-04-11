/**
 * System Control MCP tools — manage Edge Server, hardware, diagnostics
 * These tools give the AI agent control over the local system for
 * autonomous testing and self-healing.
 */
import { LabelInnClient } from '../utils/api-client.js';
import { execSync } from 'child_process';
import * as os from 'os';

export function registerSystemTools(server: any, client: LabelInnClient) {
  // ── system_health_check ──
  server.tool(
    'system_health_check',
    'Comprehensive health check: Edge Server, Cloud API, printers, scanner, network. Returns a full status report. Run this FIRST in any test session.',
    {},
    async () => {
      const report: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        checks: {} as Record<string, unknown>,
      };
      const checks = report.checks as Record<string, unknown>;

      // Edge Server
      try {
        const health = await client.edgeHealth();
        checks.edge_server = { status: 'UP', details: health };
      } catch (e: any) {
        checks.edge_server = { status: 'DOWN', error: e.message };
      }

      // Cloud API
      try {
        const usage = await client.getUsage();
        checks.cloud_api = { status: 'UP', usage };
      } catch (e: any) {
        checks.cloud_api = { status: 'DOWN', error: e.message };
      }

      // Printers
      try {
        const printers = await client.edgePrinters();
        checks.printers = { status: 'OK', data: printers };
      } catch (e: any) {
        checks.printers = { status: 'ERROR', error: e.message };
      }

      // USB Devices (printers + scanners)
      try {
        const usb = await client.edgeUsbDevices();
        checks.usb_devices = { status: 'OK', data: usb };
      } catch (e: any) {
        // Fallback: try lsusb
        try {
          const lsusb = execSync('lsusb 2>/dev/null || echo "lsusb not available"', { timeout: 5000 }).toString().trim();
          checks.usb_devices = { status: 'FALLBACK', data: lsusb };
        } catch {
          checks.usb_devices = { status: 'UNKNOWN', error: 'Cannot detect USB devices' };
        }
      }

      // System info
      checks.system = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime_hours: Math.round(os.uptime() / 3600 * 10) / 10,
        memory_total_gb: Math.round(os.totalmem() / 1073741824 * 10) / 10,
        memory_free_gb: Math.round(os.freemem() / 1073741824 * 10) / 10,
        cpus: os.cpus().length,
        network: Object.entries(os.networkInterfaces())
          .filter(([name]) => !name.startsWith('lo'))
          .map(([name, addrs]) => ({ name, addresses: addrs?.filter(a => a.family === 'IPv4').map(a => a.address) })),
      };

      // Overall status
      const allChecks = Object.values(checks) as Array<{ status: string }>;
      const anyDown = allChecks.some(c => c.status === 'DOWN' || c.status === 'ERROR');
      report.overall = anyDown ? 'DEGRADED' : 'HEALTHY';

      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }
  );

  // ── restart_edge_server ──
  server.tool(
    'restart_edge_server',
    'Restart the Edge Server. Use this after applying code fixes or when the server is unresponsive.',
    {
      reason: { type: 'string', description: 'Why you are restarting (for audit trail)' },
    },
    async (params: { reason: string }) => {
      try {
        const result = await client.edgeRestart();
        return { content: [{ type: 'text', text: `Edge Server restart requested. Reason: ${params.reason}\n${JSON.stringify(result, null, 2)}` }] };
      } catch (e: any) {
        // If edge is down, try to find and restart the process
        return { content: [{ type: 'text', text: `Edge Server not reachable for restart request: ${e.message}\nThe LabelInn app may need to be restarted manually, or use 'kill_and_restart_app' tool.` }] };
      }
    }
  );

  // ── get_edge_logs ──
  server.tool(
    'get_edge_logs',
    'Get recent Edge Server logs. Use this to diagnose failures after a test fails.',
    {
      limit: { type: 'number', description: 'Number of log entries (default 50)', required: false },
      level: { type: 'string', description: 'Filter by level: "error", "warning", "info", "debug"', required: false },
    },
    async (params: { limit?: number; level?: string }) => {
      try {
        const logs = await client.edgeLogs(params.limit || 50, params.level);
        return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Cannot fetch logs: ${e.message}` }] };
      }
    }
  );

  // ── run_diagnostics ──
  server.tool(
    'run_diagnostics',
    'Run comprehensive diagnostics on the Edge Server. Tests connectivity to all printers, checks config, validates certificates.',
    {},
    async () => {
      try {
        const diag = await client.edgeDiagnostics();
        return { content: [{ type: 'text', text: JSON.stringify(diag, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Diagnostics failed: ${e.message}` }] };
      }
    }
  );

  // ── check_usb_devices ──
  server.tool(
    'check_usb_devices',
    'List connected USB devices. Use this to find thermal printers and barcode scanners.',
    {},
    async () => {
      try {
        const devices = await client.edgeUsbDevices();
        return { content: [{ type: 'text', text: JSON.stringify(devices, null, 2) }] };
      } catch (e: any) {
        // Fallback to system command
        try {
          const platform = os.platform();
          let output: string;
          if (platform === 'linux') {
            output = execSync('lsusb 2>/dev/null && echo "---" && ls /dev/usb* 2>/dev/null || echo "No /dev/usb devices"', { timeout: 5000 }).toString();
          } else if (platform === 'darwin') {
            output = execSync('system_profiler SPUSBDataType 2>/dev/null | head -60', { timeout: 10000 }).toString();
          } else if (platform === 'win32') {
            output = execSync('wmic path Win32_USBHub get DeviceID,Name,Status 2>nul', { timeout: 10000 }).toString();
          } else {
            output = 'Unsupported platform for USB detection';
          }
          return { content: [{ type: 'text', text: `USB Devices (system fallback):\n${output}` }] };
        } catch (e2: any) {
          return { content: [{ type: 'text', text: `Cannot detect USB devices: ${e.message}` }] };
        }
      }
    }
  );

  // ── get_edge_config ──
  server.tool(
    'get_edge_config',
    'Get the Edge Server configuration. Shows ports, enabled features, printer settings, etc.',
    {},
    async () => {
      try {
        const config = await client.edgeConfig();
        return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Cannot fetch config: ${e.message}` }] };
      }
    }
  );

  // ── update_edge_config ──
  server.tool(
    'update_edge_config',
    'Update Edge Server configuration. Can enable/disable features, change ports, update printer settings.',
    {
      config: { type: 'object', description: 'Configuration key-value pairs to update' },
    },
    async (params: { config: Record<string, unknown> }) => {
      const result = await client.edgeUpdateConfig(params.config);
      return { content: [{ type: 'text', text: `Config updated.\n${JSON.stringify(result, null, 2)}` }] };
    }
  );

  // ── calibrate_printer ──
  server.tool(
    'calibrate_printer',
    'Send calibration command to a thermal printer. Calibrates media sensor, gap detection, and print darkness.',
    {
      printer_id: { type: 'string', description: 'The printer to calibrate' },
    },
    async (params: { printer_id: string }) => {
      const result = await client.edgeCalibrateMedia(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── test_print ──
  server.tool(
    'test_print',
    'Print a test label on a specific printer. Useful for verifying printer connectivity and print quality.',
    {
      printer_id: { type: 'string', description: 'The printer to test' },
    },
    async (params: { printer_id: string }) => {
      const result = await client.edgeTestPrint(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_printer_config ──
  server.tool(
    'get_printer_config',
    'Get detailed printer configuration: DPI, speed, darkness, media type, label size, firmware version.',
    {
      printer_id: { type: 'string', description: 'The printer ID' },
    },
    async (params: { printer_id: string }) => {
      const config = await client.edgePrinterConfig(params.printer_id);
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
    }
  );

  // ── update_printer_config ──
  server.tool(
    'update_printer_config',
    'Update printer configuration: speed, darkness, media type, label dimensions, orientation.',
    {
      printer_id: { type: 'string', description: 'The printer ID' },
      config: { type: 'object', description: 'Config updates: {darkness: 15, speed: 4, media_type: "gap", label_width_mm: 100, label_height_mm: 60}' },
    },
    async (params: { printer_id: string; config: Record<string, unknown> }) => {
      const result = await client.edgeUpdatePrinterConfig(params.printer_id, params.config);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── network_scan ──
  server.tool(
    'network_scan',
    'Scan the local network for printers, Edge Server instances, and other LabelInn devices.',
    {},
    async () => {
      try {
        const result = await client.edgeNetworkScan();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Network scan failed: ${e.message}` }] };
      }
    }
  );

  // ── get_system_info ──
  server.tool(
    'get_system_info',
    'Get local machine info: OS, CPU, memory, disk, network interfaces. Useful for diagnosing environment issues.',
    {},
    async () => {
      const info = {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime_hours: Math.round(os.uptime() / 3600 * 10) / 10,
        cpus: os.cpus().length,
        cpu_model: os.cpus()[0]?.model,
        memory: {
          total_gb: Math.round(os.totalmem() / 1073741824 * 10) / 10,
          free_gb: Math.round(os.freemem() / 1073741824 * 10) / 10,
          used_percent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        },
        network: Object.entries(os.networkInterfaces()).map(([name, addrs]) => ({
          name,
          addresses: addrs?.map(a => ({ address: a.address, family: a.family, internal: a.internal })),
        })),
        env: {
          node_version: process.version,
          edge_url: process.env.LABELINN_EDGE_URL || 'http://localhost:6631',
          api_key_set: !!process.env.LABELINN_API_KEY,
        },
      };
      return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }
  );
}
