
import { Agent } from '../src/agent/agent.js';
import { MemoryManager } from '../src/memory/index.js';
import * as dotenv from 'dotenv';
import { InMemoryChatHistory } from '../src/utils/in-memory-chat-history.js';

dotenv.config();

async function auditPhase3() {
    console.log("🧠 Starting Phase 3 Audit: The Chronicles (Active Recall)");

    const manager = MemoryManager.getInstance();

    // Mock Embeddings to bypass Ollama requirement
    const mockEmbeddings = {
        embedDocuments: async (texts: string[]) => texts.map(() => Array(1024).fill(0.1)),
        embedQuery: async (text: string) => Array(1024).fill(0.1)
    };
    manager.setEmbeddings(mockEmbeddings);

    await manager.init();

    // 1. Seed Memory
    const fact = "The user's favorite theologian is Augustine of Hippo.";
    console.log(`\n🌱 Seeding memory: "${fact}"`);
    await manager.remember(fact, { tags: ['audit', 'preference'] });

    // 2. Query Agent
    // We expect the agent to answer WITHOUT calling recall_memories because it should be in the context.
    console.log("\n❓ Asking Agent...");
    const query = "Who is my favorite theologian?";

    // We use a simplified config to avoid full tool loading overhead if not needed, 
    // but we need the agent to BE the agent.
    const agent = Agent.create({ model: 'gemini-2.0-flash' });
    const history = new InMemoryChatHistory();

    let answered = false;
    for await (const event of agent.run(query, history)) {
        if (event.type === 'thinking') {
            console.log(`[Thinking]: ${event.message}`);
        }
        if (event.type === 'tool_start') {
            console.log(`[Tool]: ${event.tool}`);
            if (event.tool === 'recall_memories') {
                console.warn("⚠️ Warning: Agent used recall_memories tool. Active Recall might not have been sufficient or prioritized.");
            }
        }
        if (event.type === 'done') {
            console.log(`\n✅ Answer: ${event.answer}`);
            if (event.answer.includes("Augustine")) {
                console.log("🎉 SUCCESS: Agent retrieved the memory!");
            } else {
                console.error("❌ FAILURE: Agent did not retrieve the memory.");
            }
            answered = true;
        }
    }
}

auditPhase3().catch(console.error);
