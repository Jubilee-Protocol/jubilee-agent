import { EventEmitter } from 'events';
import { db, isDbAvailable } from '../db/index.js';
import { logs } from '../db/schema.js';
import { desc } from 'drizzle-orm';
import { logger as cliLogger } from '../utils/logger.js';

export interface LogEntry {
    id: string;
    type: string;
    message: string;
    timestamp: number;
}

class LogService extends EventEmitter {
    private static instance: LogService;

    // In-memory buffer for immediate UI feedback if DB lags + fallback
    private buffer: LogEntry[] = [];
    private readonly MAX_BUFFER = 50;

    private constructor() {
        super();
    }

    static getInstance(): LogService {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }
        return LogService.instance;
    }

    async addLog(type: string, message: string, metadata?: any) {
        const timestamp = Date.now();
        const tempId = Math.random().toString(36).substring(7);
        const entry: LogEntry = { id: tempId, type, message, timestamp };

        // 1. Add to buffer for speed
        this.buffer.unshift(entry);
        if (this.buffer.length > this.MAX_BUFFER) this.buffer.pop();

        // 2. Emit event for SSE
        this.emit('log', entry);

        cliLogger.debug(`[${type}] ${message}`);

        // 3. Persist to DB if available (Fire and Forget)
        if (await isDbAvailable()) {
            try {
                await db.insert(logs).values({
                    type,
                    message,
                    metadata,
                    timestamp: new Date(timestamp)
                });
            } catch (e) {
                cliLogger.error('Failed to persist log:', e);
            }
        }
    }

    async getLogs(limit = 100): Promise<LogEntry[]> {
        if (!(await isDbAvailable())) {
            return this.buffer;
        }
        try {
            const result = await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
            return result.map(r => ({
                id: r.id.toString(),
                type: r.type,
                message: r.message,
                timestamp: r.timestamp.getTime()
            }));
        } catch (e) {
            cliLogger.warn('DB Fetch failed, returning buffer:', e);
            return this.buffer;
        }
    }
}

export const logService = LogService.getInstance();
