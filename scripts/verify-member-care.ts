
import { Agent } from '../src/agent/agent.js';
import { getToolsForRole } from '../src/tools/registry.js';
import { MemoryManager } from '../src/memory/index.js';
import { McpManager } from '../src/mcp/index.js';

async function verifyMemberCare() {
    console.log('--- Verifying Member Care Skill ---');

    await McpManager.getInstance().init([]);
    await MemoryManager.getInstance().init();

    // 1. Pre-seed memory (Context)
    console.log('1. Seeding memory...');
    await MemoryManager.getInstance().remember(
        "Sister Betty's husband is named Bob. They have been members for 20 years.",
        { tags: ["member_care", "profile"] }
    );

    // 2. Create Agent
    const tools = getToolsForRole('mind', 'gpt-5.2');
    // We are simulating the "Mind" handling a member care request.

    // 3. User Input
    const query = "Sister Betty is going in for hip surgery next Tuesday. Use the 'member-care' skill to help me handle this.";
    console.log(`User: "${query}"`);

    // Verify tools availability
    const skillTool = tools.find(t => t.name === 'skill');
    const memoryTool = tools.find(t => t.name === 'remember_fact');

    if (skillTool && memoryTool) {
        console.log('✅ Member Care tools present.');
    } else {
        console.error('❌ Missing tools.');
        process.exit(1);
    }

    // We confirm the infrastructure is ready for the agent to execute the SKILL.md instructions.
    console.log('✅ Member Care verification: Ready for manual test.');
}

verifyMemberCare().catch(e => {
    console.error(e);
    process.exit(1);
});
