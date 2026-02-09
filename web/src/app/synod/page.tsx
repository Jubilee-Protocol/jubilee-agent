'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Power, Shield, Settings, Key, ExternalLink, Save } from 'lucide-react';
import { OnboardingScreen } from '@/components/OnboardingScreen';

const READ_TOKEN = process.env.NEXT_PUBLIC_READ_TOKEN || 'public_read';
// For writing settings, we might need ADMIN token? 
// Yes, settings is HIGHLY sensitive. 
// We should check localStorage for admin token.

const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', model: 'gpt-4o', link: 'https://platform.openai.com/api-keys' },
    { id: 'anthropic', name: 'Anthropic', model: 'claude-3-5-sonnet-20240620', link: 'https://console.anthropic.com/settings/keys' },
    { id: 'google', name: 'Google Gemini', model: 'gemini-1.5-pro', link: 'https://aistudio.google.com/app/apikey' },
    { id: 'openrouter', name: 'OpenRouter', model: 'openrouter:openai/gpt-4o', link: 'https://openrouter.ai/keys' },
    { id: 'grok', name: 'xAI (Grok)', model: 'grok-beta', link: 'https://console.x.ai/' },
];

export default function SynodPage() {
    const queryClient = useQueryClient();
    const [adminToken, setAdminToken] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'intelligence' | 'capabilities'>('intelligence');

    // State for form
    const [selectedProvider, setSelectedProvider] = useState('openai');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [selectedModel, setSelectedModel] = useState('gpt-4o');
    const [skills, setSkills] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const token = localStorage.getItem('JUBILEE_ADMIN_TOKEN');
        setAdminToken(token);
    }, []);

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            if (!adminToken) return null;
            const res = await fetch('http://localhost:3001/settings', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch settings');
            return res.json();
        },
        enabled: !!adminToken
    });

    // Populate local mock state from data when loaded
    useEffect(() => {
        if (data?.settings) {
            setSelectedProvider(data.settings.modelProvider || 'openai');
            setSelectedModel(data.settings.modelName || 'gpt-4o');
            setSkills(data.settings.skills || {});
        }
    }, [data]);

    const mutation = useMutation({
        mutationFn: async (newSettings: any) => {
            const res = await fetch('http://localhost:3001/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(newSettings)
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        },
        onSuccess: () => {
            // alert('Settings Saved!'); // Too noisy? 
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        }
    });

    const handleSaveAI = () => {
        const updates: any = {
            modelProvider: selectedProvider,
            modelName: selectedModel,
            apiKeys: {}
        };
        // ... (existing logic for API keys)
        const envMap: Record<string, string> = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            google: 'GOOGLE_API_KEY',
            grok: 'XAI_API_KEY',
            openrouter: 'OPENROUTER_API_KEY'
        };
        const envVar = envMap[selectedProvider];
        if (apiKeyInput && envVar) {
            updates.apiKeys[envVar] = apiKeyInput;
        }

        mutation.mutate(updates, {
            onSuccess: () => {
                alert('Intelligence Settings Saved!');
                setApiKeyInput('');
            }
        });
    };

    const toggleSkill = (skillId: string) => {
        const newSkills = { ...skills, [skillId]: !skills[skillId] };
        setSkills(newSkills); // Optimistic update
        mutation.mutate({ skills: newSkills });
    };

    if (!adminToken) {
        if (!adminToken) {
            return <OnboardingScreen onComplete={(token) => setAdminToken(token)} />;
        }
    }

    if (isLoading) return <div className="p-8 text-center animate-pulse">Consulting the Synod...</div>;

    const currentProviderInfo = API_PROVIDERS.find(p => p.id === selectedProvider);

    return (
        <div className="p-8 max-w-4xl mx-auto pb-32">
            <header className="mb-8">
                <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">The Synod</h1>
                <p className="text-stone-500">Configure the behavior and capabilities of the Jubilee OS.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-6 mb-8 border-b border-stone-100">
                <button
                    onClick={() => setActiveTab('intelligence')}
                    className={`pb-4 text-sm font-bold transition-colors ${activeTab === 'intelligence' ? 'text-jubilee-pink border-b-2 border-jubilee-pink' : 'text-stone-400 hover:text-stone-600'}`}
                >
                    Intelligence
                </button>
                <button
                    onClick={() => setActiveTab('capabilities')}
                    className={`pb-4 text-sm font-bold transition-colors ${activeTab === 'capabilities' ? 'text-jubilee-pink border-b-2 border-jubilee-pink' : 'text-stone-400 hover:text-stone-600'}`}
                >
                    Capabilities (Skills)
                </button>
            </div>

            <div className="space-y-6">

                {activeTab === 'intelligence' && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 rounded-lg bg-jubilee-pink/10 text-jubilee-pink">
                                <Settings size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-stone-900">Intelligence Provider</h3>
                                <p className="text-stone-500 text-sm">Select which core intelligence runs the Jubilee OS.</p>
                            </div>
                        </div>

                        <div className="bg-stone-50 p-6 rounded-xl border border-stone-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Provider</label>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => {
                                            const p = API_PROVIDERS.find(x => x.id === e.target.value);
                                            setSelectedProvider(e.target.value);
                                            if (p) setSelectedModel(p.model);
                                        }}
                                        className="w-full p-3 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-jubilee-pink"
                                    >
                                        {API_PROVIDERS.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Model ID</label>
                                    <input
                                        type="text"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full p-3 bg-white border border-stone-200 rounded-lg text-stone-800 font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">
                                    API Key for {currentProviderInfo?.name}
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                                            <Key size={16} />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder={data?.settings?.apiKeys?.[currentProviderInfo?.id === 'openai' ? 'OPENAI_API_KEY' : (currentProviderInfo?.id === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'API_KEY')] ? "••••••••••••••••" : "Enter API Key"}
                                            value={apiKeyInput}
                                            onChange={(e) => setApiKeyInput(e.target.value)}
                                            className="w-full pl-10 pr-3 py-3 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-jubilee-pink"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveAI}
                                        disabled={mutation.isPending}
                                        className="px-6 bg-stone-900 text-white font-bold rounded-lg hover:bg-black transition-colors flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'capabilities' && (
                    <div className="space-y-6">
                        {/* Ministry Skills */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-stone-900">Ministry Skills</h3>
                                <p className="text-stone-500 text-sm">Core capabilities for church stewardship.</p>
                            </div>
                            <div className="space-y-4">
                                {['sermon_research', 'member_care'].map(skill => (
                                    <div key={skill} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${skills[skill] ? 'bg-green-500' : 'bg-red-400'}`} />
                                            <div>
                                                <h4 className="font-bold text-stone-800 capitalize">{skill.replace('_', ' ')}</h4>
                                                <p className="text-xs text-stone-500">Core Ministry Module</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSkill(skill)}
                                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${skills[skill]
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                }`}
                                        >
                                            {skills[skill] ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* The Reach (Socials) */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-stone-900">The Reach (Socials)</h3>
                                <p className="text-stone-500 text-sm">Connect Jubilee to external social networks.</p>
                            </div>
                            <div className="space-y-4">
                                {['twitter', 'farcaster', 'gmail', 'youtube', 'facebook'].map(skill => (
                                    <div key={skill} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${skills[skill] ? 'bg-green-500' : 'bg-stone-300'}`} />
                                            <div>
                                                <h4 className="font-bold text-stone-800 capitalize">{skill}</h4>
                                                <p className="text-xs text-stone-500">External Integration</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSkill(skill)}
                                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${skills[skill]
                                                ? 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                                                : 'bg-stone-900 text-white hover:bg-black'
                                                }`}
                                        >
                                            {skills[skill] ? 'Disconnect' : 'Connect'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
