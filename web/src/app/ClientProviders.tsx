'use client';

import * as React from 'react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { config } from '../wagmi';

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
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
        </WagmiProvider>
    );
}
