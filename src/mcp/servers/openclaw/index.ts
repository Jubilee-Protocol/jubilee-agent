
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Minimal MCP Server Implementation
// Bypasses SDK StdioServerTransport issues by handling JSON-RPC 2.0 manually over stdio.

const TOOLS = [
    {
        name: 'shell_execute',
        description: 'Execute a shell command on the host system.',
        inputSchema: {
            type: 'object',
            properties: {
                command: { type: 'string' },
                cwd: { type: 'string' }
            },
            required: ['command']
        }
    },
    {
        name: 'fs_read_file',
        description: 'Read the contents of a file.',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
        }
    },
    {
        name: 'fs_write_file',
        description: 'Write content to a file.',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' }, content: { type: 'string' } },
            required: ['path', 'content']
        }
    },
    {
        name: 'fs_list_directory',
        description: 'List contents of a directory.',
        inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
        }
    }
];

const ALLOWED_DIRS = [process.cwd()]; // Default to CWD if not configured

function validatePath(p: string) {
    const resolved = path.resolve(p);
    const isAllowed = ALLOWED_DIRS.some(dir => resolved.startsWith(path.resolve(dir)));
    if (!isAllowed) {
        throw new Error(`Access Denied: Path '${p}' is outside allowed directories.`);
    }
    return resolved;
}

async function handleToolCall(name: string, args: any) {
    // Basic Command Blacklist
    if (name === 'shell_execute') {
        const cmd = String(args?.command);
        if (cmd.includes('rm -rf /') || cmd.includes(':(){ :|:& };:')) { // Fork bomb
            throw new Error('Command Blocked: Potentially destructive command.');
        }
    }

    switch (name) {
        case 'shell_execute': {
            const cmd = String(args?.command);
            const cwd = args?.cwd ? validatePath(String(args?.cwd)) : process.cwd();
            const { stdout, stderr } = await execAsync(cmd, { cwd });
            return {
                content: [{ type: 'text', text: stdout || stderr || '(No output)' }]
            };
        }
        case 'fs_read_file': {
            const p = validatePath(String(args?.path));
            const content = await fs.promises.readFile(p, 'utf-8');
            return { content: [{ type: 'text', text: content }] };
        }
        case 'fs_write_file': {
            const p = validatePath(String(args?.path));
            await fs.promises.mkdir(path.dirname(p), { recursive: true });
            await fs.promises.writeFile(p, String(args?.content), 'utf-8');
            return { content: [{ type: 'text', text: `Wrote to ${p}` }] };
        }
        case 'fs_list_directory': {
            const p = validatePath(String(args?.path));
            const files = await fs.promises.readdir(p, { withFileTypes: true });
            const output = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`).join('\n');
            return { content: [{ type: 'text', text: output }] };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

async function handleRequest(request: any): Promise<any> {
    const { method, params, id, jsonrpc } = request;
    await fs.promises.appendFile('/tmp/openclaw_requests.log', JSON.stringify(request) + '\n');

    if (method === 'initialize') {
        return {
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'openclaw-local', version: '1.0.0' }
            }
        };
    }

    if (method === 'notifications/initialized') {
        return null; // Notification, no response
    }

    if (method === 'tools/list') {
        return {
            jsonrpc: '2.0',
            id,
            result: { tools: TOOLS }
        };
    }

    if (method === 'tools/call') {
        try {
            const result = await handleToolCall(params.name, params.arguments);
            return {
                jsonrpc: '2.0',
                id,
                result
            };
        } catch (e: any) {
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32000, message: e.message }
            };
        }
    }

    // Default unknown
    if (id) {
        return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' }
        };
    }
    return null;
}

// Start CLI loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
        const req = JSON.parse(line);
        const res = await handleRequest(req);
        if (res) {
            console.log(JSON.stringify(res));
        }
    } catch (e) {
        // silent failure or stderr
    }
});

console.error('OpenClaw (Tiny MCP) Started');
