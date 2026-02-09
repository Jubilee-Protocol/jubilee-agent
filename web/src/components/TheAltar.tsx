
'use client';

import { useQuery } from '@tanstack/react-query';

const AGENT_API = 'http://localhost:3001';

async function fetchTreasury() {
    const token = process.env.NEXT_PUBLIC_READ_TOKEN;
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${AGENT_API}/treasury`, { headers });
    if (!res.ok) throw new Error('The Voice is silent');
    return res.json();
}

export function TheAltar() {
    const { data: agentData, isLoading, error } = useQuery({
        queryKey: ['treasury'],
        queryFn: fetchTreasury,
        refetchInterval: 5000
    });

    if (isLoading) return <div className="text-center py-8 text-stone-400 italic font-serif">Communing with The Almoner...</div>;
    if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center">Connection Lost: {String(error)}</div>;

    return (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden relative">
            {/* Decorative Top Bar */}
            <div className="h-2 bg-jubilee-pink w-full absolute top-0 left-0" />

            <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xs font-sans font-bold text-stone-400 uppercase tracking-widest mb-2">Treasury Status</h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-serif font-bold text-stone-900">
                                {agentData.address ? `${agentData.address.slice(0, 6)}...${agentData.address.slice(-4)}` : 'Unknown'}
                            </span>
                            <span className="bg-jubilee-pink/10 text-jubilee-pink text-xs font-bold px-2 py-1 rounded-full uppercase">Active</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                        <h3 className="font-serif text-lg text-stone-700 mb-1">jUSDi Vault</h3>
                        <p className="text-xs text-stone-400 font-mono mb-4">{agentData.vaults?.jUSDi?.address}</p>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-stone-500">Asset</span>
                            <span className="font-bold text-stone-800">USDC</span>
                        </div>
                    </div>

                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                        <h3 className="font-serif text-lg text-stone-700 mb-1">jBTCi Vault</h3>
                        <p className="text-xs text-stone-400 font-mono mb-4">{agentData.vaults?.jBTCi?.address}</p>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-stone-500">Asset</span>
                            <span className="font-bold text-stone-800">cbBTC</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
