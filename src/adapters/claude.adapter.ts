/**
 * Claude Adapter — Anthropic Claude backend for Jubilee OS.
 *
 * Uses the same callLlm() infrastructure (which already supports Claude
 * via @langchain/anthropic) but wraps it in the AgentAdapter interface
 * with Claude-specific pricing and model listing.
 */

import type { AgentAdapter, AdapterConfig, AdapterExecutionResult, AdapterModel, AdapterTestResult } from './adapter.types.js';
import { callLlm, getChatModel } from '../model/llm.js';
import { COST_PER_1K_TOKENS } from './pricing.js';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export class ClaudeAdapter implements AgentAdapter {
    readonly type = 'claude';
    readonly name = 'Anthropic Claude';
    readonly defaultModel = DEFAULT_CLAUDE_MODEL;

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

        const output = typeof result.response === 'string'
            ? result.response
            : (result.response as any).content || '';

        const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS[DEFAULT_CLAUDE_MODEL];
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
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200_000 },
            { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200_000 },
            { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200_000 },
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
