import { db } from '../db/index.js';
import { logs } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface LogEntry {
    id: string; // We'll map DB id to string if needed, or stick to number? DB is number. Let's cast or adjust interface.
    // Actually, let's update interface to match DB reality or map it.
    // For now, let's keep compatibility with strict type checking.
    // DB returns number ID.
    type: string;
    message: string;
    timestamp: number;
}

class LogService {
    private static instance: LogService;

    // In-memory buffer for immediate UI feedback if DB lags + fallback
    private buffer: LogEntry[] = [];
    private readonly MAX_BUFFER = 50;

    private constructor() { }

    static getInstance(): LogService {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }
        return LogService.instance;
    }

    async addLog(type: string, message: string, metadata?: any) {
        const timestamp = Date.now();

        // 1. Add to buffer for speed
        const tempId = Math.random().toString(36).substring(7);
        this.buffer.unshift({ id: tempId, type, message, timestamp });
        if (this.buffer.length > this.MAX_BUFFER) this.buffer.pop();

        console.log(`[${type}] ${message}`);

        // 2. Persist to DB (Fire and Forget but log error)
        try {
            await db.insert(logs).values({
                type,
                message,
                metadata,
                timestamp: new Date(timestamp)
            });
        } catch (e) {
            console.error('Failed to persist log:', e);
        }
    }

    // Now async to fetch from DB? Or return buffer mixed with DB?
    // For V1 "Epistle", reading from efficient DB query is better than storing 1000 items in RAM.
    async getLogs(limit = 100): Promise<LogEntry[]> {
        try {
            const result = await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
            return result.map(r => ({
                id: r.id.toString(),
                type: r.type,
                message: r.message,
                timestamp: r.timestamp.getTime()
            }));
        } catch (e) {
            console.warn('DB Fetch failed, returning buffer:', e);
            return this.buffer;
        }
    }
}

export const logger = LogService.getInstance();
