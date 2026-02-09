'use client';

import { TheEpistle } from '@/components/TheEpistle';

export default function EpistlePage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">The Epistle</h1>
                <p className="text-stone-500">The living chronicles of the Jubilee Agent.</p>
            </header>

            <TheEpistle />
        </div>
    );
}
