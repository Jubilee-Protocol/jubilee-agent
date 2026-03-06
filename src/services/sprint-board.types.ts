/**
 * Sprint Board Types — Concurrent angel orchestration.
 *
 * Defines the data structures for running multiple angels simultaneously
 * with shared goals, conflict prevention, and aggregated results.
 */

import type { AdapterExecutionResult } from '../adapters/adapter.types.js';

// ============================================================================
// Sprint Task
// ============================================================================

export type TaskStatus = 'queued' | 'active' | 'done' | 'failed' | 'cancelled';

export interface SprintTask {
    /** Unique task identifier */
    id: string;
    /** AngelRole key (e.g. "ContractAngel") */
    angel: string;
    /** Goal / prompt for this angel */
    goal: string;
    /** Current task status */
    status: TaskStatus;
    /** Adapter override (e.g. "claude" to force Claude for this angel) */
    adapter?: string;
    /** Model override within the adapter */
    model?: string;
    /** When the task started executing */
    startedAt?: Date;
    /** When the task completed */
    completedAt?: Date;
    /** Execution result (populated on completion) */
    result?: AdapterExecutionResult;
    /** Error message if failed */
    error?: string;
    /** Internal: whether the completion event has been emitted (not serialized) */
    _eventEmitted?: boolean;
}

// ============================================================================
// Sprint
// ============================================================================

export type SprintStatus = 'planning' | 'running' | 'complete' | 'failed' | 'cancelled';

export interface Sprint {
    /** Unique sprint identifier */
    id: string;
    /** Sprint name (e.g. "Protocol Audit Q1") */
    name: string;
    /** All tasks in this sprint */
    tasks: SprintTask[];
    /** Current sprint status */
    status: SprintStatus;
    /** When the sprint was created */
    createdAt: Date;
    /** When the sprint started running */
    startedAt?: Date;
    /** When the sprint completed */
    completedAt?: Date;
    /** Max concurrent angels */
    concurrency: number;
    /** Total cost budget in USD (optional) */
    budgetUsd?: number;
}

// ============================================================================
// Sprint Events (for real-time progress tracking)
// ============================================================================

export interface SprintStartedEvent {
    type: 'sprint_started';
    sprintId: string;
    totalTasks: number;
}

export interface TaskStartedEvent {
    type: 'task_started';
    sprintId: string;
    taskId: string;
    angel: string;
    goal: string;
}

export interface TaskProgressEvent {
    type: 'task_progress';
    sprintId: string;
    taskId: string;
    angel: string;
    message: string;
}

export interface TaskCompletedEvent {
    type: 'task_completed';
    sprintId: string;
    taskId: string;
    angel: string;
    result: AdapterExecutionResult;
}

export interface TaskFailedEvent {
    type: 'task_failed';
    sprintId: string;
    taskId: string;
    angel: string;
    error: string;
}

export interface BudgetWarningEvent {
    type: 'budget_warning';
    sprintId: string;
    currentCostUsd: number;
    budgetUsd: number;
    percentUsed: number;
}

export interface SprintCompletedEvent {
    type: 'sprint_completed';
    sprintId: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalCostUsd: number;
    totalDurationMs: number;
}

export type SprintEvent =
    | SprintStartedEvent
    | TaskStartedEvent
    | TaskProgressEvent
    | TaskCompletedEvent
    | TaskFailedEvent
    | BudgetWarningEvent
    | SprintCompletedEvent;
