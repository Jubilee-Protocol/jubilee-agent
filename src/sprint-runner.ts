#!/usr/bin/env bun
/**
 * Sprint Runner — Standalone CLI for headless sprint execution.
 *
 * Usage:
 *   bun run src/sprint-runner.ts create "Protocol Audit" \
 *     --tasks "ContractAngel:Audit vault,DocsAngel:Update README" \
 *     --budget 5.00 --concurrency 2
 *
 *   bun run src/sprint-runner.ts run <sprint-id>
 *   bun run src/sprint-runner.ts status <sprint-id>
 *   bun run src/sprint-runner.ts adapters
 */

import { config } from 'dotenv';
import { SprintBoard } from './services/sprint-board.js';
import type { SprintTaskInput } from './services/sprint-board.js';
import { listAdapters, testAllAdapters } from './adapters/index.js';
import { getAngelRoleNames } from './config/angel-roles.js';

config({ quiet: true });

const board = new SprintBoard();

const [, , command, ...rest] = process.argv;

async function main() {
    switch (command) {
        case 'adapters':
            await showAdapters();
            break;
        case 'create':
            await createSprint(rest);
            break;
        case 'run':
            await runSprint(rest[0]);
            break;
        case 'status':
            showStatus(rest[0]);
            break;
        case 'roles':
            showRoles();
            break;
        default:
            printHelp();
    }
}

// ── Adapters ─────────────────────────────────────────────────────────────────

async function showAdapters() {
    console.log('\n⚡ Adapter Status\n');
    const results = await testAllAdapters();
    const adapters = listAdapters();

    for (const adapter of adapters) {
        const test = results[adapter.type];
        const status = test?.ok ? '✅ Connected' : `❌ ${test?.error || 'Not configured'}`;
        const latency = test?.latencyMs ? ` (${test.latencyMs}ms)` : '';
        console.log(`  ${adapter.name.padEnd(20)} ${adapter.type.padEnd(10)} ${status}${latency}`);
        console.log(`  ${''.padEnd(20)} Default: ${adapter.defaultModel}`);
        console.log();
    }
}

// ── Roles ────────────────────────────────────────────────────────────────────

function showRoles() {
    console.log('\n👼 Available Angel Roles\n');
    const { ANGEL_ROLES } = require('./config/angel-roles.js');
    for (const [key, role] of Object.entries(ANGEL_ROLES) as [string, any][]) {
        console.log(`  ${role.emoji} ${key.padEnd(22)} ${role.domain}`);
    }
    console.log();
}

// ── Create Sprint ────────────────────────────────────────────────────────────

async function createSprint(args: string[]) {
    const name = args[0];
    if (!name) {
        console.error('Usage: sprint-runner create "Sprint Name" --tasks "Angel:goal,Angel:goal" [--budget N] [--concurrency N]');
        process.exit(1);
    }

    let tasksStr = '';
    let budgetUsd: number | undefined;
    let concurrency = 2;

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--tasks' && args[i + 1]) {
            tasksStr = args[++i];
        } else if (args[i] === '--budget' && args[i + 1]) {
            budgetUsd = parseFloat(args[++i]);
        } else if (args[i] === '--concurrency' && args[i + 1]) {
            concurrency = parseInt(args[++i]);
        }
    }

    if (!tasksStr) {
        console.error('Missing --tasks flag. Format: "ContractAngel:Audit vault,DocsAngel:Update README"');
        process.exit(1);
    }

    const taskInputs: SprintTaskInput[] = tasksStr.split(',').map(pair => {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) {
            console.error(`Invalid task format: "${pair}". Use "AngelRole:goal".`);
            process.exit(1);
        }
        const angel = pair.slice(0, colonIdx).trim();
        const goal = pair.slice(colonIdx + 1).trim();

        // Validate angel role
        if (!getAngelRoleNames().includes(angel)) {
            console.error(`Unknown angel role: "${angel}". Available: ${getAngelRoleNames().join(', ')}`);
            process.exit(1);
        }

        return { angel, goal };
    });

    const sprint = board.createSprint(name, taskInputs, { concurrency, budgetUsd });

    console.log(`\n📋 Sprint created: "${sprint.name}" (${sprint.id})`);
    console.log(`   Tasks: ${sprint.tasks.length}`);
    console.log(`   Concurrency: ${sprint.concurrency}`);
    if (sprint.budgetUsd) console.log(`   Budget: $${sprint.budgetUsd.toFixed(2)}`);
    console.log(`\n   Tasks:`);
    for (const task of sprint.tasks) {
        console.log(`     • ${task.angel}: ${task.goal}`);
    }
    console.log(`\n   Run with: bun run src/sprint-runner.ts run ${sprint.id}\n`);

    // Auto-run if --run flag
    if (args.includes('--run')) {
        await runSprint(sprint.id);
    }
}

// ── Run Sprint ───────────────────────────────────────────────────────────────

async function runSprint(sprintId: string) {
    if (!sprintId) {
        console.error('Usage: sprint-runner run <sprint-id>');
        process.exit(1);
    }

    console.log(`\n🚀 Starting sprint ${sprintId}...\n`);

    for await (const event of board.runSprint(sprintId)) {
        switch (event.type) {
            case 'sprint_started':
                console.log(`▶ Sprint started — ${event.totalTasks} tasks`);
                break;

            case 'task_started':
                console.log(`  ▸ ${event.angel} started: ${event.goal}`);
                break;

            case 'task_completed':
                const cost = event.result.costUsd
                    ? `$${event.result.costUsd.toFixed(4)}`
                    : 'free';
                console.log(`  ✅ ${event.angel} done (${event.result.durationMs}ms, ${cost})`);
                console.log(`     Output: ${event.result.output.slice(0, 200)}...`);
                break;

            case 'task_failed':
                console.log(`  ❌ ${event.angel} failed: ${event.error}`);
                break;

            case 'budget_warning':
                console.log(`  ⚠️  Budget: $${event.currentCostUsd.toFixed(4)} / $${event.budgetUsd.toFixed(2)} (${event.percentUsed.toFixed(0)}%)`);
                break;

            case 'sprint_completed':
                console.log(`\n✅ Sprint complete!`);
                console.log(`   Completed: ${event.completedTasks}/${event.totalTasks}`);
                console.log(`   Failed: ${event.failedTasks}`);
                console.log(`   Cost: $${event.totalCostUsd.toFixed(4)}`);
                console.log(`   Duration: ${(event.totalDurationMs / 1000).toFixed(1)}s\n`);

                // Print budget summary
                const summary = board.getBudgetSummary(sprintId);
                if (summary && Object.keys(summary.perAngel).length > 0) {
                    console.log('   Per-Angel Costs:');
                    for (const [angel, data] of Object.entries(summary.perAngel)) {
                        console.log(`     ${angel}: $${data.costUsd.toFixed(4)} (${data.tokens.input + data.tokens.output} tokens)`);
                    }
                    console.log();
                }
                break;
        }
    }
}

// ── Status ───────────────────────────────────────────────────────────────────

function showStatus(sprintId: string) {
    if (!sprintId) {
        // List all sprints
        const sprints = board.listSprints();
        if (sprints.length === 0) {
            console.log('\nNo sprints found. Create one with: sprint-runner create "Name" --tasks ...\n');
            return;
        }
        console.log('\n📋 Sprints:\n');
        for (const s of sprints) {
            const icon = s.status === 'complete' ? '✅' : s.status === 'running' ? '▶' : '⏸';
            console.log(`  ${icon} ${s.id}  ${s.name}  (${s.status}) — ${s.tasks.length} tasks`);
        }
        console.log();
        return;
    }

    const sprint = board.getSprint(sprintId);
    if (!sprint) {
        console.error(`Sprint ${sprintId} not found.`);
        process.exit(1);
    }

    console.log(`\n📋 Sprint: ${sprint.name} (${sprint.id})`);
    console.log(`   Status: ${sprint.status}`);
    console.log(`   Tasks:\n`);
    for (const task of sprint.tasks) {
        const icon = task.status === 'done' ? '✅' : task.status === 'active' ? '▸' : task.status === 'failed' ? '❌' : '○';
        const cost = task.result?.costUsd ? ` ($${task.result.costUsd.toFixed(4)})` : '';
        console.log(`     ${icon} ${task.angel}: ${task.goal}${cost}`);
    }

    const summary = board.getBudgetSummary(sprintId);
    if (summary) {
        console.log(`\n   Total Cost: $${summary.totalCostUsd.toFixed(4)}`);
        if (summary.budgetUsd) {
            console.log(`   Budget: $${summary.budgetUsd.toFixed(2)} (${summary.percentUsed.toFixed(0)}% used)`);
        }
    }
    console.log();
}

// ── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
    console.log(`
Jubilee Sprint Runner — Concurrent Angel Orchestration

Commands:
  adapters                     Show adapter connection status
  roles                        List available angel roles

  create "Name" [flags]        Create a new sprint
    --tasks "Angel:goal,..."   Required: angel assignments
    --budget N                 Optional: max cost in USD
    --concurrency N            Optional: parallel angels (default: 2)
    --run                      Optional: auto-run after creation

  run <sprint-id>              Execute a sprint
  status [sprint-id]          Show sprint status (or list all)

Examples:
  bun run src/sprint-runner.ts adapters
  bun run src/sprint-runner.ts create "Audit" --tasks "ContractAngel:Audit vault,DocsAngel:Update docs" --budget 2.50 --run
  bun run src/sprint-runner.ts status
`);
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
