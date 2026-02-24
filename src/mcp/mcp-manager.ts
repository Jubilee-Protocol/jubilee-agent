
import { McpClient } from './client.js';
import { McpTool } from './tool-wrapper.js';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { logger } from '../utils/logger.js';
import { ConfigManager } from '../config/settings.js';

export interface McpServerConfig {
    id: string;
    command: string;
    args?: string[];
    disabled?: boolean;
}

// MCP servers that require builder mode to be active
const BUILDER_MODE_SERVERS = ['github'];

/**
 * Singleton manager to handle all MCP server connections and tool aggregation.
 */
export class McpManager {
    private static instance: McpManager;
    private clients: Map<string, McpClient> = new Map();
    private tools: StructuredToolInterface[] = [];
    private initialized: boolean = false;

    private constructor() { }

    static getInstance(): McpManager {
        if (!McpManager.instance) {
            McpManager.instance = new McpManager();
        }
        return McpManager.instance;
    }

    /**
     * Initialize connections to configured servers.
     * Mode-aware: builder-only servers (e.g., GitHub) are skipped when builder mode is disabled.
     */
    async init(configs: McpServerConfig[]) {
        if (this.initialized) return;

        logger.info('🔌 Initializing MCP Manager...');
        const config = ConfigManager.getInstance().getConfig();

        for (const serverConfig of configs) {
            if (serverConfig.disabled) continue;

            // Skip builder-only servers when builder mode is off
            if (BUILDER_MODE_SERVERS.includes(serverConfig.id) && !config.modes.builder) {
                logger.info(`   - Server '${serverConfig.id}': Skipped (requires builder mode).`);
                continue;
            }

            try {
                const client = new McpClient(serverConfig.id, serverConfig.command, serverConfig.args || []);
                await client.connect();

                const tools = await client.listTools();
                logger.info(`   - Server '${serverConfig.id}': Discovered ${tools.length} tools.`);

                // Wrap tools
                const wrappedTools = tools.map(t => new McpTool(client, t));

                this.clients.set(serverConfig.id, client);
                this.tools.push(...wrappedTools);

            } catch (error: any) {
                logger.error(`Failed to connect to MCP server '${serverConfig.id}': ${error.message}`);
                logger.debug(`Stack: ${error.stack}`);
                if (error.issues) {
                    logger.debug(`Zod Issues: ${JSON.stringify(error.issues, null, 2)}`);
                }
            }
        }

        this.initialized = true;
        logger.info(`✅ MCP Initialization complete. Total tools: ${this.tools.length}`);
    }

    /**
     * Get all discovered MCP tools.
     */
    getTools(): StructuredToolInterface[] {
        return this.tools;
    }

    /**
     * Cleanup connections.
     */
    async closeAll() {
        for (const client of this.clients.values()) {
            await client.close();
        }
        this.clients.clear();
        this.tools = [];
        this.initialized = false;
    }
}
