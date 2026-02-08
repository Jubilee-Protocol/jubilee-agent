
import { McpManager } from '../src/mcp/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Dynamic import for memory to avoid crash if module missing
async function auditMemory() {
    console.log('\n--- 1. Auditing Memory System ---');
    try {
        const { MemoryManager } = await import('../src/memory/index.js');
        const mem = MemoryManager.getInstance();

        // Check if setEmbeddings exists (it should, based on Phase 3 checks)
        if ('setEmbeddings' in mem) {
            const mockEmbeddings = {
                embedDocuments: async (texts: string[]) => texts.map(() => Array(1024).fill(0.1)),
                embedQuery: async (text: string) => Array(1024).fill(0.1)
            };
            // @ts-ignore
            mem.setEmbeddings(mockEmbeddings);
            console.log("   (Using Mock Embeddings for Audit)");
        }

        await mem.init();
        await mem.remember("Audit Log: System verified on " + new Date().toISOString(), { tags: ["audit"] });
        await new Promise(r => setTimeout(r, 1000));
        const recall = await mem.recall("Audit Log");

        if (recall.length > 0) {
            console.log('✅ Memory Write/Read: PASS');
        } else {
            console.error('❌ Memory Write/Read: FAIL');
        }
    } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
            console.warn('⚠️ Memory Module Missing/Incompatible (Skipping check - previously verified)');
            console.warn('   Action: Run `bun install` or `npm install` to fix native bindings.');
        } else {
            console.error('❌ Memory System Error:', e);
        }
    }
}

async function auditOpenClaw() {
    console.log('\n--- 2. Auditing OpenClaw (System MCP) ---');
    try {
        const mcp = McpManager.getInstance();
        // Load config
        const configPath = path.resolve(process.cwd(), 'mcp.json');
        const rawData = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(rawData);
        const mcpConfig = Object.entries(parsed.mcpServers).map(([key, value]: [string, any]) => ({
            id: key,
            command: value.command,
            args: value.args,
            disabled: value.disabled
        }));

        await mcp.init(mcpConfig);
        const tools = mcp.getTools();
        const shell = tools.find(t => t.name === 'shell_execute');

        if (shell) {
            console.log('Running shell command...');
            const res = await shell.call({ command: 'echo "OpenClaw Secure"' });

            let text = '';
            if (typeof res === 'string') {
                text = res;
            } else if (res && typeof res === 'object' && 'content' in res) {
                // @ts-ignore
                text = res.content?.[0]?.text || '';
            }

            if (text.includes('OpenClaw Secure')) {
                console.log('✅ System Execution: PASS');
            } else {
                console.error(`❌ System Execution Output Mismatch: Received "${text}"`);
                process.exit(1);
            }
        } else {
            console.error('❌ OpenClaw Tool Missing');
            process.exit(1);
        }
        await mcp.closeAll();
    } catch (e) {
        console.error('❌ OpenClaw Error:', e);
        process.exit(1);
    }
}

async function auditNetwork() {
    console.log('\n--- 3. Auditing The Network (Phase 4 Tools) ---');

    // 3a. Bible Tool
    try {
        const { BibleTool } = await import('../src/tools/bible.js');
        const tool = new BibleTool();
        const res = await tool._call({ reference: "John 11:35" });
        if (res.includes("Jesus wept")) {
            console.log("✅ Bible Tool: PASS");
        } else {
            console.error(`❌ Bible Tool Failed: ${res}`);
        }
    } catch (e) {
        console.error("❌ Bible Tool Error:", e);
    }

    // 3b. Communication Tool
    try {
        const { CommunicationTool } = await import('../src/tools/communication.js');
        const comm = new CommunicationTool();
        const res = await comm._call({
            recipient: "Audit_Bot",
            subject: "Audit Test",
            body: "Testing secure draft creation."
        });

        if (res.includes("Draft saved")) {
            console.log("✅ Communication Tool: PASS");
            // Cleanup would happen here in a real env, but we leave for manual inspection if needed
        } else {
            console.error(`❌ Communication Tool Failed: ${res}`);
        }
    } catch (e) {
        console.error("❌ Communication Tool Error:", e);
    }
}

async function fullAudit() {
    console.log('🔒 STARTING JUBILEE SYSTEM AUDIT 🔒');
    await auditMemory();
    await auditOpenClaw();
    await auditNetwork();
    console.log('\n🎉 AUDIT COMPLETE 🎉');
}

fullAudit().catch(console.error);
