"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkflowTools = registerWorkflowTools;
const zod_1 = require("zod");
const NODE_MODEL_DOC = 'Node types & their key ports: ' +
    '"source" {config:{kind:"database"|"manual"|"webhook", connectionId?, tableName?}} → emits the row on output port "record"; ' +
    '"schedule"/"marketplace" — other entry triggers; ' +
    '"router" {config:{branches:[{name, condition:{field, operator, value}}]}} — routes the record to output port "branch:NAME" of the FIRST matching branch (operators: eq,neq,gt,gte,lt,lte,contains); add {name:"__default__"} to catch the rest; ' +
    '"design" {config:{designId, _variables:[{name}]}} — fills the named design variables from the incoming record (same-name auto-bind) on input port "data"/"in"/"record"; emits the filled design on output port "output"; ' +
    '"print" {config:{printer_id}} — prints the filled design that arrives on input port "design" (a filled design arriving IS the print trigger); ' +
    '"print_dialog" — human checkpoint; emits ONE record on submit (operator lookup + manual fields). ' +
    'Edge shape: {id, from:{node,port}, to:{node,port}}. Typical wiring: source.record → router.in, router."branch:X" → designA.data, designA.output → print.design.';
function registerWorkflowTools(server, client) {
    // ── describe_workflow_nodes ── discover the build contract first
    server.tool('describe_workflow_nodes', 'Discover the full workflow building contract BEFORE creating a workflow: every node type, its role ' +
        '(entry / transform / route / terminal / checkpoint), configurable parameters (types, enums, required ' +
        'flags), input/output ports, the router operator vocabulary, port types, and the one-record-per-edge ' +
        'data model. Call this first, then build nodes[]+edges[] and create_workflow, then test_workflow.', {}, async () => {
        const result = await client.get('/workflows/capabilities');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_workflows ──
    server.tool('list_workflows', 'List all workflows (node-graph automations).', {
        limit: zod_1.z.number().optional().describe('Max results (1-100, default 25)'),
        page_token: zod_1.z.string().optional().describe('Pagination cursor from a previous list'),
    }, async (params) => {
        const qs = new URLSearchParams();
        if (params.limit)
            qs.set('limit', String(params.limit));
        if (params.page_token)
            qs.set('page_token', params.page_token);
        const q = qs.toString();
        const result = await client.get(`/workflows${q ? '?' + q : ''}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_workflow ──
    server.tool('get_workflow', 'Get one workflow (nodes, edges, version).', {
        workflow_id: zod_1.z.string().describe('The workflow ID'),
    }, async (params) => {
        const result = await client.get(`/workflows/${encodeURIComponent(params.workflow_id)}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── create_workflow ──
    server.tool('create_workflow', 'Create a node-graph workflow (nodes[] + edges[]). ONE record (flat key→value map) flows along each edge. ' +
        NODE_MODEL_DOC +
        ' After creating, call test_workflow with a sample row to dry-run and inspect the per-node trace.', {
        name: zod_1.z.string().describe('Workflow name'),
        nodes: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).describe('Nodes: [{id, type, position:{x,y}, config:{...}}]'),
        edges: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).describe('Edges: [{id, from:{node,port}, to:{node,port}}]'),
        description: zod_1.z.string().optional().describe('Optional description'),
        enabled: zod_1.z.boolean().optional().describe('Enabled (default true)'),
    }, async (params) => {
        const result = await client.post('/workflows', {
            name: params.name,
            description: params.description,
            nodes: params.nodes,
            edges: params.edges,
            enabled: params.enabled,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── update_workflow ──
    server.tool('update_workflow', 'Replace a workflow\'s nodes/edges (bumps version). Pass the FULL node/edge lists. ' + NODE_MODEL_DOC, {
        workflow_id: zod_1.z.string().describe('The workflow ID'),
        name: zod_1.z.string().describe('Workflow name'),
        nodes: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).describe('Full node list (replaces existing)'),
        edges: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).describe('Full edge list (replaces existing)'),
        description: zod_1.z.string().optional(),
        enabled: zod_1.z.boolean().optional(),
    }, async (params) => {
        const result = await client.put(`/workflows/${encodeURIComponent(params.workflow_id)}`, {
            name: params.name,
            description: params.description,
            nodes: params.nodes,
            edges: params.edges,
            enabled: params.enabled,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── delete_workflow ──
    server.tool('delete_workflow', 'Delete a workflow.', {
        workflow_id: zod_1.z.string().describe('The workflow ID to delete'),
    }, async (params) => {
        const result = await client.del(`/workflows/${encodeURIComponent(params.workflow_id)}`);
        return { content: [{ type: 'text', text: `Workflow ${params.workflow_id} deleted. ${JSON.stringify(result)}` }] };
    });
    // ── test_workflow ──
    server.tool('test_workflow', 'Dry-run a workflow against a sample row and return the execution trace: per-node status ' +
        '(ran/skipped/dormant/errored), each node\'s output record, and any (stubbed) print jobs. No real printing. ' +
        'Use this to verify the graph routes, fills, and prints as intended.', {
        workflow_id: zod_1.z.string().describe('The workflow ID'),
        row: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Sample input row — the record the entry node emits'),
    }, async (params) => {
        const result = await client.post(`/workflows/${encodeURIComponent(params.workflow_id)}/test`, {
            row: params.row || {},
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── run_workflow ──
    server.tool('run_workflow', 'TRIGGER a workflow with real data — this PRINTS. Each row runs the workflow and QUEUES real print job(s) ' +
        '(picked up by the online printer device that owns the target printer). Pass ONE row object in `data`, OR an ' +
        'ARRAY of rows for a batch (one run + job per row, up to 1000). If the workflow has a Print Dialog node, the ' +
        'data is fed THROUGH it as if an operator submitted that row; otherwise it feeds the Source. Returns ' +
        'print_jobs[] (job ids) + rows_processed + per-node trace. Run test_workflow first to dry-run without printing. ' +
        'To CONFIRM RESULTS afterwards, pass each returned job id to verify_print_job (asserts it printed + the ' +
        'compliance record is intact) or query_print_history. (Calls POST /v1/print/jobs under the hood.)', {
        workflow_id: zod_1.z.string().describe('Workflow ID to trigger'),
        data: zod_1.z
            .union([
            zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
            zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())),
        ])
            .describe('A single row {column: value} OR an array of rows for a batch'),
        copies: zod_1.z.number().optional().describe('Copies per row (a Print Dialog copySource can still override per row)'),
    }, async (params) => {
        const body = {
            workflow_id: params.workflow_id,
            data: params.data,
        };
        if (params.copies !== undefined)
            body.copies = params.copies;
        const result = await client.post('/print/jobs', body);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
