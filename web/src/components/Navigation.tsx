'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    MessageSquare,
    ScrollText,
    Brain,
    Settings,
    Crown
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
    { name: 'The Pulpit', href: '/pulpit', icon: MessageSquare },
    { name: 'The Altar', href: '/altar', icon: LayoutDashboard },
    { name: 'The Epistle', href: '/epistle', icon: ScrollText },
    { name: 'The Archives', href: '/archives', icon: Brain },
    { name: 'The Synod', href: '/synod', icon: Settings },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <nav className="w-64 bg-white border-r border-stone-200 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto hidden md:flex z-50">
            {/* Header */}
            <div className="p-6 border-b border-stone-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-jubilee-pink rounded-lg flex items-center justify-center text-white">
                    <Crown size={18} />
                </div>
                <div>
                    <h1 className="font-serif font-bold text-stone-900 leading-tight">Jubilee</h1>
                    <p className="text-xs text-stone-500 tracking-widest uppercase">Steward v1</p>
                </div>
            </div>

            {/* Links */}
            <div className="flex-1 py-6 px-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-jubilee-pink/5 text-jubilee-pink font-semibold'
                                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                                }`}
                        >
                            <item.icon
                                size={18}
                                className={isActive ? 'text-jubilee-pink' : 'text-stone-400 group-hover:text-stone-600'}
                            />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Footer / Status */}
            <div className="p-4 border-t border-stone-100">
                <div className="flex justify-between items-center mb-4">
                    <ThemeToggle />
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-500">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-stone-700">System Status</span>
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <p>Daemon Active</p>
                    <p className="opacity-70 mt-1">Version 2026.2.6</p>
                </div>
            </div>
        </nav>
    );
}

// Simple Mobile Nav (Top Bar)
export function MobileNavigation() {
    return (
        <div className="md:hidden h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-jubilee-pink rounded-lg flex items-center justify-center text-white">
                    <Crown size={18} />
                </div>
                <span className="font-serif font-bold text-stone-900">Jubilee</span>
            </div>
            {/* Burger menu placeholder */}
            <div className="text-xs text-stone-400">Mobile View</div>
        </div>
    );
}
