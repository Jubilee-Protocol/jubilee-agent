
import { config } from 'dotenv';
config();

import { TriuneAgent } from '../src/agent/triune-agent.js';
import { InMemoryChatHistory } from '../src/utils/in-memory-chat-history.js';
import { McpManager } from '../src/mcp/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock Memory Logic
const MockMemory = {
    getInstance: () => ({
        init: async () => console.log('🧠 [MOCK] Memory Initialized'),
        remember: async () => { },
        recall: async () => []
    })
};

async function runDemo() {
    console.log('🕊️ STARTING JUBILEE LIVE TEST 🕊️');
    console.log('Goal: Verify Mind, Prophet, and Will coordination with OpenClaw execution.');

    // 1. Init Systems
    try {
        console.log('🔌 Initializing MCP...');
        const configPath = path.resolve(process.cwd(), 'mcp.json');
        if (fs.existsSync(configPath)) {
            const rawData = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(rawData);
            const mcpConfig = Object.entries(parsed.mcpServers).map(([key, value]: [string, any]) => ({
                id: key,
                command: value.command,
                args: value.args,
                disabled: value.disabled
            }));
            await McpManager.getInstance().init(mcpConfig);
        }

        console.log('🧠 Initializing Memory...');
        try {
            const { MemoryManager } = await import('../src/memory/index.js');
            await MemoryManager.getInstance().init();
        } catch (e: any) {
            console.warn('⚠️ Real Memory Module failed. Using Mock.');
            await MockMemory.getInstance().init();
        }
    } catch (e) {
        console.error('❌ System Init Failed:', e);
        process.exit(1);
    }

    // 2. Create Agent
    const agent = TriuneAgent.create({ model: 'gemini-2.0-flash' });
    const history = new InMemoryChatHistory();

    // 3. Send Query
    // We utilize a safe query to ensure the Prophet allows the Will to act.
    const query = "Write a short poem about God's grace and save it to a file named 'grace.txt'.";

    console.log(`\n🗣️ USER: "${query}"\n`);

    try {
        const stream = agent.run(query, history);

        for await (const event of stream) {
            if (event.type === 'thinking') {
                console.log(`💭 [THINKING]: ${event.message}`);
            } else if (event.type === 'tool_call') {
                console.log(`🛠️ [TOOL]: ${event.tool} -> ${JSON.stringify(event.input)}`);
            } else if (event.type === 'tool_result') {
                console.log(`✅ [RESULT]: ${event.output ? event.output.substring(0, 50) + '...' : '(No output)'}`);
            } else if (event.type === 'done') {
                console.log(`\n⚡ [THE WILL SPEAKS]:\n${event.answer}\n`);
            }
        }
    } catch (e) {
        console.error('❌ Agent Execution Failed:', e);
    }

    // 4. Verify Output
    if (fs.existsSync('grace.txt')) {
        console.log('\n✅ FILE CREATED: grace.txt');
        console.log('--- CONTENT ---');
        console.log(fs.readFileSync('grace.txt', 'utf8'));
        console.log('----------------');
        // Cleanup
        fs.unlinkSync('grace.txt');
    } else {
        console.error('\n❌ FILE NOT CREATED. The Will failed to execute.');
    }

    await McpManager.getInstance().closeAll();
}

runDemo().catch(console.error);
