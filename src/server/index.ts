
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { streamText } from 'hono/streaming';
import { logService } from '../services/log-service.js';
import { logger as cliLogger } from '../utils/logger.js';
import { TreasuryServer } from '../mcp/servers/treasury/index.js';
import { JUBILEE_VAULTS } from '../config/assets.js';
import { AgentService } from '../services/agent-service.js';
import { timingSafeEqual } from 'crypto';

const app = new Hono();

// CORS — restricted to known origins (localhost dev + production)
app.use('/*', cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://app.jubileeprotocol.com',
        'https://jubileeprotocol.com',
    ],
}));

// Rate Limiting
import { rateLimit } from './middleware/rate-limit.js';
app.use('/*', rateLimit);

// Health Check (Public)
app.get('/health', (c) => {
    return c.json({ status: 'ok', identity: 'Jubilee Agent - The Voice' });
});

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
    if (!a || !b) return false;
    try {
        const bufA = Buffer.from(a, 'utf-8');
        const bufB = Buffer.from(b, 'utf-8');
        if (bufA.length !== bufB.length) {
            // Compare against self to keep timing constant, then return false
            timingSafeEqual(bufA, bufA);
            return false;
        }
        return timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

// Authentication Middleware
app.use('/*', async (c, next) => {
    // Skip auth for health check (already handled above)
    if (c.req.path === '/health') {
        await next();
        return;
    }

    const authHeader = c.req.header('Authorization');
    const adminToken = process.env.JUBILEE_ADMIN_TOKEN;
    const readToken = process.env.JUBILEE_READ_TOKEN;

    // DEFAULT DENY: If no tokens configured, reject all requests
    if (!adminToken && !readToken) {
        cliLogger.warn("⛔ No auth tokens configured. Set JUBILEE_ADMIN_TOKEN in .env.");
        return c.json({ error: 'Server not configured: auth tokens required.' }, 503);
    }

    const providedToken = authHeader?.replace('Bearer ', '') || '';

    // Constant-time comparison to prevent timing attacks
    const isAdmin = adminToken ? safeCompare(providedToken, adminToken) : false;
    const isReader = readToken ? safeCompare(providedToken, readToken) : false;
    const isReadMethod = c.req.method === 'GET';

    if (isAdmin) {
        await next();
        return;
    }

    if (isReader && isReadMethod) {
        await next();
        return;
    }

    // Otherwise reject
    return c.json({ error: 'Unauthorized: Invalid or insufficient permissions' }, 401);
});

// Health Check (Public)
app.get('/health', (c) => {
    return c.json({ status: 'ok', identity: 'Jubilee Agent - The Voice' });
});


// Epistle Endpoint (Logs) - PROTECTED
app.get('/epistle', async (c) => {
    return c.json({
        logs: await logService.getLogs()
    });
});

// Chat Endpoint (The Pulpit) - PROTECTED
app.post('/chat', async (c) => {
    const body = await c.req.json();
    const message = body.message;

    if (!message) {
        return c.json({ error: 'Message required' }, 400);
    }

    // Stream the response to avoid timeouts
    return streamText(c, async (stream) => {
        // Initial "Thinking" message to acknowledge start
        await stream.writeln(JSON.stringify({ type: 'thinking', message: 'Connecting to Jubilee Network...' }));

        const agentStream = AgentService.getInstance().chatStream(message);

        for await (const event of agentStream) {
            // Write each event as a JSON line
            await stream.writeln(JSON.stringify(event));
        }
    });
});

// Treasury Endpoint
app.get('/treasury', async (c) => {
    try {
        const treasury = TreasuryServer.getInstance();
        const address = await treasury.getWalletAddress();

        // In a real implementation, we would query the balance here.
        // For now, we return the address and configured vaults.
        // The frontend can use the address to query chain data directly via Wagmi.

        return c.json({
            address: address,
            vaults: JUBILEE_VAULTS,
            network: 'base'
        });
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
});

// Memory Endpoint (The Archives) - PROTECTED
import { MemoryManager } from '../memory/index.js';

app.get('/memory', async (c) => {
    const q = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');

    try {
        const memory = MemoryManager.getInstance();
        const query = q || 'Jubilee Kingdom';
        const results = await memory.recall(query, limit);

        return c.json({ results });
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
});

// Settings API (The Synod) - PROTECTED
import { SettingsService } from '../services/settings-service.js';

app.get('/settings', async (c) => {
    try {
        const settings = await SettingsService.getInstance().getSettings();
        // Mask keys for security
        const masked = {
            ...settings,
            apiKeys: Object.fromEntries(
                Object.entries(settings.apiKeys).map(([k, v]) => [k, v ? (v.slice(0, 3) + '...' + v.slice(-4)) : ''])
            )
        };
        // Also indicate which ones are available in ENV
        const envKeys = {
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
            GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
            XAI_API_KEY: !!process.env.XAI_API_KEY,
            OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        };

        return c.json({ settings: masked, envKeys });
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
});

app.post('/settings', async (c) => {
    try {
        const body = await c.req.json();
        // Body should be Partial<SystemSettings>
        // Check for specific key updates

        const updated = await SettingsService.getInstance().updateSettings(body);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
});

// Start Server
import { DaemonService } from '../services/daemon-service.js';

export const startVoiceServer = (port: number) => {
    serve({
        fetch: app.fetch,
        port
    }, (info) => {
        cliLogger.info(`\n🎙️  The Voice is speaking on port ${info.port}`);
        cliLogger.info(`🔑  Admin Token: ${process.env.JUBILEE_ADMIN_TOKEN ? '******' : 'NOT SET'}`);
        cliLogger.info(`📖  Read Token: ${process.env.JUBILEE_READ_TOKEN ? '******' : 'NOT SET'}`);

        // Start the Autonomous Daemon
        DaemonService.getInstance().start();
    });
};
