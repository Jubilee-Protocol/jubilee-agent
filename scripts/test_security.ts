
import { Agent } from '../src/agent/agent.js';
import { InMemoryChatHistory } from '../src/utils/in-memory-chat-history.js';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Mock Sensitive Tool
class MockShellTool extends StructuredTool {
    name = 'shell_execute';
    description = 'Executes shell commands';
    schema = z.object({ command: z.string() });
    async _call(arg: { command: string }) {
        return `Executed: ${arg.command}`;
    }
}

async function main() {
    console.log('🔒 Testing Security Hardening (Double-Confirmation)...');

    const history = new InMemoryChatHistory();
    const tools = [new MockShellTool()];

    // 1. Test Blocked
    console.log('\nTest 1: Attempting sensitive action WITHOUT confirmation...');
    // We need to inject a previous message into history to simulate the conversation flow?
    // Actually, Agent.run uses 'query' as the current input. 
    // If 'query' doesn't have "CONFIRM", it should block.
    // BUT Agent.run also uses history.

    const agent = Agent.create({ tools, model: 'gpt-4o' }); // Use smart model to ensure tool selection

    // Create a generator
    const gen1 = agent.run("Please run shell_execute with command 'echo hello'", history);

    let blocked = false;
    for await (const event of gen1) {
        if (event.type === 'tool_error' && event.error.includes('Security Block')) {
            console.log('✅ Success: Action BLOCKED as expected.');
            blocked = true;
        }
        if (event.type === 'tool_end') {
            if (event.tool === 'shell_execute' && !event.result.includes('SECURITY ALERT')) {
                console.error('❌ Failure: Action Executed without confirmation!');
            }
        }
    }

    // 2. Test Allowed
    console.log('\nTest 2: Attempting sensitive action WITH confirmation...');
    // We simulate the user saying "CONFIRM"
    const history2 = new InMemoryChatHistory();
    history2.addUserMessage("I need you to run a command.");
    history2.addAiMessage("Which command?");
    // The 'query' passed to run() acts as the latest message

    const gen2 = agent.run("CONFIRM run shell_execute echo hello", history2);

    let allowed = false;
    for await (const event of gen2) {
        if (event.type === 'tool_start' && event.tool === 'shell_execute') {
            console.log('✅ Success: Action ALLOWED with confirmation keyword.');
            allowed = true;
        }
        if (event.type === 'tool_error' && event.error.includes('Security Block')) {
            console.error('❌ Failure: Action BLOCKED despite confirmation!');
        }
    }

    if (!blocked || !allowed) {
        console.log('\n⚠️  Tests Incomplete. Check logs.');
    } else {
        console.log('\n🎉 Security Verification Passed!');
    }
}

main();
