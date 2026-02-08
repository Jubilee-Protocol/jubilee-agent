
import { IngestCodebaseTool, SearchCodebaseTool } from '../src/tools/codebase-tools.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('🧠 Testing Deep Code Context Tools...');

    try {
        // 1. Test Ingestion (dry run logic isn't explicit in tool, but we'll run it)
        console.log('\n--- Testing IngestCodebaseTool ---');
        const ingestTool = new IngestCodebaseTool();
        // We'll trust it handles incremental updates. 
        // Passing force: false to avoid full re-index if possible, 
        // though the tool implementation determines behavior.
        const ingestResult = await ingestTool.invoke({ force: false });
        console.log('Ingest Result:', ingestResult);

        // 2. Test Search
        console.log('\n--- Testing SearchCodebaseTool ---');
        const searchTool = new SearchCodebaseTool();
        const query = "How does the Treasury Server handling signing?";
        console.log(`Searching for: "${query}"`);
        const searchResult = await searchTool.invoke({ query, limit: 3 });
        console.log('Search Result:', searchResult);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

main();
