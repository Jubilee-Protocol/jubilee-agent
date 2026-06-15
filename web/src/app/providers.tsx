'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import dynamic from 'next/dynamic';

const queryClient = new QueryClient();

// Dynamically import ClientProviders with SSR disabled to prevent 
// WalletConnect/localStorage reference errors during server-side build.
const ClientProviders = dynamic(
    () => import('./ClientProviders').then((mod) => mod.ClientProviders),
    { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
                <ClientProviders>
                    {children}
                </ClientProviders>
            </NextThemesProvider>
        </QueryClientProvider>
    );
}
