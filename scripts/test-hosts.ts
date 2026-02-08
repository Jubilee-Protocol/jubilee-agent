
import { DispatchAngelTool } from '../src/tools/angel-tool.js';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';
config();

async function main() {
    console.log('🕊️ Testing Hosts Mode (The Lord of Hosts)...');

    const angelTool = new DispatchAngelTool();

    // Mission 1: Simple Generation (No tools needed)
    console.log('\n--- Mission 1: Creative Writing ---');
    const result1 = await angelTool.invoke({
        name: 'Poet Angel',
        mission: 'Write a haiku about a digital angel.',
        capabilities: [], // No extra tools
        iterations: 5
    });
    console.log(result1);

    // Mission 2: Tool Usage (Memory)
    console.log('\n--- Mission 2: Memory Check ---');
    const result2 = await angelTool.invoke({
        name: 'Memory Angel',
        mission: 'Remember the fact "The code is compiled" and then recall what you know about "code".',
        capabilities: ['remember_fact', 'recall_memories'],
        iterations: 5
    });
    console.log(result2);
}

main().catch(console.error);
