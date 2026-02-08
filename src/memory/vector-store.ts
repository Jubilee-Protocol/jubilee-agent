
import * as lancedb from '@lancedb/lancedb';
import { OllamaEmbeddings } from '@langchain/ollama';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

// Interface for a memory entry
export interface MemoryEntry {
    id: string;
    text: string;
    vector: number[];
    metadata: string; // JSON string
    created_at: number;
}

export class MemoryManager {
    private static instance: MemoryManager;
    private db: lancedb.Connection | null = null;
    private table: lancedb.Table | null = null;
    private embeddings: OllamaEmbeddings;
    private dbPath: string;
    private tableName = 'memories';

    private constructor() {
        this.dbPath = path.resolve(process.cwd(), 'data', 'lancedb');

        // Ensure data directory exists
        if (!fs.existsSync(path.dirname(this.dbPath))) {
            fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        }

        // Initialize generic embeddings (using mxbai-embed-large or similar if available, else llama3)
        // We assume the user has a model. 'nomic-embed-text' is great but 'llama3' works too.
        // We'll default to 'mxbai-embed-large' as it's a standard for local RAG, 
        // but fall back to the config model if needed. 
        // For now, let's use 'nomic-embed-text' as the default strictly for embeddings if available,
        // otherwise let's just use the main model.
        // Safest bet for generic setup: use the main model to avoid "model not found" errors, 
        // OR allow config. 
        // Let's use 'all-minilm' or similar if the user has it, but default to 'llama3.2' (small) or 'llama3'.
        // Actually, asking the user to pull 'nomic-embed-text' is best practice.
        this.embeddings = new OllamaEmbeddings({
            model: 'mxbai-embed-large', // Standard open source embedding model
            baseUrl: 'http://localhost:11434',
        });
    }

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    async init() {
        if (this.db) return;

        try {
            this.db = await lancedb.connect(this.dbPath);

            const existingTables = await this.db.tableNames();

            if (existingTables.includes(this.tableName)) {
                this.table = await this.db.openTable(this.tableName);
            } else {
                // Create table with empty data compliant with schema
                // LanceDB infers schema from the first batch or provided schema.
                // We'll insert a dummy record and then delete it, or define schema if feasible in JS client.
                // JS client schema definition is a bit loose.
                // Let's try creating with a dummy record.
                const dummy: MemoryEntry = {
                    id: 'init',
                    text: 'init',
                    vector: Array(1024).fill(0), // mxbai is 1024. llama2 is 4096. This is risky.
                    // Architecture Change: We should fetch dimensionality dynamically.
                    // But for now, let's assume 1024 (mxbai).
                    // If we use 'llama3', it's 4096. 
                    // Let's lazy load the table on first add to get dimensionality correct.
                    metadata: '{}',
                    created_at: Date.now()
                };
                // actually, we can't easily validte dimensionality without running the model.
                // Let's defer creation to the first add.
            }
            console.log(`🧠 MemoryManager: Connected to ${this.dbPath}`);
        } catch (error) {
            console.error('🧠 MemoryManager Error:', error);
        }
    }

    /**
     * Store a text in long-term memory.
     */
    async remember(text: string, metadata: Record<string, any> = {}): Promise<string> {
        if (!this.db) await this.init();

        try {
            // 1. Generate embedding
            const vectors = await this.embeddings.embedDocuments([text]);
            const vector = vectors[0];

            // 2. Prepare entry
            const entry: MemoryEntry = {
                id: uuidv4(),
                text,
                vector,
                metadata: JSON.stringify(metadata),
                created_at: Date.now(),
            };

            // 3. Insert
            if (!this.table) {
                // First time creation, infer schema from entry
                this.table = await this.db!.createTable(this.tableName, [entry as any]);
            } else {
                await this.table.add([entry as any]);
            }

            return entry.id;
        } catch (e) {
            console.error('Failed to store memory', e);
            throw e;
        }
    }

    /**
     * Search for memories.
     */
    async recall(query: string, limit: number = 5): Promise<{ text: string, score: number, metadata: any }[]> {
        if (!this.db) await this.init();
        if (!this.table) return []; // No memories yet

        try {
            const queryVector = await this.embeddings.embedQuery(query);

            const results = await this.table.search(queryVector)
                .limit(limit)
                .toArray();

            return results.map((r: any) => ({
                text: r.text,
                score: 0, // LanceDB JS client might not return score in all versions easily, need to check
                // standard vector search returns distance usually. 
                metadata: JSON.parse(r.metadata || '{}')
            }));
        } catch (e) {
            console.error('Failed to recall memories', e);
            return [];
        }
    }
}
