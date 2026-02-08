
import { McpManager } from '../src/mcp/index.js';
import * as fs from 'fs';
import * as path from 'path';

async function verifyOpenClaw() {
    console.log('--- Verifying OpenClaw (System MCP) ---');

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

    // Initialize
    console.log('1. Connecting to Local OpenClaw Server...');
    const manager = McpManager.getInstance();
    await manager.init(mcpConfig);

    // Get Tools
    const tools = manager.getTools();
    console.log(`2. Discovered ${tools.length} MCP tools.`);
    const shellTool = tools.find(t => t.name === 'shell_execute');
    const fsTool = tools.find(t => t.name === 'fs_list_directory');

    if (!shellTool || !fsTool) {
        console.error('❌ Missing OpenClaw tools (shell_execute or fs_list_directory).');
        process.exit(1);
    } else {
        console.log('✅ OpenClaw tools found.');
    }

    // Execute Shell Command
    console.log('3. Testing Shell Execution...');
    try {
        const result = await shellTool.call({ command: 'echo "Hello from The Will"' });
        console.log(`Command Output: ${result}`);
        if (result.includes('Hello from The Will')) {
            console.log('✅ Shell Execution Successful.');
        } else {
            console.error('❌ Shell Execution yielded unexpected output.');
            process.exit(1);
        }
    } catch (e) {
        console.error(`❌ Execution Failed: ${e}`);
        process.exit(1);
    }

    // Cleanup
    await manager.closeAll();
}

verifyOpenClaw().catch(e => {
    console.error(e);
    process.exit(1);
});
