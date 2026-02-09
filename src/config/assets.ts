
// Jubilee Protocol - Asset Configuration
// Network: Base Mainnet

export const JUBILEE_VAULTS = {
    // Jubilee USD Index
    jUSDi: {
        address: '0x26c39532C0dD06C0c4EddAeE36979626b16c77aC',
        decimals: 6,
        asset: 'USDC'
    },
    // Jubilee BTC Index
    jBTCi: {
        address: '0x8a4C0254258F0D3dB7Bc5C5A43825Bb4EfC81337',
        decimals: 8,
        asset: 'cbBTC'
    }
} as const;

export const SUPPORTED_ASSETS = {
    USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6
    },
    cbBTC: {
        address: '0xcbB7C00004C138A352019370adAb877192AC3112',
        decimals: 8
    }
} as const;

export const TREASURY_CONFIG = {
    // Default fallback if env var is missing
    networkId: 'base-mainnet'
} as const;
