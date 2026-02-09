'use client';

import { useState, useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { OnboardingScreen } from '@/components/OnboardingScreen';

const AGENT_API = process.env.NEXT_PUBLIC_VOICE_URL || 'http://localhost:3001';

export default function ThePulpit() {
    const [token, setToken] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial check for token
    useEffect(() => {
        const storedToken = localStorage.getItem('JUBILEE_ADMIN_TOKEN');
        if (storedToken) {
            setToken(storedToken);
            setIsAuthenticated(true);
        }
    }, []);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('JUBILEE_ADMIN_TOKEN', token);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('JUBILEE_ADMIN_TOKEN');
        setToken('');
        setIsAuthenticated(false);
        setMessages([]);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const res = await fetch(`${AGENT_API}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMsg })
            });

            if (!res.ok) {
                if (res.status === 401) {
                    alert('Session expired or invalid token.');
                    handleLogout();
                    return;
                }
                throw new Error('Failed to speak to The Agent');
            }

            // Prepare to receive stream
            if (!res.body) throw new Error('No response body');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            // Add a placeholder message for the agent
            setMessages(prev => [...prev, { role: 'agent', content: '' }]);
            let agentResponseText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);

                        // Handle different event types
                        if (event.type === 'thinking') {
                            if (agentResponseText) agentResponseText += '\n';
                            agentResponseText += `*Thinking: ${event.message}*`;
                        } else if (event.type === 'tool_start') {
                            if (agentResponseText) agentResponseText += '\n';
                            agentResponseText += `*Executing: ${event.tool}...*`;
                        } else if (event.type === 'done') {
                            agentResponseText += `\n\n${event.answer}`;
                        } else if (event.type === 'error') {
                            agentResponseText += `\n❌ Error: ${event.error}`;
                        }

                        // Update the last message
                        setMessages(prev => {
                            const newHistory = [...prev];
                            const lastMsg = newHistory[newHistory.length - 1];
                            if (lastMsg.role === 'agent') {
                                lastMsg.content = agentResponseText;
                            }
                            return newHistory;
                        });

                    } catch (e) {
                        // ignore partial JSON parse errors
                    }
                }
            }

        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'agent', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return <OnboardingScreen onComplete={(t) => {
            setToken(t);
            setIsAuthenticated(true);
        }} />;
    }

    return (
        <div className="flex flex-col h-screen h-[calc(100vh)]">
            {/* Header */}
            <header className="bg-white border-b border-stone-200 p-6 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900 mb-1">The Pulpit</h1>
                    <p className="text-stone-500">Commune with the Jubilee Agent.</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                    title="Logout"
                >
                    <LogOut size={20} />
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#fdfbf7]">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.length === 0 && (
                        <div className="text-center py-20 opacity-50">
                            <p className="font-serif text-2xl text-stone-300">Speak, and I shall answer.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user'
                                    ? 'bg-jubilee-pink text-white rounded-tr-none'
                                    : 'bg-white text-stone-800 border border-stone-100 rounded-tl-none'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white text-stone-400 border border-stone-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                                <span className="animate-pulse">Thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-stone-200 p-6 sticky bottom-0">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={sendMessage} className="flex gap-4">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Command the Agent..."
                            className="flex-1 p-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jubilee-pink bg-stone-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-stone-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
