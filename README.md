# LabelInn MCP Server

> Let AI assistants print labels, manage printers, and control your fleet.

## What is this?

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that connects AI assistants like Claude, GPT, and Copilot to LabelInn's cloud printing infrastructure.

**After setup, your AI can:**
- "Print 5 copies of the shipping label for order #45123 on the warehouse printer"
- "Which printers are online right now?"
- "Show me the template variables for the product label design"
- "Cancel the last failed print job"
- "How many API calls have I used today?"

## Quick Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "labelinn": {
      "command": "npx",
      "args": ["@labelinn/mcp-server"],
      "env": {
        "LABELINN_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "labelinn": {
      "command": "npx",
      "args": ["@labelinn/mcp-server"],
      "env": {
        "LABELINN_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### From source

```bash
cd integrations/mcp
npm install
npm run build
LABELINN_API_KEY=sk_live_xxx npm start
```

## Available Tools

### Printing (3 tools)
| Tool | Description |
|------|-------------|
| `print_label` | Print using a design template + variable data (most common) |
| `print_zpl` | Send raw ZPL commands to a Zebra printer |
| `print_image` | Print from an image URL (PNG/JPEG) |

### Fleet Management (3 tools)
| Tool | Description |
|------|-------------|
| `list_printers` | List all printers with status filter |
| `get_printer_status` | Live status of a specific printer |
| `get_printer_details` | Full printer info + telemetry |

### Designs (4 tools)
| Tool | Description |
|------|-------------|
| `list_designs` | Browse all label templates |
| `get_design` | Full design details with elements |
| `get_design_variables` | Template variables for data mapping |
| `clone_design` | Copy an existing design |

### Jobs (4 tools)
| Tool | Description |
|------|-------------|
| `list_jobs` | Recent print jobs with status filter |
| `get_job` | Detailed job status |
| `cancel_job` | Cancel a queued job |
| `reprint_job` | Reprint with optional overrides |

## Available Resources

| URI | Description |
|-----|-------------|
| `labelinn://printers` | Live fleet status |
| `labelinn://designs` | Design template catalog |
| `labelinn://usage` | API usage & quota |
| `labelinn://jobs/recent` | Last 20 print jobs |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LABELINN_API_KEY` | Yes | Your API key (`sk_live_*` or `sk_test_*`) |
| `LABELINN_BASE_URL` | No | Override API URL (default: `https://labelinn.com/v1`) |

## API Key

Get your API key from **LabelInn App → Settings → API Keys** (requires Pro or Enterprise plan).

- `sk_live_*` — Production (sends to real printers)
- `sk_test_*` — Sandbox (simulates printing, no physical output)
