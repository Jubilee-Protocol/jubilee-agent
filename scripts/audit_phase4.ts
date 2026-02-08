
import { BibleTool } from '../src/tools/bible.js';
import { CommunicationTool } from '../src/tools/communication.js';
import * as fs from 'fs';
import * as path from 'path';

async function auditPhase4() {
    console.log("🌐 Starting Phase 4 Audit: The Network");

    // 1. Test Bible Tool
    console.log("\n📖 Testing Bible Tool...");
    const bibleTool = new BibleTool();
    const verse = await bibleTool._call({ reference: "John 11:35", translation: "kjv" });
    console.log(`Result: ${verse}`);

    if (verse.includes("Jesus wept") || verse.includes("wept")) {
        console.log("✅ Bible Tool Passed");
    } else {
        console.error("❌ Bible Tool Failed");
    }

    // 2. Test Communication Tool
    console.log("\n📧 Testing Communication Tool...");
    const commTool = new CommunicationTool();
    const recipient = "Deacon_Steve";
    const result = await commTool._call({
        recipient,
        subject: "Coffee Duty",
        body: "Please ensure the coffee is ready by 9am.",
        tone: "Friendly"
    });
    console.log(`Result: ${result}`);

    // Verify file creation
    const draftsDir = path.join(process.cwd(), 'drafts');
    const files = fs.readdirSync(draftsDir);
    const draftFile = files.find(f => f.includes(recipient));

    if (result.includes("Draft saved") && draftFile) {
        console.log(`✅ Communication Tool Passed: Draft found at ${draftFile}`);
        // Cleanup
        fs.unlinkSync(path.join(draftsDir, draftFile));
    } else {
        console.error("❌ Communication Tool Failed");
    }
}

auditPhase4().catch(console.error);
