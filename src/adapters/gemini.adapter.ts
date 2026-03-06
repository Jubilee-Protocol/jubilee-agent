/**
 * Gemini Adapter — Default adapter for Jubilee OS.
 *
 * Wraps the existing callLlm() infrastructure from src/model/llm.ts
 * through the AgentAdapter interface. Zero behavior change for existing users.
 */

import type { AgentAdapter, AdapterConfig, AdapterExecutionResult, AdapterModel, AdapterTestResult } from './adapter.types.js';
import { callLlm, getChatModel, DEFAULT_MODEL } from '../model/llm.js';
import { COST_PER_1K_TOKENS } from './pricing.js';

export class GeminiAdapter implements AgentAdapter {
    readonly type = 'gemini';
    readonly name = 'Google Gemini';
    readonly defaultModel = DEFAULT_MODEL;

    async execute(config: AdapterConfig): Promise<AdapterExecutionResult> {
        const model = config.model || this.defaultModel;
        const startTime = Date.now();

        const result = await callLlm(config.prompt, {
            model,
            systemPrompt: config.systemPrompt,
            tools: config.tools,
            signal: config.signal,
            apiKeys: config.apiKeys,
        });

        const durationMs = Date.now() - startTime;
        const usage = result.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

        // Extract text output
        const output = typeof result.response === 'string'
            ? result.response
            : (result.response as any).content || '';

        // Estimate cost
        const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['gemini-2.0-flash'];
        const costUsd = pricing
            ? (usage.inputTokens / 1000) * pricing.input + (usage.outputTokens / 1000) * pricing.output
            : null;

        return {
            output,
            usage,
            costUsd,
            model,
            provider: this.type,
            durationMs,
        };
    }

    async listModels(): Promise<AdapterModel[]> {
        return [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1_000_000 },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', contextWindow: 1_000_000 },
            { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', contextWindow: 2_000_000 },
        ];
    }

    async testConnection(): Promise<AdapterTestResult> {
        try {
            const startTime = Date.now();
            const model = getChatModel(this.defaultModel, false);
            await model.invoke([{ role: 'user', content: 'ping' }]);
            return { ok: true, latencyMs: Date.now() - startTime };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    }
}
