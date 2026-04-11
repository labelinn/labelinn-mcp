"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSitesTools = registerSitesTools;
function registerSitesTools(server, client) {
    // ── create_site ──
    server.tool('create_site', 'Create a site (factory, warehouse, office) for multi-location management.', {
        name: { type: 'string', description: 'Site name (e.g., "Istanbul Warehouse")' },
        address: { type: 'string', description: 'Physical address', required: false },
        latitude: { type: 'number', description: 'GPS latitude for geo-routing', required: false },
        longitude: { type: 'number', description: 'GPS longitude for geo-routing', required: false },
        timezone: { type: 'string', description: 'Timezone (e.g., "Europe/Istanbul")', required: false },
    }, async (params) => {
        const site = { name: params.name };
        if (params.address)
            site.address = params.address;
        if (params.latitude !== undefined && params.longitude !== undefined) {
            site.location = { lat: params.latitude, lng: params.longitude };
        }
        if (params.timezone)
            site.timezone = params.timezone;
        const result = await client.createSite(site);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── list_sites ──
    server.tool('list_sites', 'List all sites/locations.', {}, async () => {
        const sites = await client.listSites();
        return { content: [{ type: 'text', text: JSON.stringify(sites, null, 2) }] };
    });
    // ── get_site ──
    server.tool('get_site', 'Get site details including assigned printers and stats.', {
        site_id: { type: 'string', description: 'The site ID' },
    }, async (params) => {
        const site = await client.getSite(params.site_id);
        return { content: [{ type: 'text', text: JSON.stringify(site, null, 2) }] };
    });
    // ── assign_printers_to_site ──
    server.tool('assign_printers_to_site', 'Assign printers to a specific site/location.', {
        site_id: { type: 'string', description: 'The site ID' },
        printer_ids: { type: 'array', description: 'Array of printer IDs to assign' },
    }, async (params) => {
        const result = await client.assignPrintersToSite(params.site_id, params.printer_ids);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── find_nearest_site ──
    server.tool('find_nearest_site', 'Find the nearest site to GPS coordinates. Used for geo-routing print jobs to the closest location.', {
        latitude: { type: 'number', description: 'GPS latitude' },
        longitude: { type: 'number', description: 'GPS longitude' },
    }, async (params) => {
        const result = await client.findNearestSite(params.latitude, params.longitude);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_site_analytics ──
    server.tool('get_site_analytics', 'Get printing analytics for a specific site: job counts, success rate, throughput.', {
        site_id: { type: 'string', description: 'The site ID' },
    }, async (params) => {
        const result = await client.getSiteAnalytics(params.site_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_predictions ──
    server.tool('get_predictions', 'Get predictive maintenance data: when will the printer need service? Supply depletion ETA? Failure probability?', {
        printer_id: { type: 'string', description: 'The printer ID' },
    }, async (params) => {
        const result = await client.getPredictions(params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_fleet_trends ──
    server.tool('get_fleet_trends', 'Get fleet-wide health trends and distribution. Shows how the fleet is performing over time.', {
        period: { type: 'string', description: '"7d", "14d", or "30d"', required: false },
    }, async (params) => {
        const result = await client.getFleetTrends(params.period);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_quality_score ──
    server.tool('get_quality_score', 'Get the print quality score for a printer. Factors: success rate, verification rate, consistency.', {
        printer_id: { type: 'string', description: 'The printer ID' },
    }, async (params) => {
        const result = await client.getQualityScore(params.printer_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── simulate_print ──
    server.tool('simulate_print', 'Digital Twin: simulate printing a design on a printer without actually printing. Shows estimated duration, success rate, risks.', {
        design_id: { type: 'string', description: 'The design to simulate' },
        printer_id: { type: 'string', description: 'Target printer (optional — simulates on any)', required: false },
        copies: { type: 'number', description: 'Number of copies to simulate', required: false },
    }, async (params) => {
        const result = await client.simulatePrint(params.design_id, params.printer_id, params.copies);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── compare_scenarios ──
    server.tool('compare_scenarios', 'Digital Twin: compare two or more printing scenarios. Useful for capacity planning and what-if analysis.', {
        scenarios: { type: 'array', description: 'Array of scenario objects to compare' },
    }, async (params) => {
        const result = await client.post('/analytics/digital-twin/compare', { scenarios: params.scenarios });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    // ── get_daily_usage ──
    server.tool('get_daily_usage', 'Get daily usage breakdown by date range.', {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)', required: false },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)', required: false },
    }, async (params) => {
        const qs = new URLSearchParams();
        if (params.start_date)
            qs.set('start_date', params.start_date);
        if (params.end_date)
            qs.set('end_date', params.end_date);
        const q = qs.toString() ? `?${qs}` : '';
        const result = await client.get(`/usage/daily${q}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
}
