
import { McpClient } from './client.js';
import { McpTool } from './tool-wrapper.js';
import type { StructuredToolInterface } from '@langchain/core/tools';

export interface McpServerConfig {
    id: string;
    command: string;
    args?: string[];
    disabled?: boolean;
}

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
     */
    async init(configs: McpServerConfig[]) {
        if (this.initialized) return;

        console.log('🔌 Initializing MCP Manager...');

        for (const config of configs) {
            if (config.disabled) continue;

            try {
                const client = new McpClient(config.id, config.command, config.args || []);
                await client.connect();

                const tools = await client.listTools();
                console.log(`   - Server '${config.id}': Discovered ${tools.length} tools.`);

                // Wrap tools
                const wrappedTools = tools.map(t => new McpTool(client, t));

                this.clients.set(config.id, client);
                this.tools.push(...wrappedTools);

            } catch (error: any) {
                console.error(`   ! Failed to connect to MCP server '${config.id}':`);
                console.error(`     Message: ${error.message}`);
                console.error(`     Stack: ${error.stack}`);
                if (error.issues) {
                    console.error(`     Zod Issues: ${JSON.stringify(error.issues, null, 2)}`);
                }
            }
        }

        this.initialized = true;
        console.log(`✅ MCP Initialization complete. Total tools: ${this.tools.length}`);
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
