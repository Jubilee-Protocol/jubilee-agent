import { TriuneAgent } from '../agent/triune-agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { logService } from './log-service.js';
import { DoneEvent } from '../agent/types.js';

export class AgentService {
    private static instance: AgentService;
    private history: InMemoryChatHistory;
    private isRunning: boolean = false;

    private constructor() {
        this.history = new InMemoryChatHistory();
    }

    static getInstance(): AgentService {
        if (!AgentService.instance) {
            AgentService.instance = new AgentService();
        }
        return AgentService.instance;
    }

    async *chatStream(query: string): AsyncGenerator<any> {
        if (this.isRunning) {
            yield { type: 'error', error: "⚠️ Agent is busy with another task. Please wait." };
            return;
        }

        this.isRunning = true;
        logService.addLog('SYSTEM', `Received command: ${query}`);

        try {
            // Load Dynamic Settings
            const { SettingsService } = await import('./settings-service.js');
            const settings = await SettingsService.getInstance().getSettings();

            const agent = await TriuneAgent.create({
                model: settings.modelName,
                // provider: settings.modelProvider ?? 'openai', // AgentConfig doesn't use provider yet for logic, just model name prefix
                apiKeys: settings.apiKeys as Record<string, string>
            });
            const stream = agent.run(query, this.history);

            let finalAnswer = "";

            for await (const event of stream) {
                // 1. Log to internal system (so Epistle works)
                switch (event.type) {
                    case 'thinking':
                        logService.addLog('MIND', event.message);
                        break;
                    case 'tool_start':
                        logService.addLog('WILL', `Executing ${event.tool}...`);
                        break;
                    case 'tool_error':
                        logService.addLog('ERROR', `Tool Error: ${event.error}`);
                        break;
                    case 'done':
                        const done = event as DoneEvent;
                        finalAnswer = done.answer;
                        logService.addLog('PROPHET', `Task Complete: ${finalAnswer.slice(0, 50)}...`);

                        // Save to history
                        await this.history.saveUserQuery(query);
                        await this.history.saveAnswer(finalAnswer);
                        break;
                }

                // 2. Yield to caller (so Pulpit works)
                yield event;
            }

        } catch (error: any) {
            const msg = error.message || '';
            const isAuthError = (
                msg.includes('API_KEY') ||
                msg.includes('api_key') ||
                msg.includes('API key') ||
                msg.includes('authentication') ||
                msg.includes('Unauthorized') ||
                msg.includes('401') ||
                msg.includes('not found in environment')
            );
            if (isAuthError) {
                const userMsg = "My voice is faint. Please visit The Synod to grant me an API Key for the selected model.";
                logService.addLog('SYSTEM', userMsg);
                yield { type: 'error', error: userMsg };
            } else {
                logService.addLog('ERROR', `Agent Crash: ${msg}`);
                yield { type: 'error', error: msg };
            }
        } finally {
            this.isRunning = false;
        }
    }

    // Legacy non-streaming chat (wraps stream)
    async chat(query: string): Promise<string> {
        let finalAnswer = "";
        for await (const event of this.chatStream(query)) {
            if (event.type === 'done') {
                finalAnswer = event.answer;
            }
            if (event.type === 'error') {
                return `Error: ${event.error}`;
            }
        }
        return finalAnswer || "Task completed.";
    }
}
