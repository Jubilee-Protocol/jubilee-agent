
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { MemoryManager } from "../memory/index.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Scan directory recursively and return list of file paths.
 */
function scanDirectory(dir: string, extensions: string[] = ['.ts', '.tsx', '.md', '.sol', '.rs']): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'data') {
                results = results.concat(scanDirectory(filePath, extensions));
            }
        } else {
            const ext = path.extname(file);
            if (extensions.includes(ext)) {
                results.push(filePath);
            }
        }
    }
    return results;
}

export class IngestCodebaseTool extends StructuredTool {
    name = "ingest_codebase";
    description = "System Tool: Scans the entire codebase, chunks it, and creates embeddings for semantic search. Use this when the user asks to 'learn the code' or 'index the repo'.";
    schema = z.object({
        force: z.boolean().optional().describe("Force re-ingestion of all files"),
    });

    async _call({ force }: { force?: boolean }): Promise<string> {
        const rootDir = process.cwd();
        // Target specific directories for relevance
        const targetDirs = ['src', 'scripts', 'programs', 'contracts', 'docs'];

        console.log("📚 Starting Codebase Ingestion...");
        const memory = MemoryManager.getInstance();
        await memory.init();

        // We use a separate 'collection' or namespace via tags if possible, 
        // but MemoryManager is currently single-table.
        // We will just tag them as 'code_context'.

        let files: string[] = [];
        for (const dir of targetDirs) {
            files = files.concat(scanDirectory(path.join(rootDir, dir)));
        }

        console.log(`📚 Found ${files.length} files to process.`);

        let count = 0;
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                // Simple chunking by lines for now, or whole file if small.
                // Better: Split by function/class logic if we had a parser.
                // Fallback: Split by max char length (e.g. 2000 chars) with overlap.

                const relativePath = path.relative(rootDir, file);

                // Skip large files or generated files
                if (content.length > 50000) continue;

                // Tag properly
                const metadata = {
                    type: 'code_context',
                    filepath: relativePath,
                    language: path.extname(file).substring(1),
                    last_modified: fs.statSync(file).mtimeMs
                };

                // Store content
                // We add the filename/path to the text for better embedding context
                const textToEmbed = `File: ${relativePath}\n\n${content}`;

                await memory.remember(textToEmbed, { ...metadata, tags: ['code_context'] });
                count++;

                if (count % 10 === 0) console.log(`   Indexed ${count}/${files.length} files...`);

            } catch (e) {
                console.warn(`   Skipped ${file}: ${e}`);
            }
        }

        return `✅ Codebase Ingestion Complete. Indexed ${count} files. The Mind now has deep context.`;
    }
}

export class SearchCodebaseTool extends StructuredTool {
    name = "search_codebase";
    description = "System Tool: Semantically search the codebase for logic, patterns, or definitions. Use this to answer 'how does X work?' or 'find the code for Y'.";
    schema = z.object({
        query: z.string().describe("Natural language query describing the code or logic you are looking for."),
        limit: z.number().optional().default(5)
    });

    async _call({ query, limit }: { query: string, limit: number }): Promise<string> {
        const memory = MemoryManager.getInstance();
        const results = await memory.recall(query, limit);

        // Filter results? No, let the vector search do its job.
        // Format for LLM
        if (results.length === 0) return "No relevant code found.";

        return results.map(r => {
            const meta = r.metadata || {};
            return `--- [File: ${meta.filepath || 'unknown'}] ---\n${r.text.substring(0, 3000)}\n`;
        }).join('\n\n');
    }
}
