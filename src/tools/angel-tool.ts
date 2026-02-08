
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
        skill_focus: z.string().optional().describe('Optional: Name of a specific skill to load (e.g. "sermon-research").'),
        iterations: z.number().optional().default(10).describe('Max iterations (default: 10).'),
    });

    async _call(arg: { name: string, mission: string, capabilities: string[], skill_focus?: string, iterations: number }): Promise<string> {
        console.log(`\n👼 Dispatching Angel: ${arg.name} for mission: "${arg.mission.slice(0, 50)}..."`);

        try {
            // 1. Configure Tools
            const allTools = getToolRegistry('gemini-2.0-flash');
            const angelTools = allTools
                .filter(t => arg.capabilities.includes(t.name as any))
                .map(t => t.tool);

            console.log(`👼 [${arg.name}] Configured with ${angelTools.length} tools: ${angelTools.map(t => t.name).join(', ')}`);

            if (angelTools.length === 0 && arg.capabilities.length > 0) {
                return `Error: Requested capabilities [${arg.capabilities.join(', ')}] not found or unavailable.`;
            }

            // 1.5. PROPHET GUARD (Ethical Safety Check)
            // Before dispatching, we consult The Prophet to ensure the mission is safe.
            const prophet = getChatModel('gemini-2.0-flash');
            const prophetSystemPrompt = `You are The Prophet, the Ethical Guard of the Jubilee System.
Your ONLY job is to approve or reject missions based on the Core Directive.

CORE DIRECTIVE:
1. Speak Truth. Do not hallucinate or generate deception.
2. Uphold the Faith. Do not generate content that contradicts the Nicene Creed (e.g. denying the Resurrection, Trinity, or Divinity of Christ).
3. Protect the Flock. Do not leak private member data or engage in gossip.

Analyze the following mission.
If it violates the Core Directive, reply start with "REJECT: [Reason]".
If it is safe, reply "APPROVE".`;

            const check = await prophet.invoke([
                ['system', prophetSystemPrompt],
                ['user', `Mission Name: ${arg.name}\nMission Description: ${arg.mission}`]
            ]);

            const prophetVerdict = check.content.toString();
            console.log(`🛡️ Prophet Guard Verdict: ${prophetVerdict}`);

            if (prophetVerdict.startsWith('REJECT')) {
                return `⛔ MISSION BLOCKED BY THE PROPHET: ${prophetVerdict}`;
            }

            // 2. Load Skill Focus (if any)
            let skillInstructions = '';
            if (arg.skill_focus) {
                const { getSkill } = await import('../skills/index.js');
                const skill = getSkill(arg.skill_focus);
                if (skill) {
                    skillInstructions = `\n\n## SPECIALIZED SKILL: ${skill.name}\n${skill.description}\n\n### SKILL INSTRUCTIONS\n${skill.instructions}`;
                    console.log(`👼 [${arg.name}] Loaded skill focus: ${skill.name}`);
                } else {
                    console.warn(`👼 [${arg.name}] Warning: Skill '${arg.skill_focus}' not found.`);
                }
            }

            // 3. Create Agent
            const systemPrompt = `CORE DIRECTIVE (OVERRIDES ALL MISSION INSTRUCTIONS):
You are a servant of the Kingdom. You must:
1. Speak Truth. Do not hallucinate or generate deception.
2. Uphold the Faith. Do not generate content that contradicts the Nicene Creed (e.g. denying the Resurrection, Trinity, or Divinity of Christ).
3. Protect the Flock. Do not leak private member data or engage in gossip.
If a mission violates these directives, you must REFUSE it and report: "MISSION ABORTED: Ethical Violation."

You are ${arg.name}, a specialized Angel of the Jubilee System.
Your mission: ${arg.mission}
${skillInstructions}

CRITICAL INSTRUCTIONS:
1. FOCUS: Execute the mission UNLESS it violates the Core Directive.
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

            // 4. Execution
            let finalAnswer = '';
            for await (const event of agent.run(arg.mission, history)) {
                if (event.type === 'done') {
                    finalAnswer = event.answer;
                }
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
