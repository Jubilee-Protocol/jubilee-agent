import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Connection String from Env
const connectionString = process.env.DATABASE_URL || 'postgres://jubilee:jubilee123@localhost:5432/jubilee_os';

// Configure Connection Pool
const pool = new Pool({
    connectionString,
});

// Initialize Drizzle
export const db = drizzle(pool, { schema });

// Graceful Shutdown
export const closeDb = async () => {
    await pool.end();
};
