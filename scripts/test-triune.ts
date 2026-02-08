
import { TriuneAgent } from '../src/agent/triune-agent.js';
import { InMemoryChatHistory } from '../src/utils/in-memory-chat-history.js';
import { DoneEvent } from '../src/agent/types.js';
import { config } from 'dotenv';
import path from 'path';

// Load .env
config({ path: path.resolve(process.cwd(), '.env') });

function detectModel(): string {
    // Check CLI arg first
    const argModel = process.argv.find(arg => arg.startsWith('--model='));
    if (argModel) {
        return argModel.split('=')[1];
    }

    // Auto-detect based on available keys
    if (process.env.ANTHROPIC_API_KEY) return 'claude-3-opus-20240229';
    if (process.env.GOOGLE_API_KEY) return 'gemini-2.0-flash';
    if (process.env.OPENAI_API_KEY) return 'gpt-5.2';
    if (process.env.XAI_API_KEY) return 'grok-1';
    if (process.env.OPENROUTER_API_KEY) return 'openrouter:openai/gpt-4o';

    // Default fallback
    console.warn("⚠️  No API keys found in .env. Defaulting to 'gpt-5.2' (OpenAI). Expect failure if no key is set.");
    return 'gpt-5.2';
}

async function main() {
    const queryArg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : "Should I invest in memecoins?";
    const model = detectModel();

    console.log(`\n🤖 Jubilee Triune Agent Test`);
    console.log(`Query: "${queryArg}"`);
    console.log(`Model: ${model}`);
    console.log(`-----------------------------------`);

    const agent = TriuneAgent.create({ model });
    const history = new InMemoryChatHistory();

    try {
        const stream = agent.run(queryArg, history);

        for await (const event of stream) {
            if (event.type === 'thinking') {
                process.stdout.write(`\n🧠 ${event.message}\n`);
            } else if (event.type === 'tool_start') {
                process.stdout.write(`🛠️  [${event.tool}] `);
            } else if (event.type === 'tool_end') {
                process.stdout.write(`✅\n`);
            } else if (event.type === 'tool_error') {
                process.stdout.write(`❌ Error: ${event.error}\n`);
            } else if (event.type === 'done') {
                const doneEvent = event as DoneEvent;
                console.log(`\n-----------------------------------\n🏁 FINAL ANSWER:\n\n${doneEvent.answer}\n`);
                console.log(`Iterations: ${doneEvent.iterations}`);
                console.log(`Time: ${(doneEvent.totalTime / 1000).toFixed(2)}s`);
            }
        }
    } catch (error) {
        console.error("Fatal Error:", error);
    }
}

main();
