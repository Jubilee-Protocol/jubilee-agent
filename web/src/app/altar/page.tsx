'use client';

import dynamic from 'next/dynamic';

const AltarPageContent = dynamic(() => import('./AltarPageContent'), {
    ssr: false,
    loading: () => (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">The Altar</h1>
                    <p className="text-stone-500">Loading your offerings and the Kingdom's Treasury...</p>
                </div>
            </header>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-12 text-center">
                <p className="font-serif text-xl text-stone-600">Initializing connections...</p>
            </div>
        </div>
    )
});

export default function AltarPage() {
    return <AltarPageContent />;
}
