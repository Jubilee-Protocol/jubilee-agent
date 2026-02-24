
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

/**
 * Allowlisted commands for safe execution.
 * Covers the full Jubilee Protocol build lifecycle:
 * - Solidity: forge, cast, anvil, slither
 * - TypeScript/Bun: bun, npx, node
 * - Solana/Anchor: anchor, solana, cargo
 * - Git: git log, git diff, git status, git branch
 * - Package: npm, yarn (read-only operations)
 * - Utilities: cat, ls, find, wc, grep, head, tail, echo
 */
const COMMAND_ALLOWLIST = [
    // Solidity / Foundry
    'forge', 'cast', 'anvil', 'slither',
    // TypeScript / Bun
    'bun', 'npx', 'node', 'tsc',
    // Solana / Anchor / Rust
    'anchor', 'solana', 'cargo',
    // Git (read + branch ops)
    'git',
    // Package managers (read-only)
    'npm', 'yarn',
    // Utilities
    'cat', 'ls', 'find', 'wc', 'grep', 'head', 'tail', 'echo', 'pwd', 'which',
];

/**
 * Blocklisted patterns — rejected even if base command is allowed.
 */
const PATTERN_BLOCKLIST = [
    /rm\s+(-rf?|--recursive)/i,     // No recursive deletes
    /sudo/i,                         // No privilege escalation
    /curl.*\|\s*(bash|sh)/i,         // No pipe-to-shell
    /wget.*\|\s*(bash|sh)/i,
    />\s*\/dev\/sd/i,                // No raw device writes
    /mkfs/i,                         // No filesystem formatting
    /dd\s+if=/i,                     // No disk duplication
    /:(){ :\|:& };:/,               // No fork bombs
    /npm publish/i,                  // No publishing
    /git push/i,                     // No pushing (architect does this)
    /git merge/i,                    // No merging (architect reviews)
    /DROP\s+TABLE/i,                 // No SQL drops
    /TRUNCATE/i,                     // No SQL truncates
];

const MAX_TIMEOUT_MS = 120_000; // 2 minutes max
const MAX_OUTPUT_CHARS = 4000;  // LLM context-friendly

/**
 * CodeExecutionTool
 * Sandboxed shell execution for Builder and Contract Angels.
 * Allows running build, test, and analysis commands with safety guardrails.
 */
export class CodeExecutionTool extends StructuredTool {
    name = 'code_exec';
    description = `Execute a shell command for build/test/analysis. Allowed commands: ${COMMAND_ALLOWLIST.join(', ')}. Use this to run forge test, bun test, check deployments, analyze contracts, etc. Output is captured and returned. Max timeout: 120s.`;

    schema = z.object({
        command: z.string().describe('Shell command to execute (e.g., "forge test --gas-report", "bun run typecheck", "anchor build").'),
        cwd: z.string().optional().describe('Working directory (default: project root).'),
        timeout: z.number().optional().default(60000).describe('Timeout in milliseconds (max: 120000).'),
    });

    async _call(arg: { command: string, cwd?: string, timeout?: number }): Promise<string> {
        const { command, cwd, timeout = 60000 } = arg;

        // 1. Extract base command
        const baseCommand = command.trim().split(/\s+/)[0];
        if (!baseCommand || !COMMAND_ALLOWLIST.includes(baseCommand)) {
            return `⛔ Command rejected: "${baseCommand}" is not in the allowlist.\nAllowed: ${COMMAND_ALLOWLIST.join(', ')}`;
        }

        // 2. Check pattern blocklist
        for (const pattern of PATTERN_BLOCKLIST) {
            if (pattern.test(command)) {
                return `⛔ Command rejected: matches blocked pattern (${pattern.source}). This command is not safe for automated execution.`;
            }
        }

        // 3. Enforce timeout
        const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT_MS);

        logger.info(`⚡ Executing: ${command}${cwd ? ` (in ${cwd})` : ''}`);

        try {
            const output = execSync(command, {
                encoding: 'utf-8',
                timeout: effectiveTimeout,
                cwd: cwd || process.cwd(),
                env: { ...process.env },
                maxBuffer: 1024 * 1024, // 1MB buffer
            });

            const trimmed = output.length > MAX_OUTPUT_CHARS
                ? output.slice(0, MAX_OUTPUT_CHARS) + `\n\n... [output truncated at ${MAX_OUTPUT_CHARS} chars, full output was ${output.length} chars]`
                : output;

            return `✅ Command succeeded:\n\`\`\`\n${trimmed}\n\`\`\``;
        } catch (error: any) {
            // Command failed (non-zero exit code) — this is expected for test failures
            const stdout = error.stdout || '';
            const stderr = error.stderr || '';
            const combined = (stdout + '\n' + stderr).trim();

            const trimmed = combined.length > MAX_OUTPUT_CHARS
                ? combined.slice(0, MAX_OUTPUT_CHARS) + `\n\n... [output truncated at ${MAX_OUTPUT_CHARS} chars]`
                : combined;

            if (error.killed) {
                return `⏱️ Command timed out after ${effectiveTimeout}ms:\n\`\`\`\n${trimmed}\n\`\`\``;
            }

            return `❌ Command failed (exit ${error.status}):\n\`\`\`\n${trimmed}\n\`\`\``;
        }
    }
}
