import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:3001';
const ADMIN_TOKEN = process.env.JUBILEE_ADMIN_TOKEN || 'admin_password';

async function runApiRedTeam() {
    console.log("🔴 STARTING RED TEAM AUDIT: API LAYER");

    // 1. Auth Bypass Check
    console.log("\n⚔️ ATTACK 1: Auth Bypass (Access /epistle without token)");
    try {
        const response = await fetch(`${BASE_URL}/epistle`);
        if (response.status === 401) {
            console.log("✅ BLOCKED: 401 Unauthorized received.");
        } else {
            console.error(`❌ FAILED: Received status ${response.status}`);
        }
    } catch (e) {
        console.log("⚠️ API unreachable (is server running?)");
    }

    // 2. Rate Limit Stress Test
    console.log("\n⚔️ ATTACK 2: DoS / Rate Limit (100 in 1s)");
    let blockedCount = 0;
    const requests = [];
    for (let i = 0; i < 70; i++) {
        requests.push(fetch(`${BASE_URL}/health`).then(res => {
            if (res.status === 429) blockedCount++;
        }));
    }

    await Promise.all(requests);

    if (blockedCount > 0) {
        console.log(`✅ PASSED: Blocked ${blockedCount} requests due to Rate Limiting.`);
    } else {
        console.error("❌ FAILED: No requests were rate limited!");
    }
}

runApiRedTeam();
