
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Agent, AgentConfig } from '../agent/agent.js'; // Assuming simple Agent exists or need TriuneAgent sub-runner?
import { getChatModel } from '../model/llm.js';
import { getToolsForRole, getToolRegistry } from './registry.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

/**
 * DispatchAngelTool ("The Lord of Hosts")
 * Allows the agent to dispatch a specialized sub-agent ("Angel") to perform a task.
 */
export class DispatchAngelTool extends StructuredTool {
    name = 'dispatch_angel';
    description = 'Dispatch a specialized sub-agent ("Angel") to perform a complex task. Use this for parallel research, deep-dive coding, or verification steps that require focus. The Angel runs autonomously and returns a final report.';

    schema = z.object({
        name: z.string().describe('Name of the Angel (e.g., "Research Angel", "Coder Angel").'),
        mission: z.string().describe('Detailed mission description for the Angel.'),
        capabilities: z.array(z.enum(['web_search', 'browser', 'financial_metrics', 'read_filings', 'skill', 'fs_read', 'remember_fact', 'recall_memories'])).describe('Tools the Angel needs access to.'),
        iterations: z.number().optional().default(10).describe('Max iterations for the Angel (default: 10).'),
    });

    async _call(arg: { name: string, mission: string, capabilities: string[], iterations: number }): Promise<string> {
        console.log(`\n👼 Dispatching Angel: ${arg.name} for mission: "${arg.mission.slice(0, 50)}..."`);

        try {
            // 1. Configure Tools
            // We reuse getToolRegistry but filter by capabilities
            // Note: We avoid giving Angels "openclaw" system access (fs_write/shell) unless explicitly safe?
            // User requested "Hosts Mode", implying powerful delegation.
            // For safety, let's stick to read-only tools + skill execution for V1.
            const allTools = getToolRegistry('gemini-2.0-flash'); // Model doesn't matter much for registry lookup
            const angelTools = allTools
                .filter(t => arg.capabilities.includes(t.name as any))
                .map(t => t.tool);

            console.log(`👼 [${arg.name}] Configured with ${angelTools.length} tools: ${angelTools.map(t => t.name).join(', ')}`);

            if (angelTools.length === 0 && arg.capabilities.length > 0) {
                return `Error: Requested capabilities [${arg.capabilities.join(', ')}] not found or unavailable.`;
            }

            // 2. Create Agent
            // We use a base Agent, not TriuneAgent (too heavy/recursive).
            // Need to verify if Agent class supports this.
            // Checking src/agent/agent.ts content first is wise, but let's assume standard ReAct pattern.

            // Constructs a system prompt
            const systemPrompt = `You are ${arg.name}, a specialized sub-agent of the Jubilee System.
Your mission: ${arg.mission}

CRITICAL INSTRUCTIONS:
1. FOCUS: Do not deviate from the mission.
2. REPORT: specific, actionable findings.
3. COMPLETION: When finished, provide a final summary starting with "MISSION COMPLETE:".

You have access to: ${arg.capabilities.join(', ')}.`;

            const config: AgentConfig = {
                model: 'gemini-2.0-flash', // Default to efficient model
                systemPrompt,
                tools: angelTools,
                verbose: true
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
