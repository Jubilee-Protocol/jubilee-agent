import { randomBytes } from 'crypto';

const generateSecret = (length = 32) => {
    return randomBytes(length).toString('hex');
};

console.log('🔐 Jubilee OS Secret Generator');
console.log('-----------------------------');
console.log(`JUBILEE_ADMIN_TOKEN=${generateSecret()}`);
console.log(`JUBILEE_DB_PASSWORD=${generateSecret()}`);
console.log(`JUBILEE_READ_TOKEN=${generateSecret(16)}`);
console.log('-----------------------------');
console.log('Copy these to your .env file.');
