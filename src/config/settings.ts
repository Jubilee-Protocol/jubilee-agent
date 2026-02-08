
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface JubileeConfig {
    modes: {
        treasury: boolean;
        hosts: boolean;
    };
    network: 'base-mainnet' | 'base-sepolia';
}

const DEFAULT_CONFIG: JubileeConfig = {
    modes: {
        treasury: false, // Default to FALSE (Opt-in)
        hosts: true,     // Default to TRUE (Core feature)
    },
    network: 'base-mainnet',
};

export class ConfigManager {
    private static instance: ConfigManager;
    private configPath: string;
    private config: JubileeConfig;

    private constructor() {
        const homeDir = os.homedir();
        const configDir = path.join(homeDir, '.jubilee');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        this.configPath = path.join(configDir, 'config.json');
        this.config = this.loadConfig();
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private loadConfig(): JubileeConfig {
        if (fs.existsSync(this.configPath)) {
            try {
                const raw = fs.readFileSync(this.configPath, 'utf8');
                return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
            } catch (e) {
                console.error("Failed to load config, using defaults:", e);
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    }

    public getConfig(): JubileeConfig {
        return this.config;
    }

    public setMode(mode: 'treasury' | 'hosts', enabled: boolean) {
        this.config.modes[mode] = enabled;
        this.saveConfig();
        console.log(`✅ Config Updated: ${mode} mode is now ${enabled ? 'ENABLED' : 'DISABLED'}.`);
    }

    public setNetwork(network: 'base-mainnet' | 'base-sepolia') {
        this.config.network = network;
        this.saveConfig();
    }

    private saveConfig() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }
}
