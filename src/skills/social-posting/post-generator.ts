/**
 * Post Generator — Creates daily Scripture + metrics posts.
 *
 * Usage as a standalone script:
 *   bun run src/skills/social-posting/post-generator.ts
 *
 * Or invoked by the SocialAngel via the `skill` tool.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';

// ── Bible Verse ─────────────────────────────────────────────────────────────

interface DailyVerse {
    reference: string;
    text: string;
}

const VERSE_POOL = [
    'Proverbs 3:9-10', 'Proverbs 11:1', 'Proverbs 22:7', 'Proverbs 21:5',
    'Psalm 24:1', 'Psalm 37:21', 'Psalm 112:5', 'Psalm 15:5',
    'Isaiah 61:1-2', 'Isaiah 58:6',
    'Leviticus 25:10', 'Leviticus 25:23',
    'Matthew 25:14-15', 'Matthew 6:19-21',
    'Romans 13:8', 'Hebrews 13:5',
    'Deuteronomy 15:1-2', 'Luke 4:18-19',
];

function getTodayVerseRef(): string {
    const day = new Date().getDate();
    return VERSE_POOL[day % VERSE_POOL.length];
}

async function fetchVerse(reference: string): Promise<DailyVerse> {
    try {
        const encoded = encodeURIComponent(reference);
        const res = await fetch(`https://bible-api.com/${encoded}?translation=kjv`);
        if (!res.ok) throw new Error(`bible-api returned ${res.status}`);
        const data = await res.json() as { reference: string; text: string };
        return {
            reference: data.reference,
            text: data.text.trim().replace(/\n/g, ' '),
        };
    } catch (e) {
        logger.warn('Failed to fetch verse, using fallback:', e);
        return {
            reference: 'Leviticus 25:10',
            text: 'And ye shall hallow the fiftieth year, and proclaim liberty throughout all the land unto all the inhabitants thereof: it shall be a jubile unto you.',
        };
    }
}

// ── Metrics (placeholder — real data comes from MCP servers at runtime) ─────

interface ProtocolMetrics {
    tvl: string;
    jbtciApy: string;
    jusdiApy: string;
    jublPrice: string;
}

function getPlaceholderMetrics(): ProtocolMetrics {
    return {
        tvl: 'Coming soon',
        jbtciApy: 'Coming soon',
        jusdiApy: 'Coming soon',
        jublPrice: 'Coming soon',
    };
}

// ── Post Composition ────────────────────────────────────────────────────────

function composePost(verse: DailyVerse, metrics: ProtocolMetrics): { short: string; long: string } {
    const short = [
        `📖 "${verse.text.slice(0, 120)}..."`,
        `— ${verse.reference} (KJV)`,
        '',
        `📊 TVL: ${metrics.tvl} | jBTCi: ${metrics.jbtciApy} | jUSDi: ${metrics.jusdiApy}`,
        '',
        '#Jubilee #DeFi #BuildInPublic',
    ].join('\n');

    const long = [
        `📖 **Daily Word**`,
        '',
        `> "${verse.text}"`,
        `> — ${verse.reference} (KJV)`,
        '',
        `📊 **Protocol Pulse**`,
        `• TVL: ${metrics.tvl}`,
        `• jBTCi APY: ${metrics.jbtciApy}`,
        `• jUSDi APY: ${metrics.jusdiApy}`,
        `• JUBL: ${metrics.jublPrice}`,
        '',
        `🔨 **Builder Note**`,
        `Building the infrastructure for faith-based decentralized finance. All glory to Jesus.`,
        '',
        '#Jubilee #DeFi #ChristianFinance #BuildInPublic',
    ].join('\n');

    return { short, long };
}

// ── File Output ─────────────────────────────────────────────────────────────

function saveDraft(post: { short: string; long: string }, verse: DailyVerse, metrics: ProtocolMetrics): string {
    const date = new Date().toISOString().split('T')[0];
    const draftsDir = join(process.cwd(), 'drafts', 'daily-posts');

    if (!existsSync(draftsDir)) {
        mkdirSync(draftsDir, { recursive: true });
    }

    const filePath = join(draftsDir, `${date}.md`);
    const content = [
        `---`,
        `date: ${date}`,
        `verse: ${verse.reference}`,
        `generated: ${new Date().toISOString()}`,
        `---`,
        '',
        '## X / Twitter (short)',
        '',
        post.short,
        '',
        '---',
        '',
        '## Farcaster / Lens (long)',
        '',
        post.long,
    ].join('\n');

    writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function generateDailyPost(): Promise<string> {
    const verseRef = getTodayVerseRef();
    logger.info(`📱 Generating daily post with verse: ${verseRef}`);

    const verse = await fetchVerse(verseRef);
    const metrics = getPlaceholderMetrics();
    const post = composePost(verse, metrics);
    const filePath = saveDraft(post, verse, metrics);

    logger.info(`📱 Daily post saved to: ${filePath}`);
    return filePath;
}

// Run standalone
if (import.meta.main) {
    generateDailyPost()
        .then(path => console.log(`✅ Post generated: ${path}`))
        .catch(e => console.error('❌ Failed:', e));
}
