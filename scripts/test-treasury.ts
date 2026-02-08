
import { TreasuryServer } from '../src/mcp/servers/treasury/index.js';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';
config();

async function main() {
    console.log('💰 Testing Treasury Server (The Almoner)...');

    const server = TreasuryServer.getInstance();
    await server.init();

    const tools = server.getTools();
    console.log(`✅ Treasury Initialized. Found ${tools.length} tools.`);

    if (tools.length > 0) {
        console.log('\n--- Available Tools ---');
        tools.forEach(t => console.log(`- ${t.name}: ${t.description.slice(0, 60)}...`));
    } else {
        console.error('❌ No tools found. Check CDP credentials.');
    }

    // AgentKit doesn't easily expose the wallet address synchronously after init in this wrapper 
    // without calling a tool or inspecting the private agentKit instance.
    // But our init() logs it.
}

main().catch(console.error);
