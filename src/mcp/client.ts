
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
    type Tool,
    ListToolsResultSchema,
    CallToolResultSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

/**
 * A client for connecting to an MCP server.
 */
export class McpClient {
    private client: Client;
    private transport: StdioClientTransport;
    private connected: boolean = false;

    constructor(
        private serverName: string,
        command: string,
        args: string[] = []
    ) {
        this.transport = new StdioClientTransport({
            command,
            args
        });

        // Route MCP server stderr through logger instead of raw console
        const transportAny = this.transport as any;
        if (transportAny.stderr) {
            transportAny.stderr.on('data', (data: Buffer) => {
                logger.debug(`[MCP STDERR: ${serverName}] ${data}`);
            });
        }

        this.client = new Client(
            {
                name: `jubilee-${serverName}-client`,
                version: '1.0.0',
            },
            {
                capabilities: {},
            }
        );
    }

    /**
     * Connect to the MCP server.
     */
    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            await this.client.connect(this.transport);
            this.connected = true;
            logger.info(`🔌 Connected to MCP server: ${this.serverName}`);
        } catch (error) {
            logger.error(`❌ Failed to connect to MCP server ${this.serverName}:`, error);
            throw error;
        }
    }

    /**
     * List available tools from the server.
     */
    async listTools(): Promise<Tool[]> {
        if (!this.connected) await this.connect();

        const result = await this.client.request(
            { method: 'tools/list' },
            ListToolsResultSchema
        );
        return result.tools;
    }

    /**
     * Call a tool on the server.
     */
    async callTool(name: string, args: Record<string, unknown>): Promise<any> {
        if (!this.connected) await this.connect();

        const result = await this.client.request(
            {
                method: 'tools/call',
                params: {
                    name,
                    arguments: args
                }
            },
            CallToolResultSchema
        );

        return result;
    }

    /**
     * Disconnect and cleanup.
     */
    async close(): Promise<void> {
        if (this.connected) {
            await this.client.close();
            this.connected = false;
        }
    }
}

