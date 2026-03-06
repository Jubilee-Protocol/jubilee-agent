/**
 * Adapter Registry — Resolves adapter instances by type.
 *
 * Central registry for all available LLM adapters. Used by the agent
 * to select the right backend based on config or CLI flags.
 *
 * Usage:
 *   import { getAdapter, listAdapters } from './adapters';
 *   const adapter = getAdapter('claude');
 *   const result = await adapter.execute({ prompt: 'Hello' });
 */

import type { AgentAdapter } from './adapter.types.js';
import { GeminiAdapter } from './gemini.adapter.js';
import { ClaudeAdapter } from './claude.adapter.js';
import { OllamaAdapter } from './ollama.adapter.js';

// Re-export types for convenience
export type { AgentAdapter, AdapterConfig, AdapterExecutionResult, AdapterModel, AdapterTestResult, AdapterUsage } from './adapter.types.js';
export { estimateCost, COST_PER_1K_TOKENS } from './pricing.js';

// ── Singleton adapter instances ──────────────────────────────────────────────

const adapters: Record<string, AgentAdapter> = {
    gemini: new GeminiAdapter(),
    claude: new ClaudeAdapter(),
    ollama: new OllamaAdapter(),
};

/**
 * Get an adapter by type. Falls back to Gemini (default) if unknown.
 */
export function getAdapter(type?: string): AgentAdapter {
    if (!type) return adapters.gemini;
    return adapters[type] || adapters.gemini;
}

/**
 * Get all registered adapters.
 */
export function listAdapters(): AgentAdapter[] {
    return Object.values(adapters);
}

/**
 * Register a custom adapter at runtime (e.g. from architect.json).
 */
export function registerAdapter(adapter: AgentAdapter): void {
    adapters[adapter.type] = adapter;
}

/**
 * Check connection status of all adapters.
 * Returns a map of adapter type → test result.
 */
export async function testAllAdapters(): Promise<Record<string, { ok: boolean; error?: string; latencyMs?: number }>> {
    const results: Record<string, { ok: boolean; error?: string; latencyMs?: number }> = {};
    await Promise.all(
        Object.entries(adapters).map(async ([type, adapter]) => {
            results[type] = await adapter.testConnection();
        })
    );
    return results;
}
