/**
 * Ollama Adapter — Local self-hosted models for Jubilee OS.
 *
 * Connects to a local Ollama instance for offline/private model execution.
 * All costs are $0.00 since models run locally.
 */

import type { AgentAdapter, AdapterConfig, AdapterExecutionResult, AdapterModel, AdapterTestResult } from './adapter.types.js';
import { callLlm, getChatModel } from '../model/llm.js';

const DEFAULT_OLLAMA_MODEL = 'ollama:llama3.3';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export class OllamaAdapter implements AgentAdapter {
    readonly type = 'ollama';
    readonly name = 'Ollama (Local)';
    readonly defaultModel = DEFAULT_OLLAMA_MODEL;

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

        return {
            output,
            usage,
            costUsd: 0, // Local models are free
            model,
            provider: this.type,
            durationMs,
        };
    }

    async listModels(): Promise<AdapterModel[]> {
        try {
            const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || []).map((m: any) => ({
                id: `ollama:${m.name}`,
                name: m.name,
                contextWindow: m.details?.parameter_size ? undefined : undefined,
            }));
        } catch {
            return [];
        }
    }

    async testConnection(): Promise<AdapterTestResult> {
        try {
            const startTime = Date.now();
            const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (!res.ok) {
                return { ok: false, error: `Ollama returned ${res.status}` };
            }
            return { ok: true, latencyMs: Date.now() - startTime };
        } catch (e: any) {
            return { ok: false, error: `Cannot reach Ollama at ${OLLAMA_BASE_URL}: ${e.message}` };
        }
    }
}
