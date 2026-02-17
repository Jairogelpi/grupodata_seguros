'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LayoutDashboard, Users, Link as LinkIcon, BarChart3 as BarChart2, PieChart, Activity, Hourglass, AlertTriangle, LogOut, User } from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    if (pathname === '/login') return null;

    const navItems = [
        { name: 'Panel', href: '/', icon: LayoutDashboard },
        { name: 'Prod.', href: '/productividad', icon: BarChart2 },
        { name: 'Cartera', href: '/cartera', icon: PieChart },
        { name: 'Estados', href: '/estados', icon: Activity },
        { name: 'Ciclo', href: '/ciclo-vida', icon: Hourglass },
        { name: 'Anulaciones', href: '/anulaciones', icon: AlertTriangle },
        { name: 'Entes', href: '/entes', icon: Users },
        { name: 'Enlazar', href: '/enlazar', icon: LinkIcon },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3 shrink-0">
                    <img src="/logo.png" alt="Grupo Data Logo" className="h-8 w-auto" />
                    <span className="hidden lg:block text-lg font-bold tracking-tight text-slate-900 leading-none">
                        Grupo <span className="text-primary">Data</span>
                    </span>
                </div>

                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={item.name}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all
                  ${isActive
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className={`${item.name.length > 5 ? 'hidden xl:block' : 'block'}`}>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3 border-l border-slate-100 pl-4 ml-4 shrink-0">
                    {session?.user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-[11px] font-black text-slate-900 leading-none">{session.user.name}</span>
                                <span className="text-[9px] font-bold text-slate-400 leading-none mt-1 uppercase tracking-tighter">Analista</span>
                            </div>
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl flex items-center justify-center transition-all border border-slate-100 hover:border-red-100"
                                title="Cerrar Sesión"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
