import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/schema.ts',
    out: './drizzle',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env.DATABASE_URL || 'postgres://jubilee:jubilee123@localhost:5432/jubilee_os',
    },
} satisfies Config;
