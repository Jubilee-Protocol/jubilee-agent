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
import { StructuredToolInterface, StructuredTool } from "@langchain/core/tools";
import * as fs from 'fs';
import * as path from 'path';
import { encodeFunctionData, parseUnits } from 'viem';

import { JUBILEE_VAULTS, SUPPORTED_ASSETS } from '../../../config/assets.js';
import { logger } from '../../../utils/logger.js';

// Whitelist of allowed addresses for outgoing transfers (Mainnet)
const WHITELISTED_ADDRESSES = process.env.TREASURY_WHITELIST
    ? process.env.TREASURY_WHITELIST.split(',').map(a => a.trim().toLowerCase())
    : [];

const WALLET_DATA_FILE = path.join(process.cwd(), 'data', 'wallet_data.json');


const ERC20_APPROVE_ABI = [{
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }]
}] as const;

const VAULT_DEPOSIT_ABI = [{
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ type: 'uint256' }]
}] as const;

export class TreasuryServer {
    private static instance: TreasuryServer;
    private agentKit: AgentKit | null = null;
    private walletProvider: CdpEvmWalletProvider | null = null;
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

        logger.info(`💰 Initializing Treasury Server on ${this.networkId}...`);

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
                    logger.info("📂 Loaded existing wallet data.");
                } catch (error) {
                    logger.error("Failed to read wallet data:", error);
                }
            }

            const config: Record<string, unknown> = {
                apiKeyId: apiKeyName,
                apiKeySecret: apiKeyPrivateKey,
                networkId: this.networkId,
            };

            if (walletDataStr) {
                config.cdpWalletData = walletDataStr;
            }

            this.walletProvider = await CdpEvmWalletProvider.configureWithWallet(config as any);

            // Action Providers
            const actionProviders = [
                new WalletActionProvider(),
                new ERC20ActionProvider(),
                new PythActionProvider(),
                new WethActionProvider(),
            ];

            // Initialize AgentKit with the provider and actions
            this.agentKit = await AgentKit.from({
                walletProvider: this.walletProvider,
                actionProviders
            });

            // Persistence: Save Wallet Data (if new)
            if (!walletDataStr && this.walletProvider) {
                try {
                    const data = await (this.walletProvider as any).exportWallet();
                    const dataDir = path.dirname(WALLET_DATA_FILE);
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(data));
                    logger.info("💾 Wallet data saved to disk.");
                } catch (ex) {
                    logger.warn("⚠️ Failed to persist wallet data (Export might not be supported on this provider type):", ex);
                }
            }


            // Custom Tool: Invest in Jubilee Vaults (The "Swap" Logic)
            class InvestInJubileeTool extends StructuredTool {
                name = "invest_in_jubilee_yield";
                description = "Swap assets (USDC, cbBTC) for Jubilee Yield Tokens (jUSDi, jBTCi). Effectively deposits assets into the Jubilee Vaults.";
                schema = z.object({
                    vault: z.enum(['jUSDi', 'jBTCi']).describe('The Jubilee Yield Token to obtain.'),
                    asset: z.enum(['USDC', 'cbBTC']).describe('The asset to swap/deposit.'),
                    amount: z.string().describe('The amount of asset to swap (e.g. "200.5").')
                });

                private walletProvider: CdpEvmWalletProvider;

                constructor(walletProvider: CdpEvmWalletProvider) {
                    super();
                    this.walletProvider = walletProvider;
                }

                async _call(arg: { vault: string, asset: string, amount: string }): Promise<string> {
                    const vaultInfo = JUBILEE_VAULTS[arg.vault as keyof typeof JUBILEE_VAULTS];
                    if (!vaultInfo) return `Error: No config found for vault ${arg.vault}`;
                    const vaultAddr = vaultInfo.address;

                    const assetInfo = SUPPORTED_ASSETS[arg.asset as keyof typeof SUPPORTED_ASSETS];
                    if (!assetInfo) return `Error: Unknown asset ${arg.asset}`;

                    try {
                        const amountBigInt = parseUnits(arg.amount, assetInfo.decimals);
                        const walletAddress = await this.walletProvider.getAddress();

                        // 1. Approve
                        logger.info(`📝 Approving ${arg.vault} to spend ${arg.amount} ${arg.asset}...`);
                        const approveData = encodeFunctionData({
                            abi: ERC20_APPROVE_ABI,
                            functionName: 'approve',
                            args: [vaultAddr, amountBigInt]
                        });

                        const approveTx = await this.walletProvider.sendTransaction({
                            to: assetInfo.address as `0x${string}`,
                            data: approveData
                        });
                        logger.info(`✅ Approved. TX: ${approveTx}`);

                        // 2. Deposit
                        logger.info(`🏦 Depositing ${arg.amount} ${arg.asset} into ${arg.vault}...`);
                        const depositData = encodeFunctionData({
                            abi: VAULT_DEPOSIT_ABI,
                            functionName: 'deposit',
                            args: [amountBigInt, walletAddress as `0x${string}`]
                        });

                        const depositTx = await this.walletProvider.sendTransaction({
                            to: vaultAddr as `0x${string}`,
                            data: depositData
                        });

                        return `✅ Successfully swapped ${arg.amount} ${arg.asset} for ${arg.vault}.\nApprove TX: ${approveTx}\nDeposit TX: ${depositTx}`;

                    } catch (e: any) {
                        return `❌ Failed to invest: ${e.message}`;
                    }
                }
            }

            // Get Tools
            const tools = await getLangChainTools(this.agentKit);
            if (this.walletProvider) {
                // Cast needed due to AgentKit's vendored @langchain/core version mismatch
                tools.push(new InvestInJubileeTool(this.walletProvider) as any);
            }

            // Filter and Wrap Tools
            this.tools = tools.map(tool => {
                // Wrap ALL transfer/trade tools with whitelist/logic checks
                if (tool.name.toLowerCase().includes('transfer') || tool.name.toLowerCase().includes('trade')) {
                    return this.wrapTransferTool(tool as any);
                }
                return tool;
            }) as any[];

            logger.info(`💰 Treasury Server Tool Count: ${this.tools.length}`);

        } catch (error) {
            logger.error("❌ Failed to initialize Treasury Server:", error);
            // Don't throw, just degrade functionality
        }
    }

    private wrapTransferTool(originalTool: StructuredToolInterface): StructuredToolInterface {
        const toolAny = originalTool as any;
        const originalCall = toolAny.call.bind(toolAny);

        const wrappedTool = Object.create(originalTool);
        wrappedTool.call = async (arg: any, config?: any) => {
            let toAddress = '';
            if (typeof arg === 'object') {
                toAddress = arg.to || arg.destination || arg.recipient || arg.address || '';
            } else if (typeof arg === 'string') {
                try {
                    const parsed = JSON.parse(arg);
                    toAddress = parsed.to || parsed.destination || parsed.recipient || parsed.address || '';
                } catch {
                    logger.debug(`Could not parse transfer arg as JSON: ${arg}`);
                }
            }

            toAddress = toAddress.toLowerCase();

            // Parse whitelist dynamically to allow env var updates (e.g. testing)
            const WHITELIST = process.env.TREASURY_WHITELIST
                ? process.env.TREASURY_WHITELIST.split(',').map(a => a.trim().toLowerCase())
                : [];

            if (WHITELIST.length > 0 && !WHITELIST.includes(toAddress)) {
                logger.warn(`🚨 SECURITY ALERT: Blocked transfer attempt to non-whitelisted address: ${toAddress}`);
                return `⛔ SECURITY BLOCK: The address '${toAddress}' is NOT in the Treasury Whitelist. Transfer aborted.`;
            }

            logger.debug(`👮‍♂️ Whitelist Check Passed for: ${toAddress}`);

            if (config) {
                return (originalCall as any)(arg, config);
            }
            return (originalCall as any)(arg);
        };

        return wrappedTool as any;
    }

    async getWalletAddress(): Promise<string | null> {
        if (this.walletProvider) {
            try {
                return await this.walletProvider.getAddress();
            } catch (e) {
                logger.error("Failed to get wallet address from provider", e);
                return null;
            }
        }
        return null;
    }

    getTools(): StructuredToolInterface[] {
        return this.tools;
    }
}
