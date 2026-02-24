
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { db, isDbAvailable } from '../db/index.js';
import { protocolState } from '../db/schema.js';

/**
 * UpdateProtocolStateTool
 * Upsert entries in the protocol_state table.
 */
export class UpdateProtocolStateTool extends StructuredTool {
    name = 'update_protocol_state';
    description = 'Update or insert a protocol state entry. Use for tracking: product status, audit scores, TVL snapshots, roadmap milestones, governance decisions.';

    schema = z.object({
        category: z.enum(['product', 'audit', 'governance', 'roadmap', 'tvl', 'config']).describe('State category.'),
        key: z.string().describe('State key (e.g., "jUSDi_audit_score", "current_phase", "tvl_base").'),
        value: z.string().describe('State value (e.g., "92", "Q1_2026", "1250000").'),
        status: z.enum(['active', 'pending', 'completed', 'blocked']).optional().describe('Optional status.'),
        updatedBy: z.string().optional().default('system').describe('Who is making this update.'),
    });

    async _call(arg: { category: string, key: string, value: string, status?: string, updatedBy?: string }): Promise<string> {
        try {
            const available = await isDbAvailable();
            if (!available) {
                return 'Error: Database not connected. Set DATABASE_URL in .env and run db:push.';
            }

            // Check if entry exists
            const existing = await db.select()
                .from(protocolState)
                .where(and(
                    eq(protocolState.category, arg.category),
                    eq(protocolState.key, arg.key)
                ))
                .limit(1);

            if (existing.length > 0) {
                // Update
                await db.update(protocolState)
                    .set({
                        value: arg.value,
                        status: arg.status || existing[0].status,
                        updatedAt: new Date(),
                        updatedBy: arg.updatedBy || 'system',
                    })
                    .where(and(
                        eq(protocolState.category, arg.category),
                        eq(protocolState.key, arg.key)
                    ));
                return `✅ Updated: [${arg.category}] ${arg.key} = ${arg.value}`;
            } else {
                // Insert
                await db.insert(protocolState).values({
                    category: arg.category,
                    key: arg.key,
                    value: arg.value,
                    status: arg.status || 'active',
                    updatedBy: arg.updatedBy || 'system',
                });
                return `✅ Created: [${arg.category}] ${arg.key} = ${arg.value}`;
            }
        } catch (error: any) {
            logger.error('Failed to update protocol state:', error);
            return `Error updating protocol state: ${error.message}`;
        }
    }
}

/**
 * QueryProtocolStateTool
 * Query the current protocol state by category or key.
 */
export class QueryProtocolStateTool extends StructuredTool {
    name = 'query_protocol_state';
    description = 'Query current protocol state. Use to check: product statuses, audit scores, TVL, roadmap progress, governance decisions.';

    schema = z.object({
        category: z.string().optional().describe('Filter by category (product, audit, governance, roadmap, tvl, config).'),
        key: z.string().optional().describe('Filter by specific key.'),
    });

    async _call(arg: { category?: string, key?: string }): Promise<string> {
        try {
            const available = await isDbAvailable();
            if (!available) {
                return 'Error: Database not connected. Set DATABASE_URL in .env and run db:push.';
            }

            let query = db.select().from(protocolState);

            if (arg.category && arg.key) {
                query = query.where(and(
                    eq(protocolState.category, arg.category),
                    eq(protocolState.key, arg.key)
                )) as typeof query;
            } else if (arg.category) {
                query = query.where(eq(protocolState.category, arg.category)) as typeof query;
            } else if (arg.key) {
                query = query.where(eq(protocolState.key, arg.key)) as typeof query;
            }

            const results = await query;

            if (results.length === 0) {
                return arg.category || arg.key
                    ? `No protocol state entries found for ${arg.category ? `category: ${arg.category}` : ''}${arg.key ? ` key: ${arg.key}` : ''}`
                    : 'No protocol state entries found. Use update_protocol_state to add entries.';
            }

            // Format as table
            const lines = ['| Category | Key | Value | Status | Updated |', '|----------|-----|-------|--------|---------|'];
            for (const row of results) {
                const updated = row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—';
                lines.push(`| ${row.category} | ${row.key} | ${row.value} | ${row.status || '—'} | ${updated} |`);
            }

            return lines.join('\n');
        } catch (error: any) {
            logger.error('Failed to query protocol state:', error);
            return `Error querying protocol state: ${error.message}`;
        }
    }
}

