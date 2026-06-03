import fs from 'fs/promises';
import path from 'path';

export interface SystemSettings {
    modelProvider: string; // 'openai', 'anthropic', 'google', ...
    modelName: string;     // 'gpt-4o', 'claude-3-5-sonnet-20240620'
    apiKeys: {
        OPENAI_API_KEY?: string;
        ANTHROPIC_API_KEY?: string;
        GOOGLE_API_KEY?: string;
        XAI_API_KEY?: string;
        OPENROUTER_API_KEY?: string;
        [key: string]: string | undefined;
    };
    skills: {
        [key: string]: boolean; // e.g. 'twitter': true
    };
}

// Determine best default provider based on available env vars
function getDefaultSettings(): SystemSettings {
    if (process.env.OPENROUTER_API_KEY) {
        return {
            modelProvider: 'openrouter',
            modelName: 'openrouter:anthropic/claude-3.5-sonnet',
            apiKeys: {},
            skills: {}
        };
    }
    if (process.env.GOOGLE_API_KEY) {
        return {
            modelProvider: 'google',
            modelName: 'gemini-2.5-flash',
            apiKeys: {},
            skills: {}
        };
    }
    if (process.env.ANTHROPIC_API_KEY) {
        return {
            modelProvider: 'anthropic',
            modelName: 'claude-3-5-sonnet-20240620',
            apiKeys: {},
            skills: {}
        };
    }
    // Final fallback
    return {
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKeys: {},
        skills: {}
    };
}

export class SettingsService {
    private static instance: SettingsService;
    private settingsPath: string;
    private cachedSettings: SystemSettings | null = null;

    private constructor() {
        // Ensure data dir exists
        this.settingsPath = path.join(process.cwd(), 'data', 'settings.json');
    }

    static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    async getSettings(): Promise<SystemSettings> {
        if (this.cachedSettings) return this.cachedSettings;

        try {
            await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
            const data = await fs.readFile(this.settingsPath, 'utf-8');
            this.cachedSettings = { ...getDefaultSettings(), ...JSON.parse(data) };
            return this.cachedSettings!;
        } catch (error) {
            // No settings file — auto-detect best provider from env vars
            return getDefaultSettings();
        }
    }

    async updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
        const current = await this.getSettings();

        // Deep merge for apiKeys
        const updatedmsg = {
            ...current,
            ...newSettings,
            apiKeys: {
                ...current.apiKeys,
                ...(newSettings.apiKeys || {})
            }
        };

        this.cachedSettings = updatedmsg;
        await fs.writeFile(this.settingsPath, JSON.stringify(updatedmsg, null, 2));
        return updatedmsg;
    }
}
