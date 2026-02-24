import { pgTable, serial, text, timestamp, jsonb, vector, integer } from 'drizzle-orm/pg-core';

// 1. Chronicles (The Epistle Logs)
export const logs = pgTable('logs', {
    id: serial('id').primaryKey(),
    type: text('type').notNull(), // PROPHET, MIND, WILL, ERROR, SYSTEM
    message: text('message').notNull(),
    metadata: jsonb('metadata'), // Extra context
    timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 2. Memories (Long-term Knowledge)
export const memories = pgTable('memories', {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    source: text('source'), // "user_chat", "web_search", "internal_reflection"
    embedding: vector('embedding', { dimensions: 1536 }), // OpenAI/Cohere standard
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Citizens (Users/Auth)
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    publicAddress: text('public_address').unique(), // Wallet Address
    role: text('role').default('citizen').notNull(), // citizen, steward, prophet (admin)
    lastSeen: timestamp('last_seen').defaultNow(),
});

// 4. Protocol State (Living protocol tracker — Builder Mode)
export const protocolState = pgTable('protocol_state', {
    id: serial('id').primaryKey(),
    category: text('category').notNull(),     // 'product', 'audit', 'governance', 'roadmap', 'tvl'
    key: text('key').notNull(),               // 'jUSDi_audit_score', 'phase', 'tvl_base'
    value: text('value').notNull(),           // '92', 'phase_2', '1250000'
    status: text('status'),                   // 'active', 'pending', 'completed', 'blocked'
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'),            // 'system', 'architect', 'angel'
    metadata: jsonb('metadata'),              // Extra context
});

// 5. Tasks (Sprint Tracker — persistent multi-session angel work)
export const tasks = pgTable('tasks', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),                      // "Build Jubilee Lending"
    description: text('description'),                    // Full spec / acceptance criteria
    status: text('status').notNull().default('planned'), // planned → active → review → complete → blocked
    priority: text('priority').default('medium'),        // low, medium, high, critical
    assignedRole: text('assigned_role'),                  // "ContractAngel", "BuilderAngel"
    parentTaskId: integer('parent_task_id'),              // For subtask hierarchy
    context: jsonb('context'),                           // Last 5 session summaries — auto-capped
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
});
