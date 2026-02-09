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

const DEFAULT_SETTINGS: SystemSettings = {
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    apiKeys: {},
    skills: {}
};

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
            this.cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };

            // Merge environment keys if not in settings? 
            // Better behavior: If key in settings, use it. If not, use ENV.
            // But here we just return what's in settings file. 
            // The AgentService will merge this with ENV.
            return this.cachedSettings!;
        } catch (error) {
            // If file doesn't exist, return default (and maybe save it?)
            return DEFAULT_SETTINGS;
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
