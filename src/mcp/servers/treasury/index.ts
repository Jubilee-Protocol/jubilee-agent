
import { AgentKit, CdpEvmWalletProvider, wethActionProvider, walletActionProvider, erc20ActionProvider, pythActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Treasury Server (The Almoner)
 * Wraps Coinbase AgentKit to provide on-chain capabilities.
 */
export class TreasuryServer {
    private static instance: TreasuryServer;
    private agentKit: AgentKit | null = null;
    public tools: any[] = [];

    private constructor() { }

    static getInstance(): TreasuryServer {
        if (!TreasuryServer.instance) {
            TreasuryServer.instance = new TreasuryServer();
        }
        return TreasuryServer.instance;
    }

    async init() {
        if (this.agentKit) return;

        try {
            // Configure CDP Wallet Provider
            const config = {
                apiKeyId: process.env.CDP_API_KEY_ID,
                apiKeySecret: process.env.CDP_API_KEY_SECRET?.replace(/\\n/g, "\n"),
                walletSecret: process.env.CDP_WALLET_SECRET,
                networkId: process.env.CDP_NETWORK_ID || "base-mainnet",
            };

            console.log("Config Check:", {
                hasId: !!config.apiKeyId,
                hasSecret: !!config.apiKeySecret,
                hasWalletSecret: !!config.walletSecret,
                network: config.networkId
            });

            if (!config.apiKeyId || !config.apiKeySecret || !config.walletSecret) {
                console.warn("⚠️ TreasuryServer: CDP API Credentials missing (ID, Secret, Wallet Secret). Treasury tools will be unavailable.");
                return;
            }

            const walletProvider = await CdpEvmWalletProvider.configureWithWallet(config);

            // Initialize AgentKit
            this.agentKit = await AgentKit.from({
                walletProvider,
                actionProviders: [
                    wethActionProvider(),
                    pythActionProvider(),
                    walletActionProvider(),
                    erc20ActionProvider(),
                ],
            });

            // Get LangChain compatible tools
            this.tools = await getLangChainTools(this.agentKit);

            const address = await walletProvider.getAddress();
            console.log(`💰 TreasuryServer (The Almoner) Initialized. Wallet: ${address}`);

        } catch (error) {
            console.error("❌ TreasuryServer Initialization Failed:", error);
        }
    }

    getTools() {
        return this.tools;
    }
}
