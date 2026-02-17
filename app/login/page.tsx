"use client";

import { signIn } from "next-auth/react";
import { LogIn, ShieldCheck, Lock } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            {/* Background patterns */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-md w-full relative">
                <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 p-10 overflow-hidden">
                    {/* Logo / Header */}
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                            <ShieldCheck className="w-10 h-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            Grupo Data <span className="text-primary text-xl">System</span>
                        </h1>
                        <p className="mt-3 text-slate-500 font-medium text-sm">
                            Acceso restringido para analistas autorizados
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                                <Lock className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="text-xs text-slate-500 leading-relaxed">
                                Utiliza tu correo corporativo o personal previamente registrado en la
                                <span className="font-bold text-slate-700"> Lista Blanca</span> para acceder a las métricas.
                            </div>
                        </div>

                        <button
                            onClick={() => signIn("google", { callbackUrl: "/" })}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 group"
                        >
                            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            Entrar con Google
                        </button>
                    </div>

                    {/* Footer security badge */}
                    <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-100">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">
                                Entorno Seguro Protegido
                            </span>
                        </div>
                    </div>
                </div>

                {/* Floating cards for "Premium" feel */}
                <div className="hidden lg:block absolute -right-24 top-1/4 w-48 h-24 bg-white/80 backdrop-blur shadow-xl rounded-2xl border border-white p-4 -rotate-6 animate-bounce-slow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <div className="w-6 h-1 bg-blue-200 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <div className="w-20 h-2 bg-slate-200 rounded-full" />
                            <div className="w-12 h-2 bg-slate-100 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
