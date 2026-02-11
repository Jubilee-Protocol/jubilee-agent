/**
 * Centralized Logger for Jubilee OS
 * 
 * Replaces raw console.log/error/warn calls that pollute the Ink terminal UI.
 * Respects JUBILEE_LOG_LEVEL env var or --verbose CLI flag.
 * 
 * Levels: silent < error < warn < info < debug
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

type Subscriber = (entries: LogEntry[]) => void;

class Logger {
  private level: LogLevel;
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER = 100;
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    // Default to 'silent' — the Ink CLI should be clean.
    // Use JUBILEE_LOG_LEVEL=info or --verbose to see output.
    const envLevel = process.env.JUBILEE_LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    const hasVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    if (hasVerbose) {
      this.level = 'debug';
    } else if (envLevel && LEVEL_ORDER[envLevel] !== undefined) {
      this.level = envLevel;
    } else {
      this.level = 'silent';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] <= LEVEL_ORDER[this.level];
  }

  private addEntry(level: LogLevel, message: string): void {
    const entry: LogEntry = { level, message, timestamp: Date.now() };
    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer.shift();
    }
    // Notify subscribers (for debug panel UI)
    for (const sub of this.subscribers) {
      sub([...this.buffer]);
    }
  }

  /** Subscribe to log entries (for UI components like DebugPanel) */
  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    // Immediately send current buffer
    cb([...this.buffer]);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** Critical errors that indicate broken functionality */
  error(message: string, ...args: unknown[]): void {
    this.addEntry('error', message);
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /** Warnings — degraded functionality, security alerts */
  warn(message: string, ...args: unknown[]): void {
    this.addEntry('warn', message);
    if (this.shouldLog('warn')) {
      console.error(`[WARN] ${message}`, ...args);
    }
  }

  /** Informational — startup, connections, tool counts */
  info(message: string, ...args: unknown[]): void {
    this.addEntry('info', message);
    if (this.shouldLog('info')) {
      console.error(`[INFO] ${message}`, ...args);
    }
  }

  /** Debug — verbose details, arguments, step-by-step */
  debug(message: string, ...args: unknown[]): void {
    this.addEntry('debug', message);
    if (this.shouldLog('debug')) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }

  /** Get the current log level */
  getLevel(): LogLevel {
    return this.level;
  }

  /** Temporarily set log level (e.g. suppress during init) */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

/** Singleton logger instance */
export const logger = new Logger();

