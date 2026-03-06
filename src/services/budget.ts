/**
 * Budget Tracker — Per-angel cost and token tracking.
 *
 * Tracks token usage and estimated cost across adapter executions.
 * Supports per-sprint and per-angel breakdowns with budget limits.
 */

import type { AdapterExecutionResult, AdapterUsage } from '../adapters/adapter.types.js';

// ============================================================================
// Types
// ============================================================================

export interface AngelCostEntry {
    angel: string;
    model: string;
    provider: string;
    costUsd: number;
    usage: AdapterUsage;
    timestamp: Date;
}

export interface BudgetSummary {
    /** Total cost across all angels */
    totalCostUsd: number;
    /** Total tokens across all angels */
    totalTokens: { input: number; output: number; total: number };
    /** Per-angel cost breakdown */
    perAngel: Record<string, {
        costUsd: number;
        tokens: { input: number; output: number };
        executions: number;
    }>;
    /** Per-provider cost breakdown */
    perProvider: Record<string, {
        costUsd: number;
        executions: number;
    }>;
    /** Budget limit (if set) */
    budgetUsd?: number;
    /** Whether budget has been exceeded */
    overBudget: boolean;
    /** Percentage of budget used */
    percentUsed: number;
}

// ============================================================================
// Budget Tracker
// ============================================================================

export class BudgetTracker {
    private entries: AngelCostEntry[] = [];
    private budgetUsd: number | undefined;

    constructor(budgetUsd?: number) {
        this.budgetUsd = budgetUsd;
    }

    /**
     * Track a completed execution's cost and usage.
     */
    track(angelKey: string, result: AdapterExecutionResult): void {
        this.entries.push({
            angel: angelKey,
            model: result.model,
            provider: result.provider,
            costUsd: result.costUsd || 0,
            usage: result.usage,
            timestamp: new Date(),
        });
    }

    /**
     * Get total cost so far.
     */
    getTotalCost(): number {
        return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
    }

    /**
     * Get cost for a specific angel.
     */
    getAngelCost(angelKey: string): number {
        return this.entries
            .filter(e => e.angel === angelKey)
            .reduce((sum, e) => sum + e.costUsd, 0);
    }

    /**
     * Check if budget has been exceeded.
     */
    isOverBudget(): boolean {
        if (this.budgetUsd === undefined) return false;
        return this.getTotalCost() >= this.budgetUsd;
    }

    /**
     * Check if budget is at or above a warning threshold (default 80%).
     */
    isNearBudget(threshold = 0.8): boolean {
        if (this.budgetUsd === undefined) return false;
        return this.getTotalCost() >= this.budgetUsd * threshold;
    }

    /**
     * Get a full budget summary.
     */
    getSummary(): BudgetSummary {
        const perAngel: BudgetSummary['perAngel'] = {};
        const perProvider: BudgetSummary['perProvider'] = {};
        let totalInput = 0;
        let totalOutput = 0;

        for (const entry of this.entries) {
            // Per-angel
            if (!perAngel[entry.angel]) {
                perAngel[entry.angel] = { costUsd: 0, tokens: { input: 0, output: 0 }, executions: 0 };
            }
            perAngel[entry.angel].costUsd += entry.costUsd;
            perAngel[entry.angel].tokens.input += entry.usage.inputTokens;
            perAngel[entry.angel].tokens.output += entry.usage.outputTokens;
            perAngel[entry.angel].executions++;

            // Per-provider
            if (!perProvider[entry.provider]) {
                perProvider[entry.provider] = { costUsd: 0, executions: 0 };
            }
            perProvider[entry.provider].costUsd += entry.costUsd;
            perProvider[entry.provider].executions++;

            totalInput += entry.usage.inputTokens;
            totalOutput += entry.usage.outputTokens;
        }

        const totalCostUsd = this.getTotalCost();

        return {
            totalCostUsd,
            totalTokens: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
            perAngel,
            perProvider,
            budgetUsd: this.budgetUsd,
            overBudget: this.isOverBudget(),
            percentUsed: this.budgetUsd ? (totalCostUsd / this.budgetUsd) * 100 : 0,
        };
    }

    /**
     * Reset tracking (e.g. for a new sprint).
     */
    reset(newBudget?: number): void {
        this.entries = [];
        if (newBudget !== undefined) this.budgetUsd = newBudget;
    }
}
