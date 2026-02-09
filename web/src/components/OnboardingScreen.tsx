'use client';

import { useState } from 'react';
import { Shield, Key, CheckCircle, ArrowRight } from 'lucide-react';

interface OnboardingScreenProps {
    onComplete: (token: string) => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const [token, setToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Verify token by hitting a protected endpoint
            const res = await fetch('http://localhost:3001/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Success!
                localStorage.setItem('JUBILEE_ADMIN_TOKEN', token);
                onComplete(token);
            } else {
                throw new Error('Invalid Admin Token');
            }
        } catch (err) {
            setError('Authentication failed. Please check your token.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-stone-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Shield size={200} />
                </div>

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-jubilee-pink/10 rounded-2xl flex items-center justify-center text-jubilee-pink mb-6">
                        <Key size={32} />
                    </div>

                    <h1 className="text-3xl font-serif font-bold text-stone-900 mb-3">Welcome, Steward.</h1>
                    <p className="text-stone-500 mb-8">
                        To access the Jubilee OS, please verify your identity with the High Priest Key (Admin Token).
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">
                                Admin Token (System Password)
                            </label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="JUBILEE_ADMIN_TOKEN (from .env)"
                                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-jubilee-pink transition-all font-mono"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <Shield size={14} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!token || isLoading}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${token
                                ? 'bg-stone-900 text-white hover:bg-black shadow-lg hover:shadow-xl translate-y-0'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? (
                                <span className="animate-pulse">Verifying...</span>
                            ) : (
                                <>
                                    Enter The Kingdom
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-xs text-center text-stone-400">
                        This is your self-hosted system password, <strong>not</strong> your OpenAI key.<br />
                        You will configure AI Providers inside The Synod.
                    </p>
                </div>
            </div>
        </div>
    );
}
