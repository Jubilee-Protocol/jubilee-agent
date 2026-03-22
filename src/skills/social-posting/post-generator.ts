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

/**
 * 365 curated scriptures — one for each day of the year.
 * Organized by theme: Jubilee/Liberty, Stewardship, Provision, Justice,
 * Faith, Kingdom Work, Wisdom, and Praise.
 */
const VERSE_POOL: string[] = [
    // ── Jubilee & Liberty (Jan 1–31) ────────────────────────────────────────
    'Leviticus 25:10', 'Leviticus 25:11', 'Leviticus 25:23', 'Leviticus 25:35',
    'Leviticus 25:38', 'Leviticus 25:42', 'Leviticus 25:55', 'Leviticus 27:24',
    'Isaiah 61:1', 'Isaiah 61:2', 'Isaiah 61:3', 'Isaiah 58:6',
    'Isaiah 58:7', 'Isaiah 58:10', 'Isaiah 58:11', 'Isaiah 58:12',
    'Luke 4:18', 'Luke 4:19', 'Deuteronomy 15:1', 'Deuteronomy 15:2',
    'Deuteronomy 15:4', 'Deuteronomy 15:7', 'Deuteronomy 15:8', 'Deuteronomy 15:10',
    'Deuteronomy 15:11', 'Numbers 36:4', 'Exodus 21:2', 'Exodus 23:10-11',
    'Nehemiah 10:31', 'Jeremiah 34:15', 'Jeremiah 34:17',

    // ── Stewardship & Faithfulness (Feb 1–28) ──────────────────────────────
    'Matthew 25:14-15', 'Matthew 25:21', 'Matthew 25:23', 'Matthew 25:29',
    'Luke 16:10', 'Luke 16:11', 'Luke 16:12', 'Luke 16:13',
    'Luke 12:42', 'Luke 12:48', 'Luke 19:17', 'Luke 19:26',
    '1 Corinthians 4:2', '1 Peter 4:10', 'Colossians 3:23', 'Colossians 3:24',
    'Genesis 2:15', 'Genesis 1:28', 'Psalm 24:1', 'Psalm 50:10',
    'Haggai 2:8', '1 Chronicles 29:14', '1 Chronicles 29:11', '1 Chronicles 29:12',
    'Romans 14:12', '2 Corinthians 5:10', 'Titus 1:7', 'Matthew 24:45',

    // ── Provision & Trust (Mar 1–31) ────────────────────────────────────────
    'Philippians 4:19', 'Philippians 4:13', 'Matthew 6:25', 'Matthew 6:26',
    'Matthew 6:31', 'Matthew 6:32', 'Matthew 6:33', 'Matthew 6:34',
    'Psalm 23:1', 'Psalm 37:25', 'Psalm 34:10', 'Psalm 84:11',
    'Psalm 145:15', 'Psalm 145:16', 'Psalm 107:9', 'Psalm 132:15',
    'Isaiah 41:10', 'Isaiah 41:13', 'Isaiah 43:2', 'Isaiah 46:4',
    'Isaiah 40:29', 'Isaiah 40:31', 'Jeremiah 29:11', 'Jeremiah 17:7',
    'Jeremiah 17:8', '2 Corinthians 9:8', 'Malachi 3:10', 'Malachi 3:11',
    'Joel 2:25', 'Joel 2:26', 'Deuteronomy 8:18',

    // ── Justice & Righteousness (Apr 1–30) ──────────────────────────────────
    'Micah 6:8', 'Amos 5:24', 'Amos 5:15', 'Proverbs 21:3',
    'Proverbs 31:8', 'Proverbs 31:9', 'Proverbs 29:7', 'Proverbs 28:5',
    'Isaiah 1:17', 'Isaiah 10:1-2', 'Isaiah 30:18', 'Isaiah 56:1',
    'Psalm 82:3', 'Psalm 89:14', 'Psalm 97:2', 'Psalm 106:3',
    'Psalm 140:12', 'Psalm 146:7', 'Psalm 146:8', 'Psalm 146:9',
    'Zechariah 7:9', 'Zechariah 7:10', 'Jeremiah 22:3', 'Jeremiah 22:13',
    'Deuteronomy 16:19', 'Deuteronomy 16:20', 'Deuteronomy 10:18', 'Deuteronomy 27:19',
    'James 1:27', 'Matthew 23:23',

    // ── Generosity & Giving (May 1–31) ──────────────────────────────────────
    'Proverbs 3:9', 'Proverbs 3:10', 'Proverbs 11:24', 'Proverbs 11:25',
    'Proverbs 22:9', 'Proverbs 19:17', 'Proverbs 28:27', 'Proverbs 21:26',
    '2 Corinthians 9:6', '2 Corinthians 9:7', '2 Corinthians 9:10', '2 Corinthians 9:11',
    '2 Corinthians 9:12', '2 Corinthians 8:7', '2 Corinthians 8:9', '2 Corinthians 8:12',
    'Acts 20:35', 'Acts 2:44-45', 'Acts 4:32', 'Acts 4:34-35',
    'Luke 6:38', 'Luke 3:11', 'Luke 21:1-4', 'Mark 12:41-44',
    '1 Timothy 6:17', '1 Timothy 6:18', '1 Timothy 6:19', 'Hebrews 13:16',
    'James 2:15-16', 'Galatians 6:9', 'Galatians 6:10',

    // ── Wisdom & Diligence (Jun 1–30) ───────────────────────────────────────
    'Proverbs 1:7', 'Proverbs 2:6', 'Proverbs 3:5', 'Proverbs 3:6',
    'Proverbs 4:7', 'Proverbs 8:11', 'Proverbs 9:10', 'Proverbs 10:4',
    'Proverbs 10:5', 'Proverbs 11:1', 'Proverbs 12:11', 'Proverbs 12:24',
    'Proverbs 13:4', 'Proverbs 13:11', 'Proverbs 14:23', 'Proverbs 16:3',
    'Proverbs 16:9', 'Proverbs 16:11', 'Proverbs 20:10', 'Proverbs 20:23',
    'Proverbs 21:5', 'Proverbs 22:1', 'Proverbs 22:7', 'Proverbs 22:29',
    'Proverbs 24:3', 'Proverbs 24:4', 'Proverbs 24:27', 'Proverbs 27:23',
    'Proverbs 27:24', 'Ecclesiastes 9:10',

    // ── Faith & Promise (Jul 1–31) ──────────────────────────────────────────
    'Hebrews 11:1', 'Hebrews 11:6', 'Hebrews 10:23', 'Hebrews 10:35',
    'Hebrews 10:36', 'Hebrews 12:1', 'Hebrews 12:2', 'Hebrews 13:5',
    'Hebrews 13:6', 'Hebrews 13:8', 'Romans 8:28', 'Romans 8:31',
    'Romans 8:37', 'Romans 8:38-39', 'Romans 10:17', 'Romans 12:2',
    'Romans 12:11', 'Romans 13:8', 'Romans 15:13', '2 Corinthians 5:7',
    'Galatians 2:20', 'Galatians 5:22-23', 'Galatians 6:7', 'Galatians 6:8',
    'Ephesians 2:8', 'Ephesians 2:10', 'Ephesians 3:20', 'James 1:5',
    'James 1:6', 'James 2:17', 'James 2:26',

    // ── Kingdom Work & Purpose (Aug 1–31) ───────────────────────────────────
    'Matthew 5:14', 'Matthew 5:16', 'Matthew 6:10', 'Matthew 6:19',
    'Matthew 6:20', 'Matthew 6:21', 'Matthew 7:24', 'Matthew 7:25',
    'Matthew 9:37', 'Matthew 9:38', 'Matthew 10:8', 'Matthew 13:23',
    'Matthew 16:18', 'Matthew 16:19', 'Matthew 22:37-39', 'Matthew 28:19',
    'Matthew 28:20', 'Mark 10:45', 'Mark 16:15', 'John 3:16',
    'John 10:10', 'John 13:34', 'John 14:6', 'John 14:12',
    'John 14:27', 'John 15:5', 'John 15:16', 'John 16:33',
    'John 17:21', 'John 20:21', 'Acts 1:8',

    // ── Psalms of Praise & Trust (Sep 1–30) ─────────────────────────────────
    'Psalm 1:1-3', 'Psalm 4:8', 'Psalm 5:3', 'Psalm 16:8',
    'Psalm 16:11', 'Psalm 18:2', 'Psalm 19:14', 'Psalm 20:4',
    'Psalm 23:4', 'Psalm 23:5', 'Psalm 23:6', 'Psalm 27:1',
    'Psalm 27:4', 'Psalm 28:7', 'Psalm 29:11', 'Psalm 30:5',
    'Psalm 31:24', 'Psalm 32:8', 'Psalm 33:18', 'Psalm 34:1',
    'Psalm 34:8', 'Psalm 34:18', 'Psalm 37:4', 'Psalm 37:5',
    'Psalm 37:7', 'Psalm 40:1', 'Psalm 46:1', 'Psalm 46:10',
    'Psalm 51:10', 'Psalm 55:22',

    // ── Strength & Endurance (Oct 1–31) ─────────────────────────────────────
    'Psalm 56:3', 'Psalm 62:1', 'Psalm 62:2', 'Psalm 63:1',
    'Psalm 71:14', 'Psalm 73:26', 'Psalm 86:11', 'Psalm 90:12',
    'Psalm 91:1', 'Psalm 91:2', 'Psalm 91:11', 'Psalm 103:1',
    'Psalm 103:2', 'Psalm 103:12', 'Psalm 112:1', 'Psalm 112:5',
    'Psalm 115:1', 'Psalm 118:24', 'Psalm 119:105', 'Psalm 119:11',
    'Psalm 121:1-2', 'Psalm 126:5', 'Psalm 127:1', 'Psalm 133:1',
    'Psalm 138:8', 'Psalm 139:14', 'Psalm 143:8', 'Psalm 144:1',
    'Psalm 145:13', 'Psalm 147:3', 'Psalm 150:6',

    // ── Prophets & Promise (Nov 1–30) ───────────────────────────────────────
    'Isaiah 9:6', 'Isaiah 12:2', 'Isaiah 25:1', 'Isaiah 26:3',
    'Isaiah 26:4', 'Isaiah 30:21', 'Isaiah 32:17', 'Isaiah 33:6',
    'Isaiah 35:4', 'Isaiah 40:8', 'Isaiah 40:28', 'Isaiah 41:17',
    'Isaiah 43:18-19', 'Isaiah 44:3', 'Isaiah 45:2-3', 'Isaiah 48:17',
    'Isaiah 49:13', 'Isaiah 52:7', 'Isaiah 53:5', 'Isaiah 54:10',
    'Isaiah 55:8-9', 'Isaiah 55:10-11', 'Isaiah 57:15', 'Isaiah 60:1',
    'Isaiah 60:22', 'Isaiah 62:11', 'Isaiah 65:17', 'Isaiah 66:2',
    'Ezekiel 36:26', 'Daniel 2:21',

    // ── Advent & Glory (Dec 1–31) ───────────────────────────────────────────
    'Revelation 21:5', 'Revelation 22:12', 'Revelation 22:17', '1 John 4:19',
    '1 John 1:9', '1 John 3:1', '1 John 4:7', '1 John 5:4',
    '1 Peter 2:9', '1 Peter 5:6-7', '1 Peter 5:10', '2 Peter 1:3',
    '2 Peter 3:9', '2 Timothy 1:7', '2 Timothy 2:15', '2 Timothy 3:16-17',
    'Colossians 1:16-17', 'Colossians 3:1-2', 'Colossians 3:15', 'Colossians 3:17',
    'Ephesians 1:3', 'Ephesians 1:7', 'Ephesians 2:4-5', 'Ephesians 3:17-19',
    'Ephesians 4:32', 'Ephesians 6:10', 'Philippians 1:6', 'Philippians 2:13',
    'Philippians 3:14', 'Philippians 4:6-7', 'Philippians 4:8',
];

function getDayOfYear(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayVerseRef(): string {
    const day = getDayOfYear();
    return VERSE_POOL[(day - 1) % VERSE_POOL.length];
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
        `day_of_year: ${getDayOfYear()}`,
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
    logger.info(`📱 Generating daily post (day ${getDayOfYear()}/365) with verse: ${verseRef}`);

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
