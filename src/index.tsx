#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

import { McpManager } from './mcp/index.js';
import { logger } from './utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config({ quiet: true });

// Initialize MCP Manager
// Detect mcp.json or use default empty config
interface McpConfigItem {
    id: string;
    command: string;
    args: string[];
    disabled?: boolean;
}
let mcpConfig: McpConfigItem[] = [];
const mcpConfigPath = path.resolve(process.cwd(), 'mcp.json');

if (fs.existsSync(mcpConfigPath)) {
    try {
        const rawData = fs.readFileSync(mcpConfigPath, 'utf8');
        const parsed = JSON.parse(rawData);
        if (parsed.mcpServers) {
            mcpConfig = Object.entries(parsed.mcpServers).map(([key, value]: [string, any]) => ({
                id: key,
                command: value.command,
                args: value.args,
                env: value.env,
                disabled: value.disabled
            }));
        }
    } catch (e) {
        logger.error('Failed to load mcp.json:', e);
    }
}

// Initialize MCP connections (await to ensure tools are ready before CLI starts)
try {
    await McpManager.getInstance().init(mcpConfig);
} catch (e) {
    logger.error('Failed to initialize MCP Manager:', e);
}

// Initialize Treasury (The Almoner)
// Suppress stdout during init to hide AgentKit's DEBUG lines that leak API key metadata
import { TreasuryServer } from './mcp/servers/treasury/index.js';
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, ...args: any[]) => {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    if (str.includes('DEBUG:')) return true; // Suppress AgentKit DEBUG lines
    return (originalStdoutWrite as any)(chunk, ...args);
};
try {
    await TreasuryServer.getInstance().init();
} catch (e) {
    logger.error('Failed to initialize Treasury Server:', e);
} finally {
    process.stdout.write = originalStdoutWrite; // Restore stdout
}

// Initial "The Voice" API
import { startVoiceServer } from './server/index.js';
startVoiceServer(process.env.PORT ? parseInt(process.env.PORT) : 3001);

// Handle Headless (OS) Execution vs Interactive CLI
const isInteractive = process.stdout.isTTY && !process.env.HEADLESS;

if (isInteractive) {
    // Render the CLI app and wait for it to exit
    const { waitUntilExit } = render(<CLI />);
    await waitUntilExit();
} else {
    // In headless mode (OS), keep the process alive indefinitely
    logger.info('🚀 Jubilee Core running in Headless Mode (OS)');
    logger.info('Use the "Will" Dashboard to interact.');

    // Prevent exit
    await new Promise(() => { });
}

// Cleanup MCP connections (only reached if CLI exits or process killed)
await McpManager.getInstance().closeAll();
