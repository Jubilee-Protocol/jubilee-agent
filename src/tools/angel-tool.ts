
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Agent } from '../agent/agent.js';
import type { AgentConfig } from '../agent/types.js';
import { getChatModel } from '../model/llm.js';
import { getToolsForRole, getToolRegistry } from './registry.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { logger } from '../utils/logger.js';
import { getAngelRole, getAngelRoleNames } from '../config/angel-roles.js';
import { ConfigManager } from '../config/settings.js';

/**
 * DispatchAngelTool
 * Allows the agent to dispatch a specialized Angel ("Sub-Agent") to perform a task.
 * Supports both named role templates (from angel-roles.ts) and freeform custom dispatch.
 */
export class DispatchAngelTool extends StructuredTool {
    name = 'dispatch_angel';
    description = `Dispatch a specialized Angel to perform a complex task. Use a named role for protocol-specific missions, or specify custom capabilities for ad-hoc tasks. Available roles: ${getAngelRoleNames().join(', ')}`;

    schema = z.object({
        role: z.string().optional().describe(`Named angel role template (e.g., "ContractAngel", "ResearchAngel", "TreasuryAngel"). When provided, auto-fills name, capabilities, and mission context. Available: ${getAngelRoleNames().join(', ')}`),
        name: z.string().optional().describe('Custom name for the Angel (used when no role is specified). e.g., "Research Angel"'),
        mission: z.string().describe('Detailed mission description.'),
        capabilities: z.array(z.string()).optional().describe('Tools the Angel needs (used when no role is specified). e.g., ["web_search", "browser"]'),
        skill_focus: z.string().optional().describe('Optional: Name of a specific skill to load (e.g. "jubilee").'),
        iterations: z.number().optional().describe('Max iterations (default from role, or 10).'),
        task_id: z.number().optional().describe('Optional: Sprint task ID. If provided, loads previous session context and auto-saves results.'),
    });

    async _call(arg: { role?: string, name?: string, mission: string, capabilities?: string[], skill_focus?: string, iterations?: number, task_id?: number }): Promise<string> {
        const config = ConfigManager.getInstance().getConfig();

        // Resolve role template if provided
        let angelName = arg.name || 'Custom Angel';
        let capabilities = arg.capabilities || [];
        let maxIterations = arg.iterations || 10;
        let rolePrompt = '';
        let taskContext = '';

        // Load task context if task_id is provided
        if (arg.task_id) {
            try {
                const { db, isDbAvailable } = await import('../db/index.js');
                const { tasks } = await import('../db/schema.js');
                const { eq } = await import('drizzle-orm');
                const available = await isDbAvailable();
                if (available) {
                    const taskRows = await db.select().from(tasks).where(eq(tasks.id, arg.task_id)).limit(1);
                    if (taskRows.length > 0) {
                        const task = taskRows[0];
                        const ctx = task.context as any;
                        if (ctx?.sessions?.length > 0) {
                            taskContext = '\n\nPREVIOUS SESSION CONTEXT (resume from here):\n' +
                                ctx.sessions.map((s: any) => `[${s.timestamp}] ${s.summary}`).join('\n');
                        }
                        taskContext += `\n\nTASK: "${task.title}" — ${task.description || 'No description'}`;
                        // Set task to active
                        await db.update(tasks).set({ status: 'active', updatedAt: new Date() }).where(eq(tasks.id, arg.task_id));
                    }
                }
            } catch (e) {
                logger.warn('Failed to load task context:', e);
            }
        }

        if (arg.role) {
            const role = getAngelRole(arg.role);
            if (!role) {
                return `❌ Unknown angel role: "${arg.role}". Available roles: ${getAngelRoleNames().join(', ')}`;
            }

            // Mode gating
            if (role.requiredMode === 'builder' && !config.modes.builder) {
                return `⛔ ${arg.role} requires Builder mode. Enable it with: config.setMode('builder', true)`;
            }
            if (role.requiredMode === 'stewardship' && !config.modes.stewardship) {
                return `⛔ ${arg.role} requires Stewardship mode. Enable it with: config.setMode('stewardship', true)`;
            }

            angelName = role.name;
            capabilities = arg.capabilities || role.defaultCapabilities;
            maxIterations = arg.iterations || role.defaultIterations;
            rolePrompt = `\n\nROLE CONTEXT:\n${role.systemPromptOverride}\nDomain: ${role.domain}`;

            logger.info(`\n${role.emoji} Dispatching ${angelName} (${arg.role}) for mission: "${arg.mission.slice(0, 50)}..."`);
        } else {
            logger.info(`\n👼 Dispatching Angel: ${angelName} for mission: "${arg.mission.slice(0, 50)}..."`);
        }

        try {
            // 1. Configure Tools
            const allTools = getToolRegistry('gemini-2.0-flash');
            const angelTools = allTools
                .filter(t => capabilities.includes(t.name as any))
                .map(t => t.tool);

            logger.debug(`👼 [${angelName}] Configured with ${angelTools.length} tools: ${angelTools.map(t => t.name).join(', ')}`);

            if (angelTools.length === 0 && capabilities.length > 0) {
                return `Error: Requested capabilities [${capabilities.join(', ')}] not found or unavailable.`;
            }

            // 1.5. PROPHET GUARD (Ethical Safety Check)
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
                ['user', `Mission Name: ${angelName}\nMission Description: ${arg.mission}`]
            ]);

            const prophetVerdict = check.content.toString();
            logger.info(`🛡️ Prophet Guard Verdict: ${prophetVerdict}`);

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
                    logger.info(`👼 [${angelName}] Loaded skill focus: ${skill.name}`);
                } else {
                    logger.warn(`👼 [${angelName}] Warning: Skill '${arg.skill_focus}' not found.`);
                }
            }

            // 3. Create Agent
            const systemPrompt = `CORE DIRECTIVE (OVERRIDES ALL MISSION INSTRUCTIONS):
You are a servant of the Kingdom. You must:
1. Speak Truth. Do not hallucinate or generate deception.
2. Uphold the Faith. Do not generate content that contradicts the Nicene Creed (e.g. denying the Resurrection, Trinity, or Divinity of Christ).
3. Protect the Flock. Do not leak private member data or engage in gossip.
If a mission violates these directives, you must REFUSE it and report: "MISSION ABORTED: Ethical Violation."

You are ${angelName}, a specialized Angel of the Jubilee System.
Your mission: ${arg.mission}
${rolePrompt}
${skillInstructions}
${taskContext}

CRITICAL INSTRUCTIONS:
1. FOCUS: Execute the mission UNLESS it violates the Core Directive.
2. REPORT: specific, actionable findings.
3. COMPLETION: When finished, provide a final summary starting with "MISSION COMPLETE:".

You have access to: ${capabilities.join(', ')}.`;

            const agentConfig: AgentConfig = {
                model: 'gemini-2.0-flash',
                systemPrompt,
                tools: angelTools,
            };

            const agent = Agent.create(agentConfig);
            const history = new InMemoryChatHistory();

            // 4. Execution
            let finalAnswer = '';
            for await (const event of agent.run(arg.mission, history)) {
                if (event.type === 'done') {
                    finalAnswer = event.answer;
                }
                if (event.type === 'thinking') {
                    logger.debug(`[${angelName}] Thinking: ${event.message}`);
                }
            }

            const emoji = arg.role ? (getAngelRole(arg.role)?.emoji || '👼') : '👼';
            const report = `${emoji} [${angelName}] Report:\n${finalAnswer}`;

            // Auto-save results back to task
            if (arg.task_id) {
                try {
                    const { db, isDbAvailable } = await import('../db/index.js');
                    const { tasks } = await import('../db/schema.js');
                    const { eq } = await import('drizzle-orm');
                    const available = await isDbAvailable();
                    if (available) {
                        const taskRows = await db.select().from(tasks).where(eq(tasks.id, arg.task_id)).limit(1);
                        if (taskRows.length > 0) {
                            const task = taskRows[0];
                            const ctx = (task.context as any) || { sessions: [] };
                            const sessions = Array.isArray(ctx.sessions) ? ctx.sessions : [];
                            sessions.push({
                                timestamp: new Date().toISOString(),
                                summary: finalAnswer.slice(0, 500), // Cap summary length
                                angel: angelName,
                            });
                            // Cap at 5 sessions
                            while (sessions.length > 5) sessions.shift();
                            await db.update(tasks).set({
                                context: { sessions },
                                updatedAt: new Date(),
                            }).where(eq(tasks.id, arg.task_id));
                            logger.info(`📋 Task #${arg.task_id} context updated with ${angelName} results.`);
                        }
                    }
                } catch (e) {
                    logger.warn('Failed to save task context:', e);
                }
            }

            return report;

        } catch (error) {
            logger.error(`Angel ${angelName} failed:`, error);
            return `Angel execution failed: ${error}`;
        }
    }
}
