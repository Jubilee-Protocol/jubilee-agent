import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { db, isDbAvailable } from '../db/index.js';
import { memories } from '../db/schema.js';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { Embeddings } from '@langchain/core/embeddings';
import { logger } from '../utils/logger.js';

export class MemoryManager {
    private static instance: MemoryManager;
    private embeddings: Embeddings;
    private isOnline = true;

    private constructor() {
        const provider = process.env.EMBEDDING_PROVIDER || 'openai';

        if (provider === 'ollama') {
            logger.info("🧠 MemoryManager: Using Ollama for embeddings");
            this.embeddings = new OllamaEmbeddings({
                model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            });
        } else if (provider === 'google') {
            logger.info("🧠 MemoryManager: Using Google for embeddings");
            this.embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: "embedding-001", // or text-embedding-004
                apiKey: process.env.GOOGLE_API_KEY,
            });
        } else {
            logger.info("🧠 MemoryManager: Using OpenAI for embeddings");
            this.embeddings = new OpenAIEmbeddings({
                modelName: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
                openAIApiKey: process.env.OPENAI_API_KEY,
            });
        }
    }

    // For testing/mocking
    public setEmbeddings(embeddings: Embeddings) {
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
        logger.info('🧠 MemoryManager (Postgres): Initialized.');
    }

    async remember(text: string, metadata: Record<string, any> = {}): Promise<string> {
        if (!(await isDbAvailable())) {
            logger.debug('🧠 DB unavailable — memory not persisted.');
            return 'offline';
        }
        try {
            logger.debug(`🧠 Memorizing: "${text.slice(0, 30)}..."`);
            const embedding = await this.embeddings.embedQuery(text);

            const result = await db.insert(memories).values({
                content: text,
                source: metadata.source || 'user',
                embedding,
            }).returning({ id: memories.id });

            return result[0].id.toString();
        } catch (e) {
            logger.error('Failed to remember:', e);
            return 'error';
        }
    }

    async recall(query: string, limit: number = 5): Promise<{ id: number, text: string, score: number, metadata: any }[]> {
        if (!(await isDbAvailable())) {
            return [];
        }
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
                logger.debug(`🧠 Recalled ${results.length} memories.`);
            }

            return results.map(r => ({
                id: r.id,
                text: r.text,
                score: r.score,
                metadata: { source: r.source }
            }));
        } catch (e) {
            logger.error('Failed to recall:', e);
            return [];
        }
    }

    async forget(id: number): Promise<boolean> {
        if (!(await isDbAvailable())) {
            return false;
        }
        try {
            logger.debug(`🧠 Forgetting memory ID: ${id}`);
            await db.delete(memories).where(eq(memories.id, id));
            return true;
        } catch (e) {
            logger.error('Failed to forget:', e);
            return false;
        }
    }
}
