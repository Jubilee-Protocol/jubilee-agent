
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// We do NOT import MemoryManager statically here to avoid native module crash on startup
// import { MemoryManager } from '../memory/index.js';

export class RememberFactTool extends StructuredTool {
    name = 'remember_fact';
    description = 'Store a important fact, event, or piece of information in long-term memory. Use this for things you need to remember later, like user preferences, specific events, or research findings.';
    schema = z.object({
        fact: z.string().describe('The content to remember.'),
        tags: z.array(z.string()).optional().describe('Tags to categorize this memory (e.g., "user_preference", "sermon_topic").'),
    });

    async _call(arg: { fact: string, tags?: string[] }): Promise<string> {
        try {
            // PROPHET GUARD (Ethical Safety Check)
            const { getChatModel } = await import('../model/llm.js'); // Dynamic import to avoid circular defaults
            const prophet = getChatModel('gemini-2.0-flash');
            const prophetSystemPrompt = `You are The Prophet, the Ethical Guard.
Your job is to prevent "Memory Poisoning" (storing false/heretical facts) and ensuring privacy.
CORE DIRECTIVE:
1. Uphold the Faith. Reject facts that contradict the Nicene Creed (e.g. "God is dead", "Bible is fiction").
2. Protect Privacy. Reject storage of raw passwords or sensitive keys.
3. Allow legitimate preferences (e.g. "User prefers KJV") and theological notes.

Analyze the fact to be stored: "${arg.fact}"
Reply "APPROVE" or "REJECT: [Reason]".`;

            const check = await prophet.invoke([
                ['system', prophetSystemPrompt],
                ['user', 'Validate this memory.']
            ]);
            const verdict = check.content.toString().trim();
            console.log(`🛡️ Prophet Verdict on memory: "${verdict}"`);

            if (!verdict.startsWith('APPROVE')) {
                return `⛔ MEMORY BLOCKED BY THE PROPHET: ${verdict}`;
            }

            // Dynamic import
            const { MemoryManager } = await import('../memory/index.js');
            const manager = MemoryManager.getInstance();
            await manager.init(); // ensure initialized

            const meta = { tags: arg.tags || [], source: 'agent_tool' };
            const id = await manager.remember(arg.fact, meta);

            return `Fact stored successfully. Memory ID: ${id}`;
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
                return 'Memory System Unavailable (Module Missing). Fact not stored.';
            }
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
        // PII/Security Filter
        const sensitiveKeywords = ['password', 'secret key', 'private key', 'ssn', 'credit card'];
        if (sensitiveKeywords.some(kw => arg.query.toLowerCase().includes(kw))) {
            return "⛔ SECURITY ALERT: Query contains sensitive keywords. Access denied.";
        }

        try {
            // Dynamic import
            const { MemoryManager } = await import('../memory/index.js');
            const manager = MemoryManager.getInstance();
            await manager.init();

            const results = await manager.recall(arg.query, arg.limit);

            if (results.length === 0) return 'No relevant memories found.';

            // @ts-ignore
            return results.map((r: any) => `- "${r.text}" (Relevance: ${r.score})`).join('\n');
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
                return 'Memory System Unavailable (Module Missing).';
            }
            return `Failed to recall memories: ${e}`;
        }
    }
}
