
import {
    AgentKit,
    CdpEvmWalletProvider,
    WalletActionProvider,
    ERC20ActionProvider,
    PythActionProvider,
    WethActionProvider
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StructuredToolInterface } from "@langchain/core/tools";
import * as fs from 'fs';
import * as path from 'path';

// Whitelist of allowed addresses for outgoing transfers (Mainnet)
const WHITELISTED_ADDRESSES = process.env.TREASURY_WHITELIST
    ? process.env.TREASURY_WHITELIST.split(',').map(a => a.trim().toLowerCase())
    : [];

const WALLET_DATA_FILE = path.join(process.cwd(), 'data', 'wallet_data.json');

export class TreasuryServer {
    private static instance: TreasuryServer;
    private agentKit: AgentKit | null = null;
    private tools: StructuredToolInterface[] = [];
    private networkId: string;

    private constructor() {
        this.networkId = process.env.CDP_NETWORK_ID || 'base-mainnet';
    }

    public static getInstance(): TreasuryServer {
        if (!TreasuryServer.instance) {
            TreasuryServer.instance = new TreasuryServer();
        }
        return TreasuryServer.instance;
    }

    async init() {
        if (this.agentKit) return;

        console.log(`💰 Initializing Treasury Server on ${this.networkId}...`);

        try {
            let apiKeyName = process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID || "";
            let apiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET || "";

            // Aggressive Cleanup
            apiKeyName = apiKeyName.replace(/['"]+/g, '').trim();
            apiKeyPrivateKey = apiKeyPrivateKey.replace(/['"]+/g, '').trim();

            // Handle escaped newlines
            if (apiKeyPrivateKey.includes("\\n")) {
                apiKeyPrivateKey = apiKeyPrivateKey.replace(/\\n/g, "\n");
            }


            // Persistence: Load Wallet Data
            let walletDataStr: string | undefined = undefined;
            if (fs.existsSync(WALLET_DATA_FILE)) {
                try {
                    walletDataStr = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
                    console.log("📂 Loaded existing wallet data.");
                } catch (error) {
                    console.error("Failed to read wallet data:", error);
                }
            }

            const config: any = {
                apiKeyId: apiKeyName,
                apiKeySecret: apiKeyPrivateKey,
                networkId: this.networkId,
            };

            // If we have persisted data, inject it.
            // Note: CdpWalletProviderConfig structure varies by version.
            // We'll try to pass it as 'cdpWalletData' which is standard in AgentKit docs.
            if (walletDataStr) {
                config.cdpWalletData = walletDataStr;
            }

            const walletProvider = await CdpEvmWalletProvider.configureWithWallet(config);

            // Action Providers
            const actionProviders = [
                new WalletActionProvider(),
                new ERC20ActionProvider(),
                new PythActionProvider(),
                new WethActionProvider(),
            ];

            // Initialize AgentKit with the provider and actions
            this.agentKit = await AgentKit.from({
                walletProvider,
                actionProviders
            });

            // Persistence: Save Wallet Data (if new)
            if (!walletDataStr) {
                try {
                    const data = await walletProvider.exportWallet();
                    // Ensure data dir exists
                    const dataDir = path.dirname(WALLET_DATA_FILE);
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(data));
                    console.log("💾 Wallet data saved to disk.");
                } catch (ex) {
                    console.warn("⚠️ Failed to persist wallet data (Export might not be supported on this provider type):", ex);
                }
            }

            // Get Tools
            const tools = await getLangChainTools(this.agentKit);

            // Filter and Wrap Tools
            this.tools = tools.map(tool => {
                // Wrap ALL transfer/trade tools with whitelist/logic checks
                if (tool.name.toLowerCase().includes('transfer') || tool.name.toLowerCase().includes('trade')) {
                    return this.wrapTransferTool(tool);
                }
                return tool;
            });

            console.log(`💰 Treasury Server Tool Count: ${this.tools.length}`);

        } catch (error) {
            console.error("❌ Failed to initialize Treasury Server:", error);
            // Don't throw, just degrade functionality
        }
    }

    private wrapTransferTool(originalTool: StructuredToolInterface): StructuredToolInterface {
        const originalCall = originalTool.call.bind(originalTool);

        const wrappedTool = Object.create(originalTool);
        wrappedTool.call = async (arg: any, config: any) => {
            let toAddress = '';
            if (typeof arg === 'object') {
                toAddress = arg.to || arg.destination || arg.recipient || arg.address || '';
            } else if (typeof arg === 'string') {
                try {
                    const parsed = JSON.parse(arg);
                    toAddress = parsed.to || parsed.destination || parsed.recipient || parsed.address || '';
                } catch { }
            }

            toAddress = toAddress.toLowerCase();

            if (!WHITELISTED_ADDRESSES.includes(toAddress)) {
                return `⛔ SECURITY BLOCK: The address '${toAddress}' is NOT in the Treasury Whitelist. Transfer aborted.`;
            }

            console.log(`👮‍♂️ Whitelist Check Passed for: ${toAddress}`);
            return originalCall(arg, config);
        };

        return wrappedTool;
    }

    getTools(): StructuredToolInterface[] {
        return this.tools;
    }
}
