
'use client';

import * as React from 'react';
import {
    RainbowKitProvider,
    darkTheme,
    lightTheme
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../wagmi';

const queryClient = new QueryClient();

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
                    <RainbowKitProvider
                        theme={lightTheme({
                            accentColor: '#d4af37',
                            accentColorForeground: 'white',
                            borderRadius: 'small',
                            fontStack: 'system',
                        })}
                    >
                        {children}
                    </RainbowKitProvider>
                </NextThemesProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
