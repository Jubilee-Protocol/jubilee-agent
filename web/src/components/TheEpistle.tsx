
'use client';

import { useQuery } from '@tanstack/react-query';

const AGENT_API = 'http://localhost:3001';

async function fetchEpistle() {
    const token = process.env.NEXT_PUBLIC_READ_TOKEN;
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${AGENT_API}/epistle`, { headers });
    if (!res.ok) throw new Error('Silence');
    return res.json();
}

export function TheEpistle() {
    const { data: epistleData, isLoading } = useQuery({
        queryKey: ['epistle'],
        queryFn: fetchEpistle,
        refetchInterval: 3000
    });

    return (
        <div className="bg-white border border-stone-200 rounded-xl p-6">
            <h3 className="font-serif text-xl text-stone-900 mb-6 flex items-center gap-2">
                The Epistle <span className="text-stone-400 text-sm font-sans font-normal">(Live Acts)</span>
            </h3>

            {isLoading ? (
                <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-stone-100 rounded w-3/4"></div>
                    <div className="h-4 bg-stone-100 rounded w-1/2"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {epistleData?.logs?.map((log: any) => (
                        <div key={log.id} className="flex gap-4 items-start border-l-2 border-stone-100 pl-4 py-1 hover:border-jubilee-pink transition-colors">
                            <div className="min-w-[50px] pt-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.type === 'PROPHET' ? 'bg-purple-100 text-purple-700' :
                                    log.type === 'MIND' ? 'bg-blue-100 text-blue-700' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                    {log.type}
                                </span>
                            </div>
                            <div>
                                <p className="text-stone-800 text-sm font-medium">{log.message}</p>
                                <p className="text-stone-400 text-xs mt-0.5 font-mono">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
