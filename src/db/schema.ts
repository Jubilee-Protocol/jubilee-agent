import { pgTable, serial, text, timestamp, jsonb, vector } from 'drizzle-orm/pg-core';

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
