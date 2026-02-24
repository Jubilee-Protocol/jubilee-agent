
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Multi-chain governance tools for Jubilee Protocol.
 *
 * EVM: Safe (Gnosis Safe) — Base, Ethereum, zkSync
 *   Package: @safe-global/protocol-kit, @safe-global/api-kit
 *
 * Solana: Squads — multi-sig program
 *   Package: @sqds/multisig
 *
 * These tools use dynamic imports so the project doesn't fail if SDKs aren't installed.
 * Install only what you need:
 *   bun add @safe-global/protocol-kit @safe-global/api-kit   # For EVM
 *   bun add @sqds/multisig @solana/web3.js                   # For Solana
 */

// Chain -> Safe Transaction Service API URL
const SAFE_TX_SERVICE_URLS: Record<string, string> = {
    'base': 'https://safe-transaction-base.safe.global',
    'ethereum': 'https://safe-transaction-mainnet.safe.global',
    'base-sepolia': 'https://safe-transaction-base-sepolia.safe.global',
    'sepolia': 'https://safe-transaction-sepolia.safe.global',
};

/**
 * ProposeSafeTxTool
 * Propose a transaction to a Safe multi-sig wallet (EVM chains).
 */
export class ProposeSafeTxTool extends StructuredTool {
    name = 'propose_safe_tx';
    description = 'Propose a transaction to a Safe (Gnosis Safe) multi-sig wallet on EVM chains. Creates a transaction proposal that signers can approve. Requires SAFE_SIGNER_KEY in .env.';

    schema = z.object({
        safeAddress: z.string().describe('Safe wallet address (0x...).'),
        to: z.string().describe('Target contract address to call.'),
        data: z.string().optional().default('0x').describe('Encoded calldata for the transaction.'),
        value: z.string().optional().default('0').describe('ETH value to send (in wei).'),
        description: z.string().describe('Human-readable description of the proposal.'),
        chain: z.enum(['base', 'ethereum', 'base-sepolia', 'sepolia']).default('base'),
    });

    async _call(arg: { safeAddress: string, to: string, data?: string, value?: string, description: string, chain: string }): Promise<string> {
        try {
            // Dynamic import — fails gracefully if not installed
            const { default: SafeApiKit } = await import('@safe-global/api-kit');
            const { default: Safe } = await import('@safe-global/protocol-kit');

            const signerKey = process.env.SAFE_SIGNER_KEY;
            if (!signerKey) {
                return 'Error: SAFE_SIGNER_KEY not set in .env. This is the private key of a Safe signer.';
            }

            const txServiceUrl = SAFE_TX_SERVICE_URLS[arg.chain];
            if (!txServiceUrl) {
                return `Error: No Safe Transaction Service URL configured for chain "${arg.chain}".`;
            }

            const rpcUrl = process.env[`RPC_URL_${arg.chain.toUpperCase().replace('-', '_')}`] || '';
            if (!rpcUrl) {
                return `Error: No RPC_URL set for chain "${arg.chain}". Set RPC_URL_${arg.chain.toUpperCase().replace('-', '_')} in .env.`;
            }

            // Initialize Safe Protocol Kit
            const protocolKit = await Safe.init({
                provider: rpcUrl,
                signer: signerKey,
                safeAddress: arg.safeAddress,
            });

            // Create transaction
            const safeTransaction = await protocolKit.createTransaction({
                transactions: [{
                    to: arg.to,
                    data: arg.data || '0x',
                    value: arg.value || '0',
                }],
            });

            // Sign the transaction
            const signedTx = await protocolKit.signTransaction(safeTransaction);

            // Submit to Safe Transaction Service
            const apiKit = new SafeApiKit({ chainId: BigInt(await protocolKit.getChainId()) });

            const safeTxHash = await protocolKit.getTransactionHash(signedTx);
            const senderSignature = signedTx.signatures.values().next().value;

            await apiKit.proposeTransaction({
                safeAddress: arg.safeAddress,
                safeTransactionData: signedTx.data,
                safeTxHash,
                senderAddress: await protocolKit.getAddress(),
                senderSignature: senderSignature?.data || '',
            });

            return `✅ Safe TX proposed on ${arg.chain}:\n- **Hash**: ${safeTxHash}\n- **To**: ${arg.to}\n- **Description**: ${arg.description}\n- **Status**: Awaiting additional signer approvals\n- **View**: ${txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
        } catch (error: any) {
            if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find package')) {
                return 'Error: Safe SDK not installed. Run: bun add @safe-global/protocol-kit @safe-global/api-kit';
            }
            logger.error('Failed to propose Safe TX:', error);
            return `Error proposing Safe TX: ${error.message}`;
        }
    }
}

/**
 * QuerySafeStatusTool
 * Check pending proposals, signer status, and timelock countdown for a Safe wallet.
 */
export class QuerySafeStatusTool extends StructuredTool {
    name = 'query_safe_status';
    description = 'Check the status of a Safe (Gnosis Safe) multi-sig wallet: pending proposals, signer confirmations, threshold, and timelock status.';

    schema = z.object({
        safeAddress: z.string().describe('Safe wallet address (0x...).'),
        chain: z.enum(['base', 'ethereum', 'base-sepolia', 'sepolia']).default('base'),
    });

    async _call(arg: { safeAddress: string, chain: string }): Promise<string> {
        try {
            const { default: SafeApiKit } = await import('@safe-global/api-kit');

            const txServiceUrl = SAFE_TX_SERVICE_URLS[arg.chain];
            if (!txServiceUrl) {
                return `Error: No Safe TX Service for chain "${arg.chain}".`;
            }

            // Determine chainId from chain name
            const chainIds: Record<string, number> = {
                'base': 8453, 'ethereum': 1, 'base-sepolia': 84532, 'sepolia': 11155111,
            };

            const apiKit = new SafeApiKit({ chainId: BigInt(chainIds[arg.chain] || 1) });

            // Get Safe info
            const safeInfo = await apiKit.getSafeInfo(arg.safeAddress);

            // Get pending transactions
            const pendingTxs = await apiKit.getPendingTransactions(arg.safeAddress);

            const lines = [
                `## Safe Status: ${arg.safeAddress.slice(0, 6)}...${arg.safeAddress.slice(-4)}`,
                `- **Chain**: ${arg.chain}`,
                `- **Threshold**: ${safeInfo.threshold} of ${safeInfo.owners.length} signers`,
                `- **Nonce**: ${safeInfo.nonce}`,
                `\n### Signers`,
            ];

            for (const owner of safeInfo.owners) {
                lines.push(`- \`${owner}\``);
            }

            lines.push(`\n### Pending Transactions (${pendingTxs.results.length})`);

            if (pendingTxs.results.length === 0) {
                lines.push('_No pending transactions._');
            } else {
                for (const tx of pendingTxs.results.slice(0, 10)) {
                    const confirmations = tx.confirmations?.length || 0;
                    const needed = safeInfo.threshold;
                    lines.push(`- **Nonce ${tx.nonce}**: ${tx.to?.slice(0, 10)}... | ${confirmations}/${needed} sigs | ${tx.isExecuted ? '✅ Executed' : '⏳ Pending'}`);
                }
            }

            return lines.join('\n');
        } catch (error: any) {
            if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find package')) {
                return 'Error: Safe SDK not installed. Run: bun add @safe-global/protocol-kit @safe-global/api-kit';
            }
            logger.error('Failed to query Safe status:', error);
            return `Error querying Safe: ${error.message}`;
        }
    }
}

/**
 * QuerySquadsStatusTool
 * Check the status of a Squads multi-sig on Solana: vault address, members, pending transactions.
 */
export class QuerySquadsStatusTool extends StructuredTool {
    name = 'query_squads_status';
    description = 'Check the status of a Squads multi-sig on Solana: members, threshold, pending proposals, vault balance.';

    schema = z.object({
        multisigAddress: z.string().describe('Squads multisig account address (base58).'),
        cluster: z.enum(['mainnet-beta', 'devnet']).default('devnet'),
    });

    async _call(arg: { multisigAddress: string, cluster: string }): Promise<string> {
        try {
            const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
            const Squads = await import('@sqds/multisig');

            const endpoint = arg.cluster === 'mainnet-beta'
                ? process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
                : 'https://api.devnet.solana.com';

            const connection = new Connection(endpoint, 'confirmed');
            const multisigPda = new PublicKey(arg.multisigAddress);

            // Fetch multisig account
            const multisigAccount = await Squads.multisig.accounts.Multisig.fromAccountAddress(
                connection, multisigPda
            );

            // Get vault PDA
            const [vaultPda] = Squads.multisig.getVaultPda({
                multisigPda,
                index: 0,
            });

            const vaultBalance = await connection.getBalance(vaultPda);

            const lines = [
                `## Squads Multisig: ${arg.multisigAddress.slice(0, 8)}...`,
                `- **Cluster**: ${arg.cluster}`,
                `- **Threshold**: ${multisigAccount.threshold} of ${multisigAccount.members.length} members`,
                `- **Vault**: \`${vaultPda.toBase58()}\``,
                `- **Vault Balance**: ${(vaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
                `- **Transaction Index**: ${multisigAccount.transactionIndex.toString()}`,
                `\n### Members`,
            ];

            for (const member of multisigAccount.members) {
                const permissions = member.permissions.mask.toString();
                lines.push(`- \`${member.key.toBase58()}\` (permissions: ${permissions})`);
            }

            return lines.join('\n');
        } catch (error: any) {
            if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find package')) {
                return 'Error: Squads SDK not installed. Run: bun add @sqds/multisig @solana/web3.js';
            }
            logger.error('Failed to query Squads status:', error);
            return `Error querying Squads: ${error.message}`;
        }
    }
}

/**
 * ProposeSquadsTxTool
 * Propose a transaction on a Squads multi-sig on Solana.
 */
export class ProposeSquadsTxTool extends StructuredTool {
    name = 'propose_squads_tx';
    description = 'Propose a transaction on a Squads multi-sig on Solana. Creates a vault transaction proposal that members can approve.';

    schema = z.object({
        multisigAddress: z.string().describe('Squads multisig account address (base58).'),
        instructions: z.string().describe('JSON-encoded array of Solana instructions [{programId, keys, data}].'),
        description: z.string().describe('Human-readable description of the proposal.'),
        cluster: z.enum(['mainnet-beta', 'devnet']).default('devnet'),
    });

    async _call(arg: { multisigAddress: string, instructions: string, description: string, cluster: string }): Promise<string> {
        try {
            const { Connection, PublicKey, Keypair, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
            const Squads = await import('@sqds/multisig');

            const signerKey = process.env.SQUADS_SIGNER_KEY;
            if (!signerKey) {
                return 'Error: SQUADS_SIGNER_KEY not set in .env. This should be a base58-encoded private key of a Squads member.';
            }

            const endpoint = arg.cluster === 'mainnet-beta'
                ? process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
                : 'https://api.devnet.solana.com';

            const connection = new Connection(endpoint, 'confirmed');
            const multisigPda = new PublicKey(arg.multisigAddress);

            // Parse signer
            const bs58 = await import('bs58');
            const signer = Keypair.fromSecretKey(bs58.default.decode(signerKey));

            // Get current transaction index
            const multisigAccount = await Squads.multisig.accounts.Multisig.fromAccountAddress(
                connection, multisigPda
            );
            const transactionIndex = BigInt(multisigAccount.transactionIndex.toString()) + 1n;

            // Create vault transaction
            const ix = Squads.multisig.instructions.vaultTransactionCreate({
                multisigPda,
                transactionIndex,
                creator: signer.publicKey,
                vaultIndex: 0,
                ephemeralSigners: 0,
                transactionMessage: new TransactionMessage({
                    payerKey: signer.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions: JSON.parse(arg.instructions),
                }),
            });

            // Build and send
            const message = new TransactionMessage({
                payerKey: signer.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [ix],
            }).compileToV0Message();

            const tx = new VersionedTransaction(message);
            tx.sign([signer]);

            const sig = await connection.sendTransaction(tx);

            return `✅ Squads TX proposed on ${arg.cluster}:\n- **Transaction Index**: ${transactionIndex.toString()}\n- **Signature**: ${sig}\n- **Description**: ${arg.description}\n- **Status**: Awaiting member approvals (${multisigAccount.threshold} required)`;
        } catch (error: any) {
            if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find package')) {
                return 'Error: Squads SDK not installed. Run: bun add @sqds/multisig @solana/web3.js bs58';
            }
            logger.error('Failed to propose Squads TX:', error);
            return `Error proposing Squads TX: ${error.message}`;
        }
    }
}
