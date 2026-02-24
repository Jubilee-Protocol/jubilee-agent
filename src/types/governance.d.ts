/**
 * Type declarations for optional governance SDK dependencies.
 * These packages are dynamically imported and only needed when governance features are used.
 *
 * Install when ready:
 *   bun add @safe-global/protocol-kit @safe-global/api-kit   # EVM multi-sig
 *   bun add @sqds/multisig                                    # Solana multi-sig
 */

declare module '@safe-global/api-kit' {
    interface SafeApiKitConfig {
        chainId: bigint;
    }

    interface SafeMultisigTransactionResponse {
        nonce: number;
        to: string;
        confirmations?: any[];
        isExecuted: boolean;
    }

    interface SafeInfoResponse {
        threshold: number;
        owners: string[];
        nonce: number;
    }

    export default class SafeApiKit {
        constructor(config: SafeApiKitConfig);
        getSafeInfo(safeAddress: string): Promise<SafeInfoResponse>;
        getPendingTransactions(safeAddress: string): Promise<{ results: SafeMultisigTransactionResponse[] }>;
        proposeTransaction(args: {
            safeAddress: string;
            safeTransactionData: any;
            safeTxHash: string;
            senderAddress: string;
            senderSignature: string;
        }): Promise<void>;
    }
}

declare module '@safe-global/protocol-kit' {
    interface SafeInitConfig {
        provider: string;
        signer: string;
        safeAddress: string;
    }

    interface SafeTransaction {
        data: any;
        signatures: Map<string, { data: string }>;
    }

    export default class Safe {
        static init(config: SafeInitConfig): Promise<Safe>;
        createTransaction(args: { transactions: Array<{ to: string; data: string; value: string }> }): Promise<SafeTransaction>;
        signTransaction(tx: SafeTransaction): Promise<SafeTransaction>;
        getTransactionHash(tx: SafeTransaction): Promise<string>;
        getChainId(): Promise<number>;
        getAddress(): Promise<string>;
    }
}

declare module '@sqds/multisig' {
    export namespace multisig {
        namespace accounts {
            class Multisig {
                threshold: number;
                members: Array<{ key: { toBase58(): string }; permissions: { mask: number } }>;
                transactionIndex: bigint;
                static fromAccountAddress(connection: any, address: any): Promise<Multisig>;
            }
        }

        function getVaultPda(args: { multisigPda: any; index: number }): [any, number];

        namespace instructions {
            function vaultTransactionCreate(args: {
                multisigPda: any;
                transactionIndex: bigint;
                creator: any;
                vaultIndex: number;
                ephemeralSigners: number;
                transactionMessage: any;
            }): any;
        }
    }
}
