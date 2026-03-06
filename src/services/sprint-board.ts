/**
 * Sprint Board — Concurrent angel orchestration engine.
 *
 * Dispatches multiple angels simultaneously with configurable parallelism,
 * budget tracking, and real-time event streaming. Inspired by Paperclip's
 * orchestration patterns, adapted for Jubilee's angel architecture.
 *
 * Usage:
 *   const board = new SprintBoard();
 *   const sprint = board.createSprint('Protocol Audit', [
 *       { angel: 'ContractAngel', goal: 'Audit the vault contract' },
 *       { angel: 'DocsAngel', goal: 'Update the README' },
 *   ], { concurrency: 2, budgetUsd: 5.00 });
 *   for await (const event of board.runSprint(sprint.id)) {
 *       console.log(event);
 *   }
 */

import { randomUUID } from 'node:crypto';
import type { Sprint, SprintTask, SprintEvent, SprintStatus } from './sprint-board.types.js';
import { BudgetTracker } from './budget.js';
import { getAdapter } from '../adapters/index.js';
import { getAngelRole } from '../config/angel-roles.js';
import { DEFAULT_SYSTEM_PROMPT } from '../agent/prompts.js';

// ============================================================================
// Sprint Board
// ============================================================================

export interface CreateSprintOptions {
    concurrency?: number;
    budgetUsd?: number;
}

export interface SprintTaskInput {
    angel: string;
    goal: string;
    adapter?: string;
    model?: string;
}

export class SprintBoard {
    private sprints: Map<string, Sprint> = new Map();
    private budgets: Map<string, BudgetTracker> = new Map();

    /**
     * Create a new sprint with tasks.
     */
    createSprint(name: string, tasks: SprintTaskInput[], options: CreateSprintOptions = {}): Sprint {
        const sprintId = randomUUID().slice(0, 8);

        const sprintTasks: SprintTask[] = tasks.map((t) => ({
            id: randomUUID().slice(0, 8),
            angel: t.angel,
            goal: t.goal,
            status: 'queued' as const,
            adapter: t.adapter,
            model: t.model,
        }));

        const sprint: Sprint = {
            id: sprintId,
            name,
            tasks: sprintTasks,
            status: 'planning',
            createdAt: new Date(),
            concurrency: options.concurrency || 2,
            budgetUsd: options.budgetUsd,
        };

        this.sprints.set(sprintId, sprint);

        if (options.budgetUsd) {
            this.budgets.set(sprintId, new BudgetTracker(options.budgetUsd));
        } else {
            this.budgets.set(sprintId, new BudgetTracker());
        }

        return sprint;
    }

    /**
     * Run a sprint, dispatching angels with controlled concurrency.
     * Yields SprintEvents for real-time progress tracking.
     */
    async *runSprint(sprintId: string): AsyncGenerator<SprintEvent> {
        const sprint = this.sprints.get(sprintId);
        if (!sprint) throw new Error(`Sprint ${sprintId} not found`);

        const budget = this.budgets.get(sprintId)!;

        // Mark sprint as running
        sprint.status = 'running';
        sprint.startedAt = new Date();

        yield {
            type: 'sprint_started',
            sprintId,
            totalTasks: sprint.tasks.length,
        };

        // Queue management
        const queue = [...sprint.tasks];
        const running: Set<string> = new Set();
        let completedCount = 0;
        let failedCount = 0;

        // Process tasks with controlled concurrency
        while (queue.length > 0 || running.size > 0) {
            // Fill up to concurrency limit
            while (queue.length > 0 && running.size < sprint.concurrency) {
                // Budget check before starting new task
                if (budget.isOverBudget()) {
                    // Cancel remaining tasks
                    for (const task of queue) {
                        task.status = 'cancelled';
                    }
                    yield {
                        type: 'budget_warning',
                        sprintId,
                        currentCostUsd: budget.getTotalCost(),
                        budgetUsd: sprint.budgetUsd || 0,
                        percentUsed: 100,
                    };
                    queue.length = 0;
                    break;
                }

                const task = queue.shift()!;
                running.add(task.id);
                task.status = 'active';
                task.startedAt = new Date();

                yield {
                    type: 'task_started',
                    sprintId,
                    taskId: task.id,
                    angel: task.angel,
                    goal: task.goal,
                };

                // Execute asynchronously (don't await — let concurrency work)
                this.executeTask(task, budget).then((result) => {
                    task.status = 'done';
                    task.completedAt = new Date();
                    task.result = result;
                    completedCount++;
                    running.delete(task.id);
                }).catch((error) => {
                    task.status = 'failed';
                    task.completedAt = new Date();
                    task.error = error.message;
                    failedCount++;
                    running.delete(task.id);
                });
            }

            // Wait for at least one task to complete
            if (running.size > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Yield events for recently completed/failed tasks
                for (const task of sprint.tasks) {
                    if (task.status === 'done' && task.result && !task._eventEmitted) {
                        task._eventEmitted = true;
                        yield {
                            type: 'task_completed',
                            sprintId,
                            taskId: task.id,
                            angel: task.angel,
                            result: task.result,
                        };

                        // Budget warning check
                        if (budget.isNearBudget() && sprint.budgetUsd) {
                            yield {
                                type: 'budget_warning',
                                sprintId,
                                currentCostUsd: budget.getTotalCost(),
                                budgetUsd: sprint.budgetUsd,
                                percentUsed: (budget.getTotalCost() / sprint.budgetUsd) * 100,
                            };
                        }
                    }
                    if (task.status === 'failed' && task.error && !task._eventEmitted) {
                        task._eventEmitted = true;
                        yield {
                            type: 'task_failed',
                            sprintId,
                            taskId: task.id,
                            angel: task.angel,
                            error: task.error,
                        };
                    }
                }
            }
        }

        // Sprint complete
        sprint.status = failedCount === sprint.tasks.length ? 'failed' : 'complete';
        sprint.completedAt = new Date();

        yield {
            type: 'sprint_completed',
            sprintId,
            totalTasks: sprint.tasks.length,
            completedTasks: completedCount,
            failedTasks: failedCount,
            totalCostUsd: budget.getTotalCost(),
            totalDurationMs: sprint.completedAt.getTime() - sprint.startedAt!.getTime(),
        };
    }

    /**
     * Execute a single sprint task using the appropriate adapter.
     */
    private async executeTask(task: SprintTask, budget: BudgetTracker) {
        const angelRole = getAngelRole(task.angel);
        const adapterType = task.adapter || 'gemini';
        const adapter = getAdapter(adapterType);

        const systemPrompt = angelRole?.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

        const result = await adapter.execute({
            prompt: task.goal,
            systemPrompt,
            model: task.model,
        });

        budget.track(task.angel, result);
        return result;
    }

    /**
     * Get a sprint by ID.
     */
    getSprint(sprintId: string): Sprint | undefined {
        return this.sprints.get(sprintId);
    }

    /**
     * Get budget summary for a sprint.
     */
    getBudgetSummary(sprintId: string) {
        return this.budgets.get(sprintId)?.getSummary();
    }

    /**
     * List all sprints.
     */
    listSprints(): Sprint[] {
        return Array.from(this.sprints.values());
    }

    /**
     * Cancel a running sprint.
     */
    cancelSprint(sprintId: string): void {
        const sprint = this.sprints.get(sprintId);
        if (!sprint) return;
        sprint.status = 'cancelled';
        for (const task of sprint.tasks) {
            if (task.status === 'queued') task.status = 'cancelled';
        }
    }
}
