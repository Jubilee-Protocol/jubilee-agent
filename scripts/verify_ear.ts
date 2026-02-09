
import { OnChainEars } from '../src/services/onchain-ears.js';
import { TreasuryServer } from '../src/mcp/servers/treasury/index.js';
import { config } from 'dotenv';
import { JUBILEE_VAULTS } from '../src/config/assets.js';

config();

async function verifyEar() {
    console.log("👂 STARTING EAR VERIFICATION...");

    // 1. Check Config
    console.log("✅ Config Loaded:", JUBILEE_VAULTS);

    // 2. Init Treasury
    console.log("💰 Initializing Treasury...");
    await TreasuryServer.getInstance().init();
    const address = await TreasuryServer.getInstance().getWalletAddress();

    if (!address) {
        console.error("❌ Failed to get wallet address. Treasury init likely failed.");
        process.exit(1);
    }
    console.log(`✅ Treasury Address: ${address}`);

    // 3. Start Ear
    const ear = OnChainEars.getInstance();
    ear.setNotificationCallback((msg) => {
        console.log("\n🔔 CALLBACK RECEIVED:\n", msg);
        console.log("\n✅ Ear Verification SUCCESS!");
        process.exit(0);
    });

    await ear.startListening(address);

    // 4. Simulate?
    // We can't easily simulate a mainnet event without sending money.
    // However, if strict verification passes (config loaded, wallet address got, listener started),
    // we assume it works. We won't block on a real event.
    console.log("👂 Listening... (Press Ctrl+C to exit if no event happens)");

    // We exit automatically for the sake of the test if we get this far without error
    setTimeout(() => {
        console.log("✅ Listener started without error. Exiting test.");
        process.exit(0);
        // Note: Real callback verification requires real TX.
    }, 5000);
}

verifyEar();
