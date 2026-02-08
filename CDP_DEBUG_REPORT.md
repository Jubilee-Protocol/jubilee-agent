# CDP Authentication Troubleshooting Report
**Date:** February 8, 2026
**Component:** Treasury MCP (The Almoner)
**SDK:** `@coinbase/agentkit` v0.10.4

## Problem Summary
The agent is unable to authenticate with the Coinbase Developer Platform (CDP) using the provided API Key. The Treasury module is currently **PAUSED** due to this blocker.

## 1. Credentials Used
- **Key Name/ID:** `47d7ced5-c1f6-4cb2-bc9f-77a81c36f4d8`
- **Key Type:** Ed25519 (assumed from base64 length)
- **Permissions:** Unknown (User needs to verify "AgentKit" or "Wallets" access)
- **Network:** `base-mainnet` (and `base-sepolia`)

## 2. Strategies Attempted & Errors

### Attempt A: Raw Base64 string from `.env`
We attempted to pass the key secret exactly as copied from the file.
- **Input Format:** `aQF1Q/E4Bj...` (88 chars)
- **Result:** `❌ FAILED: Unauthorized.`
- **Interpretation:** The server received the request but rejected the credentials. This usually implies the Key ID and Secret do not match, or the Key lacks permissions for the requested scope.

### Attempt B: PEM-Wrapped Format
We attempted to programmatically wrap the key in standard OpenSSL headers.
- **Input Format:**
  ```
  -----BEGIN PRIVATE KEY-----
  aQF1Q/E4Bj...
  -----END PRIVATE KEY-----
  ```
- **Result:** `❌ FAILED: Invalid key format - must be either PEM EC key or base64 Ed25519 key`
- **Interpretation:** The SDK parser rejected this manual wrapping, confirming that the raw key is likely the correct *format* but the authentication is failing upstream.

### Attempt C: Deep Import vs Root Import
We verified the import paths for `CdpEvmWalletProvider`.
- **Finding:** We are using `@coinbase/agentkit` correctly. The issue is not the import path.

## 3. Diagnostic Code Used
We used the following script (`scripts/diagnose_cdp.ts`) to isolate the issue:

```typescript
import { CdpEvmWalletProvider } from "@coinbase/agentkit";

const config = {
    apiKeyId: process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY, // Tried both Raw and PEM
    networkId: 'base-sepolia'
};

try {
    const provider = await CdpEvmWalletProvider.configureWithWallet(config);
    console.log("Success");
} catch (e) {
    console.log(e.message); // Returns "Unauthorized"
}
```

## 4. Recommended Action for JubileeLabsBot
The error `Unauthorized` (401) combined with a syntactically correct key strongly suggests the key itself is:
1.  **Revoked/Deleted** in the CDP Portal.
2.  **Scope Restricted** (e.g., does not have Wallet/Trade permissions).
3.  **Mismatched**: The `apiKeyId` (`47d...`) does not belong to the `apiKeySecret` (`aQF...`).

**Next Step:** Generate a brand new API Key in CDP Portal > Settings > API Keys. Ensure "AgentKit" is selected if available, or grant full "Trading" permissions.
