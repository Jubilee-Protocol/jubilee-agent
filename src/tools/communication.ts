
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export class CommunicationTool extends StructuredTool {
    name = 'draft_email';
    description = 'Draft an email or message for a member. This tool DOES NOT SEND emails; it saves a draft file for review.';
    schema = z.object({
        recipient: z.string().describe('Name of the recipient.'),
        subject: z.string().describe('Subject line.'),
        body: z.string().describe('The body of the message.'),
        tone: z.string().optional().describe('Tone of the message (e.g. "compassionate", "formal").'),
    });

    private lastDraftTime: number = 0;

    async _call(arg: { recipient: string, subject: string, body: string, tone?: string }): Promise<string> {
        // 1. Rate Limiting (Anti-Spam)
        const now = Date.now();
        if (now - this.lastDraftTime < 30000) { // 30 seconds wait
            return "⛔ RATE LIMIT: You are drafting too fast. Please wait 30 seconds.";
        }
        this.lastDraftTime = now;

        // 2. Content Filtering (Anti-Abuse)
        const abusiveKeywords = ['hate', 'idiot', 'stupid', 'incompetent', 'useless', 'kill', 'die'];
        const fullText = `${arg.subject} ${arg.body}`.toLowerCase();
        if (abusiveKeywords.some(kw => fullText.includes(kw))) {
            return "⛔ CONTENT BLOCKED: Abusive or harmful language detected.";
        }

        try {
            const draftsDir = path.join(process.cwd(), 'drafts');
            if (!fs.existsSync(draftsDir)) {
                fs.mkdirSync(draftsDir, { recursive: true });
            }

            const filename = `${arg.recipient.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
            const filepath = path.join(draftsDir, filename);

            const content = `TO: ${arg.recipient}
SUBJECT: ${arg.subject}
TONE: ${arg.tone || 'Neutral'}
DATE: ${new Date().toISOString()}

----------------------------------------
${arg.body}
----------------------------------------
`;

            fs.writeFileSync(filepath, content);

            return `✅ Draft saved successfully to: drafts/${filename}\nPlease review and send manually.`;
        } catch (error) {
            return `Failed to save draft: ${error}`;
        }
    }
}
