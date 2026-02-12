import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

// Connection String from Env
const connectionString = process.env.DATABASE_URL || 'postgres://jubilee:jubilee123@localhost:5432/jubilee_os';

// Lazy initialization — no connection until first use
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _dbAvailable: boolean | null = null;

function getPool(): Pool {
    if (!_pool) {
        _pool = new Pool({ connectionString });
        // Suppress unhandled pool errors (e.g. connection refused) from crashing the process
        _pool.on('error', (err) => {
            logger.debug(`DB pool background error: ${err.message}`);
            _dbAvailable = false;
        });
    }
    return _pool;
}

function getDb(): ReturnType<typeof drizzle> {
    if (!_db) {
        _db = drizzle(getPool(), { schema });
    }
    return _db;
}

/**
 * Check if Postgres is reachable. Result is cached after first check.
 * Call resetDbAvailability() to force a re-check.
 */
export async function isDbAvailable(): Promise<boolean> {
    if (_dbAvailable !== null) return _dbAvailable;
    try {
        const pool = getPool();
        const client = await pool.connect();
        client.release();
        _dbAvailable = true;
        logger.info('📦 Database connected successfully.');
    } catch (e) {
        _dbAvailable = false;
        logger.info('📦 Database not available — running in local-only mode.');
    }
    return _dbAvailable;
}

/** Force a re-check of DB availability on next call */
export function resetDbAvailability(): void {
    _dbAvailable = null;
}

/**
 * Proxy-based lazy `db` export.
 * Existing code can continue `import { db } from '../db/index.js'` unchanged.
 * The actual Postgres connection is deferred until the first property access.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
    get(_, prop) {
        return (getDb() as any)[prop];
    },
});

// Graceful Shutdown
export const closeDb = async () => {
    if (_pool) {
        await _pool.end();
        _pool = null;
        _db = null;
        _dbAvailable = null;
    }
};
