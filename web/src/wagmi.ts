
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Jubilee Steward',
    projectId: '6f385306b6aa92e6c664d8e5759748c2',
    chains: [base, baseSepolia],
    ssr: true, // If your dApp uses server side rendering (SSR)
});
