
import { Agent } from './agent.js';
import { buildMindPrompt, buildProphetPrompt, buildWillPrompt } from './prompts.js';
import type { AgentConfig, AgentEvent, DoneEvent } from './types.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { getToolsForRole } from '../tools/registry.js';
import { AIMessage } from '@langchain/core/messages';

/**
 * Jubilee Triune Agent.
 * Orchestrates "The Mind" and "The Prophet" in parallel, then "The Will" to execute.
 */
export class TriuneAgent {
    private readonly model: string;
    private readonly config: AgentConfig;

    private constructor(config: AgentConfig) {
        this.model = config.model ?? 'gpt-5.2';
        this.config = config;
    }

    static create(config: AgentConfig = {}): TriuneAgent {
        return new TriuneAgent(config);
    }

    async *run(query: string, history: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
        const startTime = Date.now();
        let totalIterations = 0;

        // --- PHASE 1: PARALLEL EXECUTION (MIND & PROPHET) ---
        yield { type: 'thinking', message: 'Summoning The Mind and The Prophet...' };

        const mindPromise = this.runSubAgent('The Mind', buildMindPrompt(this.model), query, history, 'mind');
        const prophetPromise = this.runSubAgent('The Prophet', buildProphetPrompt(this.model), query, history, 'prophet');

        // We need to yield events from both as they happen. 
        // Since generators aren't easily merged in strictly chronological order without a helper,
        // we'll use a Promise.all approach but capture the FINAL outputs for the next stage.
        // To show "liveness", we can't easily interleave their streams in a simple for-loop.
        // However, for the CLI, we essentially want to see them working.
        // A simple approach: Run them, and buffer their events, or just let them run and we await the results.
        //
        // OPTIMIZATION: To "feel" fast, we really want to see output. 
        // But interleaving two streams of "Thinking..." "Tool call..." in one CLI view might be confusing.
        // Improved UX: We will run them in parallel but purely await their results for the final synthesis,
        // possibly emitting a "Working in parallel..." message.
        //
        // WAIT! The user wants it "lightning fast". Real parallel execution.
        // The CLI output might get messy if we just dump both.
        // Let's modify the UX slightly: We'll yield a special event saying we are running parallel analysis.

        // We will race/all them. But we need their full output logs? No, just their final answer.

        yield { type: 'thinking', message: 'The Mind and The Prophet are analyzing in parallel...' };

        const [mindResult, prophetResult] = await Promise.all([
            mindPromise,
            prophetPromise
        ]);

        totalIterations += mindResult.iterations + prophetResult.iterations;

        // --- PHASE 2: SYNTHESIS (THE WILL) ---
        yield { type: 'thinking', message: 'The Will is synthesizing the reports...' };

        // We should modify Agent.ts to accept an optional systemPrompt override, OR 
        // we can just instantiate standard Agent but with a "custom" sub-class that overrides properties.
        // Actually, `Agent` class has a private constructor but `create` takes config.
        // Let's modify Agent.ts to allow passing systemPrompt in config or a new factory method?
        //
        // Workaround without modifying Agent.ts too much:
        // We can instantiate the Agent via a helper that allows injecting prompt.
        //
        // Better yet: modifying Agent.create to accept systemPrompt.

        // Wait, I can't modify Agent.create signature easily without breaking other things?
        // Actually, I can just create a `CustomAgent` that extends Agent or just manually constructs it?
        // `Agent` constructor is private.
        //
        // I will refactor `Agent.create` in `agent.ts` to accept an optional systemPrompt.

        // For now assuming I will make that change.
        const willPrompt = buildWillPrompt(this.model, mindResult.answer, prophetResult.answer);

        // Create The Will agent
        // We treat the "query" for the Will as the original query decision
        const willAgentInstance = Agent.create({
            ...this.config,
            systemPrompt: willPrompt,
            tools: getToolsForRole('will', this.model)
        });

        const willStream = willAgentInstance.run(query, history);

        const verses = [
            "Trust in the LORD with all your heart, and do not lean on your own understanding. - Proverbs 3:5",
            "The blessing of the LORD makes rich, and He adds no sorrow with it. - Proverbs 10:22",
            "He who walks with wise men will be wise, but the companion of fools will be destroyed. - Proverbs 13:20",
            "Whatever you do, work heartily, as for the Lord and not for men. - Colossians 3:23",
            "For what does it profit a man to gain the whole world and forfeit his soul? - Mark 8:36"
        ];
        const randomVerse = verses[Math.floor(Math.random() * verses.length)];

        for await (const event of willStream) {
            if (event.type === 'done') {
                totalIterations += event.iterations;
                // Adjust total time to be from the very start
                // Append the verse to the answer
                const originalAnswer = (event as DoneEvent).answer;
                const newAnswer = `${originalAnswer}\n\n> *"${randomVerse}"*`;

                yield {
                    ...event,
                    answer: newAnswer,
                    totalTime: Date.now() - startTime
                } as DoneEvent;
            } else {
                yield event;
            }
        }
    }

    /**
     * Helper to run a sub-agent to completion and return its final answer.
     * Does NOT yield events to the main stream to avoid UI confusion in parallel mode,
     * UNLESS we strictly want to see "tool calls" flying by. 
     * Given the "lightning fast" request, seeing tools fly by is cool.
     * But checking 2 streams at once on one TTY is hard. 
     * We will silence the sub-agents for now and just report "Done".
     */
    private async runSubAgent(name: string, systemPrompt: string, query: string, history: InMemoryChatHistory, role: 'mind' | 'prophet'): Promise<{ answer: string, iterations: number }> {
        // Use the standard Agent.create with our new systemPrompt config option
        const agent = Agent.create({
            ...this.config,
            systemPrompt,
            tools: getToolsForRole(role, this.model)
        });

        // We use a blank history for sub-agents so they don't get confused by previous chat context 
        // meant for the "whole" agent, OR we pass it. 
        // For Mind/Prophet, they should focus on the CURRENT query mostly.
        const subHistory = new InMemoryChatHistory();

        const stream = agent.run(query, subHistory);

        let finalAnswer = '';
        let iterations = 0;

        for await (const event of stream) {
            if (event.type === 'done') {
                finalAnswer = (event as DoneEvent).answer;
                iterations = (event as DoneEvent).iterations;
            }
            // distinct sub-agent events could be wrapped and yielded if we wanted a complex UI
        }

        return { answer: finalAnswer, iterations };
    }
}
