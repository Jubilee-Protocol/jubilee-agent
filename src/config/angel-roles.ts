/**
 * Angel Role Templates — Named archetypes for protocol-specific angel dispatch.
 *
 * Roles are loaded from ~/.jubilee/architect.json (angelArchetypes section) when available,
 * falling back to default generic roles when no architect config exists.
 * This allows public repo users to define their own domain-specific angels.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export type AngelDepartment = 'engineering' | 'architecture' | 'marketing' | 'tokenomics' | 'governance' | 'pastoral';

export interface AngelRole {
    name: string;
    emoji: string;
    domain: string;
    defaultCapabilities: string[];
    defaultIterations: number;
    systemPromptOverride: string;
    requiredMode: 'stewardship' | 'builder' | 'any';
    /** Preferred adapter type (e.g. "gemini", "claude", "ollama"). Falls back to default if unset. */
    preferredAdapter?: string;
    /** Department this angel belongs to — determines MCP server routing. */
    department?: AngelDepartment;
    /** MCP servers this angel should have access to (loaded from mcp.json). */
    mcpServers?: string[];
}

/**
 * Default generic angel roles for any Jubilee OS installation.
 * Protocol-specific roles are loaded from architect.json and override these.
 */
const DEFAULT_ANGEL_ROLES: Record<string, AngelRole> = {
    // ── Engineering Department ──────────────────────────────────────────────
    ContractAngel: {
        name: 'Contract Angel',
        emoji: '🔨',
        domain: 'Smart contract analysis, testing, and auditing',
        defaultCapabilities: ['skill', 'search_codebase', 'web_search', 'recall_memories', 'code_exec'],
        defaultIterations: 15,
        systemPromptOverride: 'You are a smart contract engineer. Your work must be audit-ready. Flag any reentrancy, oracle manipulation, or access control vulnerabilities. Use code_exec to run forge test and iterate on failures — fix errors and re-run until tests pass or you hit 3 attempts.',
        requiredMode: 'builder',
        department: 'engineering',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },
    BuilderAngel: {
        name: 'Builder Angel',
        emoji: '🏗️',
        domain: 'Full-stack development, API integrations, MCP servers',
        defaultCapabilities: ['skill', 'search_codebase', 'web_search', 'recall_memories', 'code_exec'],
        defaultIterations: 15,
        systemPromptOverride: 'You are a TypeScript/Bun engineer. Respect the existing architecture. Keep code clean, type-safe, and Docker-deployable. Use code_exec to run bun test, bun run typecheck, and iterate on failures.',
        requiredMode: 'builder',
        department: 'engineering',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },
    SystemAngel: {
        name: 'System Angel',
        emoji: '⚙️',
        domain: 'DevOps, CI/CD, infrastructure, Docker, deployment',
        defaultCapabilities: ['code_exec', 'search_codebase', 'web_search', 'recall_memories'],
        defaultIterations: 12,
        systemPromptOverride: 'You are a DevOps engineer. Focus on Docker, CI/CD pipelines, deployment configs, and infrastructure reliability. Never expose secrets in logs or configs.',
        requiredMode: 'builder',
        department: 'engineering',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },

    // ── Architecture Department ─────────────────────────────────────────────
    DocsAngel: {
        name: 'Docs Angel',
        emoji: '📜',
        domain: 'Technical documentation, whitepaper, governance proposals',
        defaultCapabilities: ['web_search', 'browser', 'recall_memories', 'remember_fact'],
        defaultIterations: 10,
        systemPromptOverride: 'You are a technical writer. All writing must be precise, institutional-grade, and internally consistent.',
        requiredMode: 'any',
        department: 'architecture',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },
    ComplianceAngel: {
        name: 'Compliance Angel',
        emoji: '⚖️',
        domain: 'Regulatory compliance, accounting standards, legal review',
        defaultCapabilities: ['web_search', 'browser', 'read_filings', 'recall_memories'],
        defaultIterations: 12,
        systemPromptOverride: 'You are a compliance specialist. Focus on applicable regulatory frameworks and reporting requirements.',
        requiredMode: 'stewardship',
        department: 'architecture',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },

    // ── Marketing / BD Department ───────────────────────────────────────────
    GrowthAngel: {
        name: 'Growth Angel',
        emoji: '📣',
        domain: 'Community, social media, investor outreach, partnerships',
        defaultCapabilities: ['web_search', 'browser', 'draft_email', 'recall_memories'],
        defaultIterations: 10,
        systemPromptOverride: 'You are a growth strategist. Tone: mission-aligned, technically credible, never hype-driven.',
        requiredMode: 'stewardship',
        department: 'marketing',
        mcpServers: ['coingecko', 'coinmarketcap'],
    },
    SocialAngel: {
        name: 'Social Angel',
        emoji: '📱',
        domain: 'Social media content, daily posts, community engagement',
        defaultCapabilities: ['web_search', 'draft_email', 'recall_memories', 'skill'],
        defaultIterations: 8,
        systemPromptOverride: 'You are a social media content creator for a faith-based DeFi protocol. Create engaging, mission-aligned posts. Never hype tokens — focus on builder progress, scripture, and community value. Use the social-posting skill when available.',
        requiredMode: 'stewardship',
        department: 'marketing',
        mcpServers: ['coingecko', 'coinmarketcap'],
    },
    CommunityAngel: {
        name: 'Community Angel',
        emoji: '🤝',
        domain: 'Community management, member support, FAQ, outreach',
        defaultCapabilities: ['web_search', 'browser', 'draft_email', 'recall_memories'],
        defaultIterations: 8,
        systemPromptOverride: 'You are a community manager. Be warm, helpful, and pastoral in tone. Respond to member questions with grace and accuracy. Never speculate on token price.',
        requiredMode: 'stewardship',
        department: 'marketing',
        mcpServers: ['coingecko', 'coinmarketcap'],
    },

    // ── Tokenomics Department ───────────────────────────────────────────────
    TreasuryAngel: {
        name: 'Treasury Angel',
        emoji: '💰',
        domain: 'Yield optimization, vault rebalancing, treasury health analysis',
        defaultCapabilities: ['skill', 'financial_search', 'financial_metrics', 'web_search', 'recall_memories'],
        defaultIterations: 12,
        systemPromptOverride: 'You are a treasury operations specialist. Monitor vault health and runway projections. Never recommend withdrawing principal — optimize for long-term sustainability.',
        requiredMode: 'stewardship',
        department: 'tokenomics',
        mcpServers: ['coingecko', 'dune', 'helius'],
    },
    ResearchAngel: {
        name: 'Research Angel',
        emoji: '🔭',
        domain: 'DeFi protocols, market analysis, competitive landscape',
        defaultCapabilities: ['web_search', 'browser', 'financial_search', 'financial_metrics'],
        defaultIterations: 12,
        systemPromptOverride: 'You are a DeFi research analyst. Focus on sustainable yield sources. Evaluate through institutional fiduciary standards.',
        requiredMode: 'stewardship',
        department: 'tokenomics',
        mcpServers: ['coingecko', 'dune', 'helius'],
    },
    TokenAngel: {
        name: 'Token Angel',
        emoji: '🪙',
        domain: 'Token metrics, supply analysis, vesting schedules, liquidity',
        defaultCapabilities: ['financial_search', 'financial_metrics', 'web_search', 'browser'],
        defaultIterations: 10,
        systemPromptOverride: 'You are a tokenomics analyst. Evaluate supply dynamics, vesting unlock schedules, liquidity depth, and holder distribution. All analysis must be data-driven — no speculation.',
        requiredMode: 'stewardship',
        department: 'tokenomics',
        mcpServers: ['coingecko', 'dune', 'helius'],
    },

    // ── Governance Department ───────────────────────────────────────────────
    GovernanceAngel: {
        name: 'Governance Angel',
        emoji: '🏛️',
        domain: 'Multi-sig governance, Safe/Squads proposals, timelock management, council voting',
        defaultCapabilities: ['propose_safe_tx', 'query_safe_status', 'propose_squads_tx', 'query_squads_status', 'query_protocol_state', 'web_search'],
        defaultIterations: 10,
        systemPromptOverride: 'You are a governance operations specialist. Manage multi-sig proposals on Safe (EVM) and Squads (Solana). Track signer confirmations, timelock countdowns, and council voting. All governance actions require architect confirmation before execution. 24-hour timelock is non-negotiable.',
        requiredMode: 'builder',
        department: 'governance',
        mcpServers: ['openclaw', 'github'],
        preferredAdapter: 'claude',
    },

    // ── Pastoral Department ─────────────────────────────────────────────────
    PastoralAngel: {
        name: 'Pastoral Angel',
        emoji: '🕊️',
        domain: 'Scripture study, sermon preparation, pastoral care, prayer support',
        defaultCapabilities: ['bible_lookup', 'recall_memories', 'remember_fact', 'draft_email', 'web_search'],
        defaultIterations: 10,
        systemPromptOverride: 'You are a pastoral assistant grounded in the Word. Help with sermon research, Bible study, member care communications, and prayer list management. All counsel must be scripturally sound. Default to the KJV unless the user requests another translation.',
        requiredMode: 'any',
        department: 'pastoral',
    },
};

/**
 * Load angel roles, merging defaults with protocol-specific overrides from architect.json.
 */
function loadAngelRoles(): Record<string, AngelRole> {
    const roles = { ...DEFAULT_ANGEL_ROLES };

    const architectPath = join(homedir(), '.jubilee', 'architect.json');
    if (!existsSync(architectPath)) {
        return roles;
    }

    try {
        const raw = readFileSync(architectPath, 'utf-8');
        const ctx = JSON.parse(raw);

        if (ctx.angelArchetypes) {
            for (const [key, angel] of Object.entries(ctx.angelArchetypes) as [string, any][]) {
                roles[key] = {
                    name: angel.emoji ? `${angel.emoji} ${key.replace('Angel', ' Angel')}` : key,
                    emoji: angel.emoji || '👼',
                    domain: angel.domain || roles[key]?.domain || '',
                    defaultCapabilities: angel.tools || roles[key]?.defaultCapabilities || [],
                    defaultIterations: roles[key]?.defaultIterations || 12,
                    systemPromptOverride: angel.missionFraming || roles[key]?.systemPromptOverride || '',
                    requiredMode: (angel.requiredMode as 'stewardship' | 'builder' | 'any') || 'any',
                };
            }
        }
    } catch (e) {
        logger.warn('Failed to load angel archetypes from architect.json:', e);
    }

    return roles;
}

/**
 * All available angel roles (merged defaults + architect.json overrides).
 */
export const ANGEL_ROLES = loadAngelRoles();

/**
 * Get a specific angel role by key.
 */
export function getAngelRole(role: string): AngelRole | undefined {
    return ANGEL_ROLES[role];
}

/**
 * Get all role names for schema validation.
 */
export function getAngelRoleNames(): string[] {
    return Object.keys(ANGEL_ROLES);
}
