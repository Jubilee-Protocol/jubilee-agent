
import { generateKeyPairSync } from 'crypto';

console.log("🔑 Generating Valid CDP Wallet Secret...");

const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // ES256
});

// Export as PKCS8 DER
const der = privateKey.export({
    format: 'der',
    type: 'pkcs8',
});

// Encode as Base64 (this is what the SDK expects as 'walletSecret')
const walletSecret = der.toString('base64');

console.log("\n✅ Generated Wallet Secret:");
console.log("---------------------------------------------------");
console.log(walletSecret);
console.log("---------------------------------------------------");
console.log("\n📋 Copy the above string (3 lines or so) into your .env as CDP_WALLET_SECRET");
console.log("It should look like a long random string of letters and numbers.");
