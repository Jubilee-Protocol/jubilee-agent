import { OpenAIEmbeddings } from '@langchain/openai';
import { db } from '../db/index.js';
import { memories } from '../db/schema.js';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class MemoryManager {
    private static instance: MemoryManager;
    private embeddings: OpenAIEmbeddings;
    private isOnline = true;

    private constructor() {
        this.embeddings = new OpenAIEmbeddings({
            modelName: 'text-embedding-3-small',
        });
    }

    // For testing/mocking
    public setEmbeddings(embeddings: any) {
        this.embeddings = embeddings;
    }

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    async init() {
        // DB connection is handled by src/db/index.ts singleton.
        // We can just verify it works here if needed.
        console.log('🧠 MemoryManager (Postgres): Initialized.');
    }

    async remember(text: string, metadata: Record<string, any> = {}): Promise<string> {
        try {
            console.log(`🧠 Memorizing: "${text.slice(0, 30)}..."`);
            const embedding = await this.embeddings.embedQuery(text);

            const result = await db.insert(memories).values({
                content: text,
                source: metadata.source || 'user',
                embedding,
            }).returning({ id: memories.id });

            return result[0].id.toString();
        } catch (e) {
            console.error('Failed to remember:', e);
            return 'error';
        }
    }

    async recall(query: string, limit: number = 5): Promise<{ id: number, text: string, score: number, metadata: any }[]> {
        try {
            const queryVector = await this.embeddings.embedQuery(query);

            const similarity = sql<number>`1 - (${cosineDistance(memories.embedding, queryVector)})`;

            const results = await db.select({
                id: memories.id,
                text: memories.content,
                source: memories.source,
                score: similarity
            })
                .from(memories)
                .where(gt(similarity, 0.7))
                .orderBy(desc(similarity))
                .limit(limit);

            if (results.length > 0) {
                console.log(`🧠 Recalled ${results.length} memories.`);
            }

            return results.map(r => ({
                id: r.id,
                text: r.text,
                score: r.score,
                metadata: { source: r.source }
            }));
        } catch (e) {
            console.error('Failed to recall:', e);
            return [];
        }
    }

    async forget(id: number): Promise<boolean> {
        try {
            console.log(`🧠 Forgetting memory ID: ${id}`);
            await db.delete(memories).where(eq(memories.id, id));
            return true;
        } catch (e) {
            console.error('Failed to forget:', e);
            return false;
        }
    }
}
