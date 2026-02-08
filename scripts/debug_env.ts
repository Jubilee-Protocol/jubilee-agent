
import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY || '';
const id = process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID || '';

console.log(`System Time: ${new Date().toISOString()}`);
console.log(`Key ID: [${id}] (Length: ${id.length})`);
console.log(`Key Secret Length: ${key.length}`);
console.log(`First 10 chars: ${key.substring(0, 10)}`);
console.log(`Last 10 chars: ${key.substring(key.length - 10)}`);

console.log("Checking for whitespace...");
for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 33 || code > 126) {
        console.log(`Found odd char at index ${i}: code ${code}`);
    }
}
