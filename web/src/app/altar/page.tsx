'use client';

import { useAccount, useReadContracts } from 'wagmi';
import { VaultCard } from '@/components/VaultCard';
import { ERC4626_ABI } from '@/lib/abis';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CreditCard } from 'lucide-react';

const JUBILEE_VAULTS = {
    jUSDi: {
        address: '0x26c39532C0dD06C0c4EddAeE36979626b16c77aC' as `0x${string}`,
        decimals: 6,
        ticker: 'jUSDi'
    },
    jBTCi: {
        address: '0x8a4C0254258F0D3dB7Bc5C5A43825Bb4EfC81337' as `0x${string}`,
        decimals: 8,
        ticker: 'jBTCi'
    }
};

export default function AltarPage() {
    const { address, isConnected } = useAccount();

    const handleBuyCrypto = () => {
        if (!address) return;
        const appId = process.env.NEXT_PUBLIC_COINBASE_APP_ID || '';
        // If no appId, we just point to generic pay or let them know. 
        // Actually, without App ID, Coinbase Pay might not load perfectly, but let's try the URL pattern.
        // Fallback: Just open pay.coinbase.com/signin if no params, but we want params.

        const assets = JSON.stringify(['USDC', 'ETH', 'BTC']); // cbBTC not always standard in lists yet
        const url = `https://pay.coinbase.com/buy/select-asset?appId=${appId}&destinationWalletAddress=${address}&assets=${encodeURIComponent(assets)}`;
        window.open(url, '_blank');
    };

    // Prepare contract reads for both vaults
    const vaultContract = {
        abi: ERC4626_ABI,
    } as const;

    const { data, isLoading } = useReadContracts({
        contracts: [
            // jUSDi
            { ...vaultContract, address: JUBILEE_VAULTS.jUSDi.address, functionName: 'totalAssets' },
            { ...vaultContract, address: JUBILEE_VAULTS.jUSDi.address, functionName: 'balanceOf', args: [address || '0x0'] },
            // jBTCi
            { ...vaultContract, address: JUBILEE_VAULTS.jBTCi.address, functionName: 'totalAssets' },
            { ...vaultContract, address: JUBILEE_VAULTS.jBTCi.address, functionName: 'balanceOf', args: [address || '0x0'] },
        ],
        query: {
            refetchInterval: 10000
        }
    });

    const formatValue = (val: unknown, decimals: number) => {
        if (typeof val === 'bigint') return formatUnits(val, decimals);
        return '0';
    };

    const jUSDi_TVL = data?.[0].result ? formatValue(data[0].result, 6) : '...';
    const jUSDi_Bal = data?.[1].result ? formatValue(data[1].result, 6) : '0';

    const jBTCi_TVL = data?.[2].result ? formatValue(data[2].result, 8) : '...';
    const jBTCi_Bal = data?.[3].result ? formatValue(data[3].result, 8) : '0';

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">The Altar</h1>
                    <p className="text-stone-500">Manage your offerings and view the Kingdom's Treasury.</p>
                </div>
                <div className="flex items-center gap-4">
                    {isConnected && (
                        <button
                            onClick={handleBuyCrypto}
                            className="px-4 py-2 bg-jubilee-pink/10 text-jubilee-pink hover:bg-jubilee-pink/20 font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <CreditCard size={18} />
                            Buy Crypto
                        </button>
                    )}
                    <ConnectButton />
                </div>
            </header>

            {!isConnected ? (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-12 text-center">
                    <p className="font-serif text-xl text-stone-600 mb-4">Connect your stewardship wallet to interact.</p>
                    <div className="inline-block">
                        <ConnectButton />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <VaultCard
                        name="Jubilee USD Index"
                        ticker="jUSDi"
                        address={JUBILEE_VAULTS.jUSDi.address}
                        assetAddress="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC
                        assetSymbol="USDC"
                        decimals={6}
                        balance={data?.[1].result as bigint | undefined}
                        isLoading={isLoading}
                        vaultData={data?.[0].result as bigint | undefined}
                        color="blue"
                        abi={ERC4626_ABI}
                    />
                    <VaultCard
                        name="Jubilee BTC Index"
                        ticker="jBTCi"
                        address={JUBILEE_VAULTS.jBTCi.address}
                        assetAddress="0xcbB7C00004C138A352019370adAb877192AC3112" // cbBTC
                        assetSymbol="cbBTC"
                        decimals={8}
                        balance={data?.[3].result as bigint | undefined}
                        isLoading={isLoading}
                        vaultData={data?.[2].result as bigint | undefined}
                        color="orange"
                        abi={ERC4626_ABI}
                    />
                </div>
            )}
        </div>
    );
}
