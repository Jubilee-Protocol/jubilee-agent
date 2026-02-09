
import { TreasuryServer } from '../src/mcp/servers/treasury/index.js';
import { z } from 'zod';

// Mock Config for offline testing
process.env.JUSDI_ADDRESS = "0x26c39532C0dD06C0c4EddAeE36979626b16c77aC";
process.env.TREASURY_WHITELIST = "0xgoodguy,0xcharity"; // Whitelisted addresses (lowercase)

async function runRedTeam() {
    console.log("🔴 STARTING RED TEAM AUDIT: TREASURY SERVER");

    // 1. Initialize Server (This will log errors if keys are missing, but checking static logic)
    // We need to access the private methods or obtain the tools to test the wrapper.
    // Since wrapTransferTool is private, we'll instantiate the server and get tools,
    // then manually invoke the transfer tool if it exists.

    const server = TreasuryServer.getInstance();

    // NOTE: This script assumes we can initialize. If it fails due to missing keys,
    // we might need to mock CdpEvmWalletProvider.
    // actual initialization might hang if no keys.
    // Ideally we would unit test the logic, but let's try to grab the singleton.

    console.log("NOTE: This script requires a valid connection to Coinbase to generate tools.");
    console.log("If this hangs, it's because it's trying to connect to Base.");

    try {
        await server.init();
        const tools = server.getTools();

        console.log("💰 Available Tools:", tools.map(t => t.name).join(", "));

        const transferTool = tools.find(t => t.name.includes('transfer'));

        if (!transferTool) {
            console.log("⚠️ Transfer tool not found. Skipping dynamic checks.");
            return;
        }

        console.log(`🔫 Found Transfer Tool: ${transferTool.name}`);

        // --- ATTACK 1: The Unauthorized Drain ---
        console.log("\n⚔️ ATTACK 1: Transfer to Unauthorized Address (0xEVIL)");
        const result1 = await transferTool.call({
            amount: "100",
            assetId: "USDC",
            destination: "0xEVIL_ADDRESS_NOT_IN_WHITELIST"
        });

        if (typeof result1 === 'string' && result1.includes("SECURITY BLOCK")) {
            console.log("✅ BLOCKED: " + result1);
        } else {
            console.error("❌ FAILED: Attack 1 succeeded! Result: ", result1);
        }

        // --- ATTACK 2: The Whitelisted Transfer ---
        console.log("\n🛡️ ATTACK 2: Transfer to Whitelisted Address (0xgoodguy)");
        // We expect this to FAIL with "Insufficient funds" or network error, NOT Security Block.
        try {
            const result2 = await transferTool.call({
                amount: "1",
                assetId: "USDC",
                destination: "0xgoodguy"
            });
            console.log("ℹ️ Result: " + result2); // Likely network/fund error
        } catch (e: any) {
            if (e.message.includes("SECURITY BLOCK")) {
                console.error("❌ FAILED: Setup error, whitelisted address was blocked.");
            } else {
                console.log("✅ PASSED: Not blocked by security (failed downstream as expected). Error: " + e.message.slice(0, 50));
            }
        }

        // --- ATTACK 3: JSON Injection / obfuscation ---
        console.log("\n⚔️ ATTACK 3: Obfuscated Address (Case Sensitivity)");
        try {
            const result3 = await transferTool.call({
                amount: "100",
                assetId: "USDC",
                destination: "0xGoodGuy" // Mixed case
            });
            if (typeof result3 === 'string' && result3.includes("SECURITY BLOCK")) {
                console.error("❌ FAILED: Case sensitivity check failed (should have been allowed).");
            } else {
                console.log("✅ PASSED: Case sensitivity handled correctly.");
            }
        } catch (e: any) {
            if (e.message.includes("SECURITY BLOCK")) {
                console.error("❌ FAILED: Case sensitivity check failed (Blocked).");
            } else {
                console.log("✅ PASSED: Case sensitivity handled correctly (Failed downstream as expected).");
            }
        }

    } catch (e) {
        console.error("Audit Runtime Error:", e);
    }
}

runRedTeam();
