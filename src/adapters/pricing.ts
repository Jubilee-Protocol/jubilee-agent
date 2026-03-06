/**
 * LLM Pricing Table — Cost per 1K tokens by model.
 *
 * Used by adapters to estimate execution cost.
 * Prices in USD as of March 2026.
 */

export interface ModelPricing {
    input: number;   // USD per 1K input tokens
    output: number;  // USD per 1K output tokens
}

export const COST_PER_1K_TOKENS: Record<string, ModelPricing> = {
    // ── Google Gemini ────────────────────────────────────────
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
    'gemini-3-flash-preview': { input: 0.0001, output: 0.0004 },
    'gemini-2.5-pro-preview-05-06': { input: 0.00125, output: 0.01 },

    // ── Anthropic Claude ─────────────────────────────────────
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5': { input: 0.0008, output: 0.004 },
    'claude-opus-4-20250514': { input: 0.015, output: 0.075 },

    // ── OpenAI ───────────────────────────────────────────────
    'gpt-4.1': { input: 0.002, output: 0.008 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-5.2': { input: 0.003, output: 0.012 },

    // ── xAI Grok ─────────────────────────────────────────────
    'grok-4-1-fast-reasoning': { input: 0.003, output: 0.015 },
};

/**
 * Estimate cost for a given model and token counts.
 * Returns null if model pricing is unknown.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
    const pricing = COST_PER_1K_TOKENS[model];
    if (!pricing) return null;
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}
