
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { McpClient } from './client.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Wraps an MCP Tool definition into a LangChain StructuredTool.
 */
export class McpTool extends StructuredTool {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
    private client: McpClient;

    constructor(client: McpClient, toolDef: Tool) {
        super();
        this.client = client;
        this.name = toolDef.name;
        this.description = toolDef.description || `MCP Tool: ${toolDef.name}`;

        // We need to convert JSON Schema to Zod for LangChain
        // This is a simplified conversion. For robustness, we might need a parser library.
        // However, LangChain often just needs a schema to validate LLM output.
        // If toolDef.inputSchema is complex, this simplistic approach might fail for deep validation,
        // but for basic primitive types it connects the dots.
        this.schema = this.jsonSchemaToZod(toolDef.inputSchema);
    }

    /**
     * Convert JSON Schema to Zod. 
     * CAUTION: This is a basic implementation. Complex schemas may need 'json-schema-to-zod' package.
     */
    private jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
        const shape: Record<string, z.ZodTypeAny> = {};

        if (jsonSchema && jsonSchema.properties) {
            for (const [key, value] of Object.entries(jsonSchema.properties)) {
                const prop = value as any;
                let zodSchema: z.ZodTypeAny = z.any();

                if (prop.type === 'string') zodSchema = z.string();
                else if (prop.type === 'number' || prop.type === 'integer') zodSchema = z.number();
                else if (prop.type === 'boolean') zodSchema = z.boolean();
                else if (prop.type === 'array') zodSchema = z.array(z.any());
                else if (prop.type === 'object') zodSchema = z.record(z.any());

                if (prop.description) {
                    zodSchema = zodSchema.describe(prop.description);
                }

                // Handle required fields
                if (!jsonSchema.required?.includes(key)) {
                    zodSchema = zodSchema.optional();
                }

                shape[key] = zodSchema;
            }
        }

        return z.object(shape);
    }

    async _call(arg: any): Promise<string> {
        try {
            const result = await this.client.callTool(this.name, arg);

            // MCP result structure: { content: [{ type: 'text', text: '...' }] }
            if (result.content && Array.isArray(result.content)) {
                return result.content
                    .map((c: any) => c.text || JSON.stringify(c))
                    .join('\n');
            }

            return JSON.stringify(result);
        } catch (error) {
            console.error(`Error callsing MCP tool ${this.name}:`, error);
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
