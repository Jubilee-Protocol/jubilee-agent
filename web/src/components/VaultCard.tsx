'use client';

import { formatUnits } from 'viem';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { VaultInteractionModal } from './VaultInteractionModal';

interface VaultCardProps {
    name: string;
    ticker: string;
    address: `0x${string}`;
    assetAddress: `0x${string}`; // Added
    abi: any;
    decimals?: number;
    assetSymbol: string;    // e.g. "USDC"
    balance: bigint | undefined; // New prop
    isLoading: boolean; // New prop
    vaultData: bigint | undefined; // New prop
    color: string;
}

export function VaultCard({ name, ticker, address, assetAddress, assetSymbol, decimals = 18, balance, isLoading, vaultData, color }: VaultCardProps) {
    const formattedBalance = balance !== undefined ? Number(formatUnits(balance, decimals)).toFixed(2) : '-.--';

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Determine activeClass based on vaultData
    const activeClass = vaultData && vaultData > BigInt(0) ? 'border-green-200' : 'border-stone-200';

    return (
        <>
            <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${activeClass}`}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-serif font-bold text-lg text-stone-900">{name}</h3>
                        <p className="text-xs font-mono text-stone-400">{address.slice(0, 6)}...{address.slice(-4)}</p>
                    </div>
                    {isLoading ? (
                        <div className="h-6 w-16 bg-stone-100 rounded animate-pulse" />
                    ) : (
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${vaultData && vaultData > BigInt(0)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-stone-100 text-stone-500'
                            }`}>
                            {vaultData && vaultData > BigInt(0) ? 'Active' : 'Empty'}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Assets (TVL)</p>
                        <p className="font-mono text-xl text-stone-800">
                            {isLoading ? '...' : formatUnits(vaultData || BigInt(0), decimals)}
                            <span className="text-sm text-stone-400 ml-1">{ticker}</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Your Shares</p>
                        <p className="font-mono text-xl text-stone-800">
                            {formattedBalance}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color === 'amber' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                        <span className="text-xs font-bold text-stone-400">{assetSymbol} Strategy</span>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-sm font-bold text-stone-900 hover:text-jubilee-pink transition-colors flex items-center gap-1"
                    >
                        Manage <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <VaultInteractionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                vaultAddress={address}
                assetAddress={assetAddress}
                vaultName={name}
                vaultSymbol={ticker}
                assetSymbol={assetSymbol}
                decimals={decimals}
                userBalance={balance || BigInt(0)}
            />
        </>
    );
}
