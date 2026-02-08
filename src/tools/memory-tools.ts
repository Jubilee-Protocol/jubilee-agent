
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../memory/index.js';

export class RememberFactTool extends StructuredTool {
    name = 'remember_fact';
    description = 'Store a important fact, event, or piece of information in long-term memory. Use this for things you need to remember later, like user preferences, specific events, or research findings.';
    schema = z.object({
        fact: z.string().describe('The content to remember.'),
        tags: z.array(z.string()).optional().describe('Tags to categorize this memory (e.g., "user_preference", "sermon_topic").'),
    });

    async _call(arg: { fact: string, tags?: string[] }): Promise<string> {
        try {
            const manager = MemoryManager.getInstance();
            await manager.init(); // ensure initialized

            const meta = { tags: arg.tags || [], source: 'agent_tool' };
            const id = await manager.remember(arg.fact, meta);

            return `Fact stored successfully. Memory ID: ${id}`;
        } catch (e) {
            return `Failed to store fact: ${e}`;
        }
    }
}

export class RecallMemoriesTool extends StructuredTool {
    name = 'recall_memories';
    description = 'Search long-term memory for relevant facts or events based on a query. Use this to find past information.';
    schema = z.object({
        query: z.string().describe('The semantic search query.'),
        limit: z.number().optional().default(5).describe('Number of results to return.'),
    });

    async _call(arg: { query: string, limit?: number }): Promise<string> {
        try {
            const manager = MemoryManager.getInstance();
            await manager.init();

            const results = await manager.recall(arg.query, arg.limit);

            if (results.length === 0) return 'No relevant memories found.';

            return results.map(r => `- "${r.text}" (Relevance: ${r.score})`).join('\n');
        } catch (e) {
            return `Failed to recall memories: ${e}`;
        }
    }
}
