
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { SUPPORTED_ASSETS } from '../config/assets.js';

// Simple Event Bus for notifications
type NotificationCallback = (msg: string) => void;

export class OnChainEars {
    private static instance: OnChainEars;
    private client;
    private listeners: Function[] = []; // Unwatch functions
    private callback: NotificationCallback | null = null;
    private walletAddress: string | null = null;

    private constructor() {
        this.client = createPublicClient({
            chain: base,
            transport: http()
        });
    }

    public static getInstance(): OnChainEars {
        if (!OnChainEars.instance) {
            OnChainEars.instance = new OnChainEars();
        }
        return OnChainEars.instance;
    }

    public setNotificationCallback(cb: NotificationCallback) {
        this.callback = cb;
    }

    /**
     * Start listening for Transfer events TO the treasury address.
     */
    public async startListening(treasuryAddress: string) {
        if (this.listeners.length > 0) {
            console.log("👂 On-Chain Ears already listening.");
            return;
        }

        this.walletAddress = treasuryAddress.toLowerCase();
        console.log(`👂 On-Chain Ears active. Listening for deposits to: ${this.walletAddress}...`);

        // Standard ERC20 Transfer Event
        const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

        // Watch USDC
        this.watchAsset('USDC', SUPPORTED_ASSETS.USDC.address, SUPPORTED_ASSETS.USDC.decimals, transferEvent);

        // Watch cbBTC
        this.watchAsset('cbBTC', SUPPORTED_ASSETS.cbBTC.address, SUPPORTED_ASSETS.cbBTC.decimals, transferEvent);
    }

    private watchAsset(symbol: string, address: string, decimals: number, eventAbi: any) {
        const unwatch = this.client.watchEvent({
            address: address as `0x${string}`,
            event: eventAbi,
            onLogs: (logs) => {
                for (const log of logs) {
                    const { from, to, value } = (log as any).args;

                    if (to && to.toLowerCase() === this.walletAddress) {
                        const amount = formatUnits(value as bigint, decimals);
                        const msg = `🔔 **INCOMING FUNDS DETECTED** 🔔\nRecieved ${amount} ${symbol} from ${from}.\nAction: Consider running 'invest_in_jubilee_yield' to earn yield!`;

                        // Notify via callback if set, else console
                        if (this.callback) {
                            this.callback(msg);
                        } else {
                            console.log(`\n${msg}\n`);
                        }
                    }
                }
            }
        });
        this.listeners.push(unwatch);
    }

    public stopListening() {
        this.listeners.forEach(unwatch => unwatch());
        this.listeners = [];
        console.log("👂 On-Chain Ears stopped.");
    }
}
