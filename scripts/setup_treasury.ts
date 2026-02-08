
import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Load existing env for defaults
dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};

async function main() {
    console.log("\n🏦 Jubilee Treasury Setup (The Almoner)");
    console.log("=======================================\n");

    console.log("This script will help you configure the Coinbase Developer Platform (CDP) keys");
    console.log("required for the Treasury module. It handles key formatting automatically.\n");

    // 1. Get API Key Name
    const defaultName = process.env.CDP_API_KEY_NAME || "";
    let apiKeyName = await question(`Enter CDP_API_KEY_NAME [${defaultName}]: `);
    if (!apiKeyName) apiKeyName = defaultName;

    // 2. Get Private Key
    console.log("\nPaste your CDP_API_KEY_PRIVATE_KEY (JSON format or raw PEM).");
    console.log("If it starts with '-----BEGIN EC PRIVATE KEY-----', we will convert it.");
    console.log("Press ENTER twice when done pasting:");

    let privateKeyLines: string[] = [];
    let readingKey = true;

    // Read multiline input
    // Note: Simple readline doesn't handle multiline easy, asking user to provide it as one block or use a temp file might be safer.
    // Let's assume standard paste behavior.

    const privateKeyRaw = await question("Paste Key Here: ");
    // Wait, pasting a PEM block into a single readline input is flaky.
    // Better approach: Ask user to paste it into a file OR paste the "One Line" string if they have it.
    // Or just accept the path to the downloaded JSON file.

    console.log("\n(Tip: You can also pass the path to your downloaded `cdp_api_key.json` file)");
    let privateKeyInput = privateKeyRaw.trim();

    if (privateKeyInput.endsWith(".json") && fs.existsSync(privateKeyInput)) {
        console.log(`Reading from ${privateKeyInput}...`);
        const jsonContent = JSON.parse(fs.readFileSync(privateKeyInput, 'utf8'));
        // Try to find the private key field
        apiKeyName = jsonContent.name || apiKeyName; // Auto-detect name
        privateKeyInput = jsonContent.privateKey;
    }

    // 3. Format the Key (EC -> PKCS#8)
    let pkcs8Key = privateKeyInput;

    // Handle escaped newlines if user pasted single line
    if (pkcs8Key.includes('\\n')) {
        pkcs8Key = pkcs8Key.replace(/\\n/g, '\n');
    }

    if (pkcs8Key.includes("BEGIN EC PRIVATE KEY")) {
        console.log("\n⚠️  Detected SEC1 'EC PRIVATE KEY' format.");
        console.log("🔄 Converting to PKCS#8 format required by AgentKit...");

        try {
            const tempFile = 'temp_setup_key.pem';
            fs.writeFileSync(tempFile, pkcs8Key);
            pkcs8Key = execSync(`openssl pkcs8 -topk8 -nocrypt -in ${tempFile}`).toString();
            fs.unlinkSync(tempFile);
            console.log("✅ Conversion successful.");
        } catch (e: any) {
            console.error("❌ Conversion failed. Ensure you have 'openssl' installed.", e.message);
            process.exit(1);
        }
    }

    // 4. Get Wallet Secret
    // Prompt specific instruction about where to find it
    console.log("\n🔐 Wallet Secret (Required for Managed Wallets)");
    console.log("Found in CDP Portal -> Wallets -> 'Seed Phrase' or 'Wallet Secret'.");
    console.log("Currently strictly required.");

    const defaultSecret = process.env.CDP_WALLET_SECRET || "";
    let walletSecret = await question(`Enter CDP_WALLET_SECRET [${defaultSecret ? '(Hidden)' : ''}]: `);
    if (!walletSecret && defaultSecret) walletSecret = defaultSecret;

    // 5. Verify Configuration
    console.log("\n🧪 Verifying Configuration with Coinbase...");

    const config = {
        apiKeyName: apiKeyName,
        apiKeySecret: pkcs8Key,
        walletSecret: walletSecret,
        networkId: 'base-mainnet' // Verify on mainnet or user choice? Let's use sepolia for safety verify? No, verifying mainnet connection is okay.
    };

    try {
        const cdp = new CdpClient(config);
        const account = await cdp.evm.createAccount(); // This gets existing or creates new
        console.log(`✅ Success! Connected to Wallet: ${account.address}`);
    } catch (e: any) {
        console.error(`❌ Verification Failed: ${e.message}`);
        console.log("Please check your Wallet Secret.");
        rl.close();
        return;
    }

    // 6. Output .env Snippet
    console.log("\n🎉 Configuration Validated. Add this to your .env file:\n");
    console.log("---------------------------------------------------");
    console.log(`CDP_API_KEY_NAME="${apiKeyName}"`);
    // Escape newlines for .env
    const envKey = pkcs8Key.replace(/\n/g, '\\n');
    console.log(`CDP_API_KEY_PRIVATE_KEY="${envKey}"`);
    console.log(`CDP_WALLET_SECRET="${walletSecret}"`);
    console.log(`CDP_NETWORK_ID="base-mainnet"`);
    console.log("---------------------------------------------------");

    rl.close();
}

main();
