
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export class BibleTool extends StructuredTool {
    name = 'bible_lookup';
    description = 'Look up scripture passages from the Bible. Supports various translations (KJV, WEB, etc.). Use this for accurate quoting of verses.';
    schema = z.object({
        reference: z.string().describe('The reference to look up (e.g., "John 3:16", "Psalm 23").'),
        translation: z.string().optional().default('web').describe('The translation to use (default: web). Options: web, kjv, bbe.'),
    });

    async _call(arg: { reference: string, translation?: string }): Promise<string> {
        try {
            // Encode the reference
            const ref = encodeURIComponent(arg.reference);
            const translation = arg.translation || 'web';

            // bible-api.com API
            const response = await fetch(`https://bible-api.com/${ref}?translation=${translation}`);

            if (!response.ok) {
                return `Error: Could not find passage "${arg.reference}". Status: ${response.status}`;
            }

            const data = await response.json();

            let text = `**${data.reference}**\n`;
            for (const verse of data.verses) {
                text += `[${verse.verse}] ${verse.text}\n`;
            }
            text += `\n(Translation: ${data.translation_name})`;

            return text;
        } catch (error) {
            return `Bible lookup failed: ${error}`;
        }
    }
}
