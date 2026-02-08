
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { https } from 'follow-redirects';

dotenv.config();

const keyName = process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID;
const keySecret = process.env.CDP_API_KEY_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET;

function sign(str: string, secret: string) {
    const key = crypto.createPrivateKey({
        key: secret.replace(/\\n/g, '\n'),
        format: 'pem',
    });
    return crypto.sign(null, Buffer.from(str), key).toString('base64'); // JWT? No, CDP uses JWT usually for new keys.
}

// Coinbase Advanced Trade uses JWT for "Cloud" keys? 
// Or is it HMAC? 
// Actually, new CDP keys use JWT.
// Let's try the JWT approach which is standard for CDP.

import * as jwt from 'jsonwebtoken';

async function testJWT() {
    console.log("🧪 Testing Key as CDP/Advanced Trade Key (JWT Auth)...");

    const requestMethod = "GET";
    const url = "api.coinbase.com";
    const requestPath = "/api/v3/brokerage/accounts";

    // Build JWT
    const token = jwt.sign(
        {
            iss: 'cdp',
            nbf: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 120, // 2 mins
            sub: keyName,
            uri: `${requestMethod} ${url}${requestPath}`
        },
        keySecret.replace(/\\n/g, '\n'),
        {
            algorithm: 'ES256',
            header: {
                kid: keyName,
                nonce: crypto.randomBytes(16).toString('hex')
            }
        }
    );

    const options = {
        hostname: url,
        port: 443,
        path: requestPath,
        method: requestMethod,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
                console.log(`\nResponse Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    console.log("✅ SUCCESS! This is a valid Trading Key.");
                    console.log("Data sample:", data.substring(0, 100));
                } else {
                    console.log("❌ FAILED. Response:", data);
                }
                resolve(true);
            });
        });
        req.on('error', (e: any) => {
            console.error(e);
            resolve(false);
        });
        req.end();
    });
}

// Install jsonwebtoken first if needed? It might not be there.
// We can use 'jose' or 'crypto' native if needed? 
// Actually, let's try to just use 'jsonwebtoken' assuming it's common or available transitively? 
// If fails, I'll install it.

async function main() {
    try {
        await testJWT();
    } catch (e: any) {
        if (e.message.includes('MODULE_NOT_FOUND')) {
            console.log("Installing jsonwebtoken...");
            // We will let the agent install it
        } else {
            console.error(e);
        }
    }
}

main();
