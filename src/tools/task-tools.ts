
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { db, isDbAvailable } from '../db/index.js';
import { tasks } from '../db/schema.js';

const MAX_CONTEXT_ENTRIES = 5; // Cap context to last 5 session summaries

/**
 * CreateTaskTool
 * Create a new task or subtask for sprint tracking.
 */
export class CreateTaskTool extends StructuredTool {
    name = 'create_task';
    description = 'Create a new task for the sprint board. Use for multi-session work like "Build Jubilee Lending" or "Audit jBTCi Oracle System". Supports subtasks via parent_task_id.';

    schema = z.object({
        title: z.string().describe('Task title (e.g., "Build Jubilee Lending LTV Module").'),
        description: z.string().optional().describe('Full spec, acceptance criteria, or requirements.'),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
        assignedRole: z.string().optional().describe('Angel role to assign (e.g., "ContractAngel", "BuilderAngel").'),
        parentTaskId: z.number().optional().describe('Parent task ID for subtasks.'),
    });

    async _call(arg: { title: string, description?: string, priority?: string, assignedRole?: string, parentTaskId?: number }): Promise<string> {
        try {
            const available = await isDbAvailable();
            if (!available) return 'Error: Database not connected.';

            const result = await db.insert(tasks).values({
                title: arg.title,
                description: arg.description,
                priority: arg.priority || 'medium',
                assignedRole: arg.assignedRole,
                parentTaskId: arg.parentTaskId,
                context: { sessions: [] },
            }).returning({ id: tasks.id });

            const taskId = result[0]?.id;
            return `✅ Task #${taskId} created: "${arg.title}" [${arg.priority}]${arg.assignedRole ? ` → ${arg.assignedRole}` : ''}`;
        } catch (error: any) {
            logger.error('Failed to create task:', error);
            return `Error creating task: ${error.message}`;
        }
    }
}

/**
 * UpdateTaskTool
 * Update task status, append to context, or reassign.
 */
export class UpdateTaskTool extends StructuredTool {
    name = 'update_task';
    description = 'Update a task: change status, append session context, reassign, or mark complete. Context is auto-capped to last 5 session summaries for LLM efficiency.';

    schema = z.object({
        taskId: z.number().describe('Task ID to update.'),
        status: z.enum(['planned', 'active', 'review', 'complete', 'blocked']).optional(),
        sessionSummary: z.string().optional().describe('Summary of work done this session. Appended to context (last 5 kept).'),
        assignedRole: z.string().optional().describe('Reassign to a different angel role.'),
        blockedReason: z.string().optional().describe('Why the task is blocked (sets status to "blocked").'),
    });

    async _call(arg: { taskId: number, status?: string, sessionSummary?: string, assignedRole?: string, blockedReason?: string }): Promise<string> {
        try {
            const available = await isDbAvailable();
            if (!available) return 'Error: Database not connected.';

            // Fetch current task
            const existing = await db.select().from(tasks).where(eq(tasks.id, arg.taskId)).limit(1);
            if (existing.length === 0) return `Error: Task #${arg.taskId} not found.`;

            const task = existing[0];
            const updates: any = { updatedAt: new Date() };

            // Status
            if (arg.blockedReason) {
                updates.status = 'blocked';
            } else if (arg.status) {
                updates.status = arg.status;
                if (arg.status === 'complete') {
                    updates.completedAt = new Date();
                }
            }

            // Role
            if (arg.assignedRole) {
                updates.assignedRole = arg.assignedRole;
            }

            // Context — append and cap at MAX_CONTEXT_ENTRIES
            if (arg.sessionSummary || arg.blockedReason) {
                const ctx = (task.context as any) || { sessions: [] };
                const sessions = Array.isArray(ctx.sessions) ? ctx.sessions : [];

                sessions.push({
                    timestamp: new Date().toISOString(),
                    summary: arg.blockedReason
                        ? `BLOCKED: ${arg.blockedReason}`
                        : arg.sessionSummary,
                });

                // Cap to last N entries
                while (sessions.length > MAX_CONTEXT_ENTRIES) {
                    sessions.shift();
                }

                updates.context = { sessions };
            }

            await db.update(tasks).set(updates).where(eq(tasks.id, arg.taskId));

            const status = updates.status || task.status;
            return `✅ Task #${arg.taskId} updated: status=${status}${arg.sessionSummary ? ' (context appended)' : ''}${arg.blockedReason ? ` — BLOCKED: ${arg.blockedReason}` : ''}`;
        } catch (error: any) {
            logger.error('Failed to update task:', error);
            return `Error updating task: ${error.message}`;
        }
    }
}

/**
 * QueryTasksTool
 * List tasks as a sprint board, filtered by status, role, or priority.
 */
export class QueryTasksTool extends StructuredTool {
    name = 'query_tasks';
    description = 'Query the sprint board. List tasks by status, role, or priority. Returns a formatted sprint board with task IDs, titles, status, and assigned roles.';

    schema = z.object({
        status: z.string().optional().describe('Filter by status (planned, active, review, complete, blocked).'),
        assignedRole: z.string().optional().describe('Filter by assigned angel role.'),
        includeComplete: z.boolean().optional().default(false).describe('Include completed tasks.'),
    });

    async _call(arg: { status?: string, assignedRole?: string, includeComplete?: boolean }): Promise<string> {
        try {
            const available = await isDbAvailable();
            if (!available) return 'Error: Database not connected.';

            let query = db.select().from(tasks);

            // Build conditions
            const conditions: any[] = [];
            if (arg.status) conditions.push(eq(tasks.status, arg.status));
            if (arg.assignedRole) conditions.push(eq(tasks.assignedRole, arg.assignedRole));
            if (!arg.includeComplete) conditions.push(eq(tasks.status, 'complete'));

            // Apply filters — if we're not including complete, we need to EXCLUDE it
            if (arg.status) {
                query = query.where(eq(tasks.status, arg.status)) as typeof query;
            } else if (!arg.includeComplete) {
                // Show all non-complete tasks by default
                const results = await db.select().from(tasks).orderBy(desc(tasks.updatedAt));
                const filtered = results.filter(t => t.status !== 'complete');
                return formatSprintBoard(filtered);
            }

            if (arg.assignedRole) {
                query = query.where(eq(tasks.assignedRole, arg.assignedRole)) as typeof query;
            }

            const results = await query.orderBy(desc(tasks.updatedAt));
            return formatSprintBoard(results);
        } catch (error: any) {
            logger.error('Failed to query tasks:', error);
            return `Error querying tasks: ${error.message}`;
        }
    }
}

function formatSprintBoard(taskList: any[]): string {
    if (taskList.length === 0) {
        return 'No tasks found. Use create_task to start a sprint.';
    }

    const statusEmoji: Record<string, string> = {
        planned: '📋', active: '🔨', review: '🔍', complete: '✅', blocked: '🚫',
    };
    const priorityEmoji: Record<string, string> = {
        low: '⬜', medium: '🟨', high: '🟧', critical: '🟥',
    };

    const lines = ['## Sprint Board\n'];

    // Group by status
    const groups: Record<string, any[]> = {};
    for (const t of taskList) {
        const status = t.status || 'planned';
        if (!groups[status]) groups[status] = [];
        groups[status].push(t);
    }

    const order = ['blocked', 'active', 'review', 'planned', 'complete'];
    for (const status of order) {
        const items = groups[status];
        if (!items || items.length === 0) continue;

        lines.push(`### ${statusEmoji[status] || '📋'} ${status.charAt(0).toUpperCase() + status.slice(1)} (${items.length})`);
        for (const t of items) {
            const prio = priorityEmoji[t.priority] || '⬜';
            const role = t.assignedRole ? ` → ${t.assignedRole}` : '';
            const parent = t.parentTaskId ? ` (subtask of #${t.parentTaskId})` : '';
            lines.push(`- ${prio} **#${t.id}** ${t.title}${role}${parent}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}
