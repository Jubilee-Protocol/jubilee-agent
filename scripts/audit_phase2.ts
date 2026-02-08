
import { DispatchAngelTool } from '../src/tools/angel-tool.js';
import * as dotenv from 'dotenv';
import { Agent } from '../src/agent/agent.js';

dotenv.config();

async function auditPhase2() {
    console.log("🔍 Starting Phase 2 Audit: School of Prophets");

    const angelTool = new DispatchAngelTool();

    // Test Case 1: Sermon Research
    console.log("\n🧪 Test Case 1: Sermon Research Capability");
    const mission1 = "Research a sermon brief for Psalm 23:1 using the sermon-research skill. Start by reading https://www.biblegateway.com/passage/?search=Psalm+23&version=NIV using the browser.";

    try {
        const result1 = await angelTool._call({
            name: "Audit_Research_Angel",
            mission: mission1,
            capabilities: ['skill', 'web_search', 'browser', 'recall_memories', 'remember_fact'],
            skill_focus: 'sermon-research',
            iterations: 5
        });
        console.log("✅ Result 1:", result1);
    } catch (e) {
        console.error("❌ Test 1 Failed:", e);
    }

    // Test Case 2: Member Care
    console.log("\n🧪 Test Case 2: Member Care Capability");
    const mission2 = "Draft a follow-up text for Mrs. Jones who just had surgery, using the member-care skill.";
    try {
        const result2 = await angelTool._call({
            name: "Audit_Care_Angel",
            mission: mission2,
            capabilities: ['skill', 'remember_fact', 'recall_memories'],
            skill_focus: 'member-care',
            iterations: 5
        });
        console.log("✅ Result 2:", result2);
    } catch (e) {
        console.error("❌ Test 2 Failed:", e);
    }
}

auditPhase2().catch(console.error);
