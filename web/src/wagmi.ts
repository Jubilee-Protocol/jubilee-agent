
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Jubilee Steward',
    projectId: 'YOUR_PROJECT_ID', // TODO: Get from cloud.walletconnect.com
    chains: [base, baseSepolia],
    ssr: true, // If your dApp uses server side rendering (SSR)
});
