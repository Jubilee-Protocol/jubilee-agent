#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

import { McpManager } from './mcp/index.js';
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
                disabled: value.disabled
            }));
        }
    } catch (e) {
        console.error('Failed to load mcp.json:', e);
    }
}

// Initialize MCP connections (we await this toensure tools are ready before CLI starts)
// Note: In a real CLI app, we might want to show a spinner here.
try {
    await McpManager.getInstance().init(mcpConfig);
} catch (e) {
    console.error('Failed to initialize MCP Manager:', e);
}

// Initialize Treasury (The Almoner) -- DISABLED per user request
// import { TreasuryServer } from './mcp/servers/treasury/index.js';
// try {
//     await TreasuryServer.getInstance().init();
// } catch (e) {
//     console.error('Failed to initialize Treasury Server:', e);
// }

// Render the CLI app and wait for it to exit
// This keeps the process alive until the user exits
const { waitUntilExit } = render(<CLI />);
await waitUntilExit();

// Cleanup MCP connections
await McpManager.getInstance().closeAll();
