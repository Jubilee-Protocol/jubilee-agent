
import { TreasuryServer } from '../src/mcp/servers/treasury/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function auditPhase5() {
    console.log("💰 Starting Phase 5 Audit: The Almoner");

    // 1. Initialize Treasury
    console.log("\n🔌 Initializing Treasury Server...");
    // We access the singleton
    const server = TreasuryServer.getInstance();
    await server.init();

    const tools = server.getTools();
    console.log(`✅ Treasury Tools Loaded: ${tools.map(t => t.name).join(', ')}`);

    // 2. Test Read-Only Tools
    const getAddress = tools.find(t => t.name === 'get_wallet_details');
    const getBalance = tools.find(t => t.name === 'get_balance');

    if (getAddress) {
        console.log("\n🆔 Requesting Wallet Details...");
        try {
            const details = await getAddress.call({});
            console.log(`[Result]: ${details.substring(0, 100)}...`); // Truncate for privacy
            if (details.includes("Wallet ID") || details.includes("Address")) {
                console.log("✅ get_wallet_details: PASS");
            } else {
                console.error("❌ get_wallet_details: Unexpected Output");
            }
        } catch (e) {
            console.error("❌ get_wallet_details Error:", e);
        }
    }

    if (getBalance) {
        console.log("\n⚖️ Requesting Balance...");
        try {
            const balance = await getBalance.call({});
            console.log(`[Result]: ${balance}`);
            if (balance.includes("ETH") || balance.includes("USDC")) {
                console.log("✅ get_balance: PASS");
            }
        } catch (e) {
            console.error("❌ get_balance Error:", e);
        }
    }

    // 3. Test Restricted Tool (Mock blocked transfer)
    const transfer = tools.find(t => t.name === 'transfer');
    if (transfer) {
        console.log("\n🛡️ Testing Whitelist Rejection...");
        try {
            const res = await transfer.call({
                to: "0x000000000000000000000000000000000000dead",
                amount: "0.0001",
                assetId: "eth"
            });
            console.log(`[Result]: ${res}`);

            if (res.includes("SECURITY BLOCK")) {
                console.log("✅ Whitelist Enforcement: PASS (Blocked unauthorized address)");
            } else {
                console.error("❌ Whitelist Enforcement: FAIL (Transfer attempted!)");
            }
        } catch (e) {
            console.log(`[Expected Error]: ${e}`);
        }
    }
}

auditPhase5().catch(console.error);
