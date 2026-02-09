'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Database, Calendar, Trash2, Loader2 } from 'lucide-react';
import { OnboardingScreen } from '@/components/OnboardingScreen';

// Using the same Read Token as other components
const READ_TOKEN = process.env.NEXT_PUBLIC_READ_TOKEN || 'public_read';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || ''; // Required for deletion

interface Memory {
    id: number;
    text: string;
    score: number;
    metadata: { source?: string };
}

export default function ArchivesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Check for token on mount
    useEffect(() => {
        const t = localStorage.getItem('JUBILEE_ADMIN_TOKEN');
        setToken(t);
    }, []);

    const { data, isLoading, error } = useQuery({
        queryKey: ['memories', searchQuery, token],
        queryFn: async () => {
            // Use Admin Token if available, otherwise fallback to Read Token
            const authHeader = token || READ_TOKEN;

            const res = await fetch(`http://localhost:3001/memory?q=${encodeURIComponent(searchQuery)}`, {
                headers: {
                    'Authorization': `Bearer ${authHeader}`
                }
            });
            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized');
                throw new Error('Failed to fetch memories');
            }
            const json = await res.json();
            return json as { results: Memory[] };
        },
        // Only run if we have some token (read token is always there as fallback, but logic ok)
        retry: false
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!token) throw new Error('Admin Token required for deletion');

            const res = await fetch(`http://localhost:3001/memory/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete');
            }
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memories'] });
        },
        onError: (err) => {
            alert(`Failed to delete: ${err.message}`);
        }
    });

    // If unauthorized error, show onboarding
    if (error && error.message === 'Unauthorized') {
        return <OnboardingScreen onComplete={(t) => {
            setToken(t);
            // Query will auto-refetch due to key change
        }} />;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">The Archives</h1>
                <p className="text-stone-500">Explore and curate the collective memory of the Jubilee Agent.</p>
            </header>

            {/* Search Bar */}
            <div className="relative mb-8">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-stone-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-stone-200 rounded-lg leading-5 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-jubilee-pink focus:border-jubilee-pink sm:text-sm shadow-sm"
                    placeholder="Search memories (e.g. 'Jubilee Vision', 'Treasury')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="text-center py-12 text-stone-400 animate-pulse">
                    Scanning Neural Pathways...
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    Error accessing archives: {String(error)}
                </div>
            ) : (
                <div className="grid gap-4">
                    {data?.results && data.results.length > 0 ? (
                        data.results.map((mem, i) => (
                            <div key={mem.id || i} className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 hover:border-jubilee-pink/30 transition-colors group relative">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-stone-50 rounded-lg text-stone-400 group-hover:text-jubilee-pink transition-colors">
                                        <Database size={16} />
                                    </div>
                                    <div className="flex-1 pr-8">
                                        <p className="text-stone-800 leading-relaxed font-serif">
                                            {typeof mem === 'string' ? mem : mem.text}
                                        </p>
                                        <div className="mt-3 flex items-center gap-4 text-xs text-stone-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                Archived Memory #{typeof mem === 'string' ? 'Legacy' : mem.id}
                                            </span>
                                            <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-500">
                                                Vector Retrieval
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* Delete Button */}
                                {typeof mem !== 'string' && token && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to forget this memory?')) {
                                                deleteMutation.mutate(mem.id);
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                        className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Forget Memory"
                                    >
                                        {deleteMutation.isPending && deleteMutation.variables === mem.id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                            No memories found matching your query.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
