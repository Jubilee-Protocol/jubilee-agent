
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Agent } from '../agent/agent.js';
import type { AgentConfig } from '../agent/types.js';
import { getChatModel } from '../model/llm.js';
import { getToolsForRole, getToolRegistry } from './registry.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

/**
 * DispatchAngelTool
 * Allows the agent to dispatch a specialized Angel ("Sub-Agent") to perform a task.
 */
export class DispatchAngelTool extends StructuredTool {
    name = 'dispatch_angel';
    description = 'Dispatch a specialized Angel to perform a complex task. Use this for parallel research, deep-dive coding, or verification steps that require focus.';

    schema = z.object({
        name: z.string().describe('Name of the Angel (e.g., "Research Angel", "Coder Angel").'),
        mission: z.string().describe('Detailed mission description.'),
        capabilities: z.array(z.enum(['web_search', 'browser', 'financial_metrics', 'read_filings', 'skill', 'fs_read', 'remember_fact', 'recall_memories'])).describe('Tools the Angel needs access to.'),
        iterations: z.number().optional().default(10).describe('Max iterations (default: 10).'),
    });

    async _call(arg: { name: string, mission: string, capabilities: string[], iterations: number }): Promise<string> {
        console.log(`\n👼 Dispatching Angel: ${arg.name} for mission: "${arg.mission.slice(0, 50)}..."`);

        try {
            // 1. Configure Tools
            // We reuse getToolRegistry but filter by capabilities
            // Note: We avoid giving Angels "openclaw" system access (fs_write/shell) unless explicitly safe
            const allTools = getToolRegistry('gemini-2.0-flash'); // Model doesn't matter much for registry lookup
            const angelTools = allTools
                .filter(t => arg.capabilities.includes(t.name as any))
                .map(t => t.tool);

            console.log(`👼 [${arg.name}] Configured with ${angelTools.length} tools: ${angelTools.map(t => t.name).join(', ')}`);

            if (angelTools.length === 0 && arg.capabilities.length > 0) {
                return `Error: Requested capabilities [${arg.capabilities.join(', ')}] not found or unavailable.`;
            }

            // 2. Create Agent
            // Constructs a system prompt
            const systemPrompt = `You are ${arg.name}, a specialized Angel of the Jubilee System.
Your mission: ${arg.mission}

CRITICAL INSTRUCTIONS:
1. FOCUS: Do not deviate from the mission.
2. REPORT: specific, actionable findings.
3. COMPLETION: When finished, provide a final summary starting with "MISSION COMPLETE:".

You have access to: ${arg.capabilities.join(', ')}.`;

            const config: AgentConfig = {
                model: 'gemini-2.0-flash',
                systemPrompt,
                tools: angelTools,
            };

            const agent = Agent.create(config);
            const history = new InMemoryChatHistory();

            // 3. Execution
            // We run the agent loop.
            // Since Agent.run is a generator, we need to consume it.
            let finalAnswer = '';
            for await (const event of agent.run(arg.mission, history)) {
                if (event.type === 'done') {
                    finalAnswer = event.answer;
                }
                // We could log thinking steps here if we want verbose output
                if (event.type === 'thinking') {
                    console.log(`[${arg.name}] Thinking: ${event.message}`);
                }
            }

            return `👼 [${arg.name}] Report:\n${finalAnswer}`;

        } catch (error) {
            console.error(`Angel ${arg.name} failed:`, error);
            return `Angel execution failed: ${error}`;
        }
    }
}
