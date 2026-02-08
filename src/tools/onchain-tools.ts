
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { mainnet, base, baseSepolia } from 'viem/chains';

/**
 * Tool to listen for on-chain events.
 * Useful for "On-Chain Ears" capability.
 */
export class WaitForEventTool extends StructuredTool {
    name = 'wait_for_event';
    description = 'Waits for a specific smart contract event to occur within a timeout window. Useful for verifying transactions or monitoring activity. Returns the event logs if found, or null if timeout.';

    schema = z.object({
        contractAddress: z.string().describe('The smart contract address to watch (0x...)'),
        abiItem: z.string().describe('The event signature to watch, e.g., "event Transfer(address indexed from, address indexed to, uint256 value)"'),
        timeoutSeconds: z.number().optional().default(60).describe('How long to wait in seconds (default: 60, max: 300)'),
        network: z.enum(['base-mainnet', 'base-sepolia', 'ethereum']).optional().default('base-sepolia').describe('The network to listen on'),
    });

    async _call(arg: { contractAddress: string; abiItem: string; timeoutSeconds: number; network: string }): Promise<string> {
        const { contractAddress, abiItem, timeoutSeconds, network } = arg;

        // Resolve Chain
        let chain = baseSepolia;
        if (network === 'base-mainnet') chain = base;
        if (network === 'ethereum') chain = mainnet;

        // Create Client (Use Public RPCs for now)
        const client = createPublicClient({
            chain,
            transport: http(),
        });

        console.log(`👂 Listening for event on ${network}: ${contractAddress}`);
        console.log(`   Event: ${abiItem}`);
        console.log(`   Timeout: ${timeoutSeconds}s`);

        try {
            const logs = await new Promise<any[]>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    unwatch();
                    resolve([]); // Resolve with empty array on timeout
                }, timeoutSeconds * 1000);

                const unwatch = client.watchEvent({
                    address: contractAddress as `0x${string}`,
                    event: parseAbiItem(abiItem),
                    onLogs: (logs) => {
                        clearTimeout(timeout);
                        unwatch();
                        resolve(logs);
                    },
                    onError: (err) => {
                        clearTimeout(timeout);
                        unwatch();
                        reject(err);
                    }
                });
            });

            if (logs.length === 0) {
                return `Timeout: No '${abiItem}' events detected on ${contractAddress} within ${timeoutSeconds} seconds.`;
            }

            // Format logs for LLM
            const formattedLogs = logs.map(log => ({
                blockNumber: log.blockNumber.toString(),
                transactionHash: log.transactionHash,
                args: JSON.stringify(log.args, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value // Handle BigInt
                )
            }));

            return JSON.stringify(formattedLogs, null, 2);

        } catch (error: any) {
            return `Error watching event: ${error.message}`;
        }
    }
}
