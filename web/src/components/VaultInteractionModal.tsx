'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { X, ArrowRight, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ERC20_ABI, ERC4626_ABI } from '../lib/abis';

interface VaultInteractionModalProps {
    isOpen: boolean;
    onClose: () => void;
    vaultAddress: `0x${string}`;
    assetAddress: `0x${string}`;
    vaultName: string;
    vaultSymbol: string;
    assetSymbol: string;
    decimals: number;
    userBalance: bigint; // Vault Share Balance
}

export function VaultInteractionModal({
    isOpen, onClose, vaultAddress, assetAddress, vaultName, vaultSymbol, assetSymbol, decimals, userBalance
}: VaultInteractionModalProps) {
    const { address } = useAccount();
    const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
    const [amount, setAmount] = useState('');
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

    // Wagmi Hooks
    const { writeContract, isPending: isWritePending, error: writeError } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Asset Balance (How much USDC do I have?)
    const { data: assetBalance } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
        query: { enabled: !!address }
    });

    // Allowance (How much USDC can the Vault spend?)
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, vaultAddress],
        query: { enabled: !!address }
    });

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setTxHash(undefined);
            setAmount('');
        }
    }, [isOpen]);

    // Refetch allowance after approval confirms
    useEffect(() => {
        if (isConfirmed) {
            refetchAllowance();
            // Don't close automatically, let user see success
        }
    }, [isConfirmed, refetchAllowance]);


    if (!isOpen) return null;

    const parsedAmount = amount ? parseUnits(amount, decimals) : BigInt(0);
    const needsApproval = mode === 'deposit' && (allowance || BigInt(0)) < parsedAmount;

    const handleAction = () => {
        if (needsApproval) {
            writeContract({
                address: assetAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [vaultAddress, parsedAmount],
            }, {
                onSuccess: (hash) => setTxHash(hash)
            });
        } else if (mode === 'deposit') {
            writeContract({
                address: vaultAddress,
                abi: ERC4626_ABI,
                functionName: 'deposit',
                args: [parsedAmount, address!],
            }, {
                onSuccess: (hash) => setTxHash(hash)
            });
        } else {
            // Withdraw (Redeem Shares)
            // For simplicity, we assume 1 share = 1 asset roughly, but rigorous UI would use convertToShares
            // Here we just redeem SHARES. So input amount is SHARES.
            writeContract({
                address: vaultAddress,
                abi: ERC4626_ABI,
                functionName: 'redeem',
                args: [parsedAmount, address!, address!],
            }, {
                onSuccess: (hash) => setTxHash(hash)
            });
        }
    };

    const isProcessing = isWritePending || isConfirming;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-stone-200">
                {/* Header */}
                <div className="bg-stone-50 p-4 border-b border-stone-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-serif font-bold text-stone-900">{vaultName}</h3>
                        <p className="text-xs text-stone-500 font-mono">{vaultSymbol}</p>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 text-sm font-bold border-b border-stone-100">
                    <button
                        onClick={() => setMode('deposit')}
                        className={`p-3 transition-colors ${mode === 'deposit' ? 'text-jubilee-pink bg-jubilee-pink/5 border-b-2 border-jubilee-pink' : 'text-stone-500 hover:bg-stone-50'}`}
                    >
                        Deposit {assetSymbol}
                    </button>
                    <button
                        onClick={() => setMode('withdraw')}
                        className={`p-3 transition-colors ${mode === 'withdraw' ? 'text-jubilee-pink bg-jubilee-pink/5 border-b-2 border-jubilee-pink' : 'text-stone-500 hover:bg-stone-50'}`}
                    >
                        Withdraw
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">

                    {/* Input */}
                    <div>
                        <div className="flex justify-between text-xs text-stone-500 mb-1">
                            <span>Amount</span>
                            <span>
                                Max: {mode === 'deposit'
                                    ? (assetBalance ? formatUnits(assetBalance, decimals) : '0')
                                    : formatUnits(userBalance, decimals)}
                            </span>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full text-2xl p-3 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jubilee-pink font-mono text-stone-900"
                                placeholder="0.00"
                                disabled={isProcessing}
                            />
                            <button
                                onClick={() => {
                                    const max = mode === 'deposit' ? assetBalance : userBalance;
                                    if (max) setAmount(formatUnits(max, decimals));
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-stone-200 hover:bg-stone-300 px-2 py-1 rounded text-stone-600 font-bold"
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-stone-50 p-3 rounded-lg text-xs space-y-2">
                        <div className="flex justify-between text-stone-500">
                            <span>You Receive</span>
                            <span className="font-bold text-stone-700">
                                {mode === 'deposit' ? `${vaultSymbol} Shares` : `${assetSymbol}`}
                            </span>
                        </div>
                        {mode === 'deposit' && allowance !== undefined && allowance < parsedAmount && (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded">
                                <ShieldAlert size={14} />
                                <span>Wait! Need approval first.</span>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleAction}
                        disabled={!amount || isProcessing}
                        className="w-full py-3 bg-stone-900 text-white font-bold rounded-lg hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {isConfirming ? 'Confirming...' : 'Check Wallet...'}
                            </>
                        ) : isConfirmed && txHash ? (
                            <>
                                <CheckCircle2 size={18} className="text-green-400" />
                                Success!
                            </>
                        ) : (
                            <>
                                {needsApproval ? 'Approve Spending' : (mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw')}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    {writeError && (
                        <div className="text-xs text-red-500 text-center break-words">
                            {writeError.message.slice(0, 100)}...
                        </div>
                    )}

                    {txHash && (
                        <a
                            href={`https://basescan.org/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-xs text-jubilee-pink hover:underline"
                        >
                            View on Basescan
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

