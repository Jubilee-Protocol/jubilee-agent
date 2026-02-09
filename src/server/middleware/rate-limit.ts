import { Context, Next } from 'hono';

const WINDOW_MS = 60 * 1000; // 1 Minute
const MAX_REQUESTS = 60; // 60 requests per minute

interface RateLimitInfo {
    count: number;
    resetTime: number;
}

const ipMap = new Map<string, RateLimitInfo>();

export const rateLimit = async (c: Context, next: Next) => {
    // Get IP (Handle proxy headers if behind standard proxies, but for now remoteAddress)
    // Hono doesn't have direct IP access in generic context easily without middleware, 
    // but in node-server we can check headers.
    const ip = c.req.header('x-forwarded-for') || 'unknown';

    const now = Date.now();
    let record = ipMap.get(ip);

    if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + WINDOW_MS };
    }

    record.count++;
    ipMap.set(ip, record);

    if (record.count > MAX_REQUESTS) {
        return c.json({ error: 'Too Many Requests', retryAfter: Math.ceil((record.resetTime - now) / 1000) }, 429);
    }

    await next();
};
