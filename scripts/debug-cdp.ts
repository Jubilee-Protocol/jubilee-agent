
import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    console.log("🔍 Debugging CDP Auth...");

    const name = process.env.CDP_API_KEY_NAME || "";
    const key = process.env.CDP_API_KEY_PRIVATE_KEY || "";

    console.log(`Name: ${name}`);
    console.log(`Key (first 10 chars): ${key.substring(0, 10)}...`);

    // Try 1: Name as Key ID, Key as Secret (likely fail if name is not UUID)
    try {
        console.log("\n--- Attempt 1: Name as ID, Key as Secret ---");
        const client = new CdpClient({
            apiKeyId: name,
            apiKeySecret: key,
            walletSecret: "random_seed_string_for_testing_wallet_creation_123"
        });
        // Try to fetch something simple
        const user = await client.user.getCurrent();
        console.log("✅ Success! User:", user);
    } catch (e) {
        console.log("❌ Failed:", e.message);
    }

    // Try 2: Key as ID? (If key is UUID)
    // But then what is secret?

    // Try 3: Maybe config expects specific JSON?

    // Check if CdpClient supports old style (apiKeyName, apiKeyPrivateKey)
    try {
        console.log("\n--- Attempt 3: apiKeyName / apiKeyPrivateKey properties ---");
        // @ts-ignore
        const client = new CdpClient({
            apiKeyName: name,
            apiKeyPrivateKey: key.replace(/\\n/g, "\n"),
            walletSecret: "random_seed_string_for_testing_wallet_creation_123"
        });
        // @ts-ignore
        const user = await client.user.getCurrent();
        console.log("✅ Success! User:", user);
    } catch (e) {
        console.log("❌ Failed:", e.message);
    }

}

main().catch(console.error);
