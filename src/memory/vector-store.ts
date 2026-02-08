
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

    // For testing/mocking
    setEmbeddings(embeddings: any) {
        this.embeddings = embeddings;
    }

    private isOnline = true; // Assume online until proven otherwise
    private hasCheckedConnection = false;

    async init() {
        if (this.hasCheckedConnection && !this.isOnline) return;
        if (this.db) return;

        // 0. Fast Connectivity Check (3s timeout)
        if (!this.hasCheckedConnection) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const response = await fetch('http://localhost:11434', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error("Ollama returned non-200");
                this.hasCheckedConnection = true;
            } catch (e) {
                console.warn(`⚠️ MemoryManager: Ollama (localhost:11434) is unreachable. Disabling memory features.`);
                this.isOnline = false;
                this.hasCheckedConnection = true;
                return;
            }
        }

        try {
            this.db = await lancedb.connect(this.dbPath);

            const existingTables = await this.db.tableNames();

            if (existingTables.includes(this.tableName)) {
                this.table = await this.db.openTable(this.tableName);
            } else {
                // Defer creation to first add
            }
            console.log(`🧠 MemoryManager: Connected to ${this.dbPath}`);
        } catch (error) {
            console.error('🧠 MemoryManager Error:', error);
            this.isOnline = false;
        }
    }

    /**
     * Store a text in long-term memory.
     */
    async remember(text: string, metadata: Record<string, any> = {}): Promise<string> {
        if (!this.db) await this.init();
        if (!this.isOnline) return "Memory Offline";

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
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED' || e.message?.includes('ConnectionRefused')) {
                console.warn('⚠️ Memory Manager: Ollama offline. Skipping memory storage.');
                return 'skipped-offline';
            }
            console.error('Failed to store memory', e);
            throw e;
        }
    }

    /**
     * Search for memories.
     */
    async recall(query: string, limit: number = 5): Promise<{ text: string, score: number, metadata: any }[]> {
        if (!this.db) await this.init();
        if (!this.isOnline) return [];
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
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED' || e.message?.includes('ConnectionRefused')) {
                console.warn('⚠️ Memory Manager: Ollama offline. Skipping memory recall.');
                return [];
            }
            console.error('Failed to recall memories', e);
            return [];
        }
    }
}
