"use client";

import { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, Sparkles, Filter, Info, Package, Target, ArrowRight, Gauge, ChevronRight } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Rule {
    antecedent: string[];
    consequent: string;
    support: number;
    confidence: number;
    lift: number;
    count: number;
    totalA: number;
    pVal: string;
}

export default function PredictivePage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/predictive/cross-sell');
            const data = await res.json();
            setRules(data.rules || []);
            setStats(data.stats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictions();
    }, []);

    const getLiftColor = (lift: number) => {
        if (lift > 3) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (lift > 2) return 'text-blue-600 bg-blue-50 border-blue-100';
        if (lift > 1.5) return 'text-indigo-600 bg-indigo-50 border-indigo-100';
        return 'text-slate-600 bg-slate-50 border-slate-100';
    };

    const getConfidenceLabel = (conf: number) => {
        if (conf > 0.8) return { label: 'Extrema', color: 'text-emerald-600' };
        if (conf > 0.6) return { label: 'Alta', color: 'text-blue-600' };
        if (conf > 0.4) return { label: 'Moderada', color: 'text-amber-600' };
        return { label: 'Baja', color: 'text-slate-500' };
    };

    return (
        <div className="space-y-8 pb-12 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                        Next Best Action <span className="text-primary/50 text-xl font-medium">Predictive IA</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Minería de datos reales para maximizar la venta cruzada</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchPredictions} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm font-bold">
                        <Sparkles className="w-4 h-4" />
                        Recalcular Modelo
                    </button>
                </div>
            </div>

            {/* Quality Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Base de Datos Analyzada</h3>
                        <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="mt-4">
                        <span className="text-2xl font-black text-slate-800 tracking-tight">{(stats?.totalTransactions || 0).toLocaleString()} <span className="text-slate-400 text-lg font-bold">Clientes</span></span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confianza Media</h3>
                        <Target className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-blue-600 tracking-tight">{(stats?.avgConfidence * 100 || 0).toFixed(1)}%</span>
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${stats?.avgConfidence * 100}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patrones Detectados</h3>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-4">
                        <span className="text-2xl font-black text-emerald-600 tracking-tight">{stats?.numRules || 0}</span>
                        <span className="ml-2 text-xs font-bold text-emerald-500/70 bg-emerald-50 px-2 py-0.5 rounded-full">Calidad Certificada</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                {/* Main Rule List */}
                <div className="xl:col-span-3 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Reglas de Mayor Impacto
                            </h3>
                            <div className="text-[10px] font-bold text-slate-400 uppercase bg-white px-3 py-1 rounded-full border border-slate-200">Ordenado por Lift Elevación</div>
                        </div>

                        {loading ? (
                            <div className="p-12 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {rules.map((rule, idx) => {
                                    const conf = getConfidenceLabel(rule.confidence);
                                    return (
                                        <div key={idx} className="p-6 hover:bg-slate-50 transition-colors group">
                                            <div className="flex flex-col md:flex-row items-center gap-6">
                                                {/* Antecedent */}
                                                <div className="flex-1 text-center md:text-left">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado Initial</div>
                                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                                        {rule.antecedent.map(a => (
                                                            <div key={a} className="flex flex-col">
                                                                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">{a}</span>
                                                                <span className="text-[9px] text-slate-400 mt-1 font-medium">{rule.totalA} clientes base</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="text-primary/30 flex flex-col items-center gap-1 group-hover:text-primary transition-colors">
                                                    <span className="text-[10px] font-bold uppercase tracking-tighter mb-1">Evolución</span>
                                                    <div className="flex items-center gap-1">
                                                        <div className="h-px w-8 bg-current"></div>
                                                        <ChevronRight className="w-4 h-4" />
                                                    </div>
                                                </div>

                                                {/* Consequent */}
                                                <div className="flex-1 text-center md:text-left">
                                                    <div className="text-[10px] font-bold text-primary uppercase mb-1">Siguiente Acción</div>
                                                    <div className="flex flex-col gap-1 items-center md:items-start">
                                                        <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-xl text-md font-black ring-2 ring-primary/20">{rule.consequent}</span>
                                                        <span className="text-[9px] text-primary/60 font-medium">{rule.count} conversiones reales</span>
                                                    </div>
                                                </div>

                                                {/* Metrics */}
                                                <div className="flex items-center gap-4 border-l border-slate-100 pl-6 bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl w-full md:w-auto">
                                                    <div className="text-center">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Acierto Histórico</div>
                                                        <div className={`text-lg font-black ${conf.color}`}>{(rule.confidence * 100).toFixed(0)}%</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Lift (Impacto)</div>
                                                        <div className={`text-sm font-bold px-2 py-1 rounded-lg border ${getLiftColor(rule.lift)}`}>{rule.lift.toFixed(2)}x</div>
                                                    </div>
                                                    <div className="text-center hidden lg:block">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Certificación</div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase">P-Val {rule.pVal}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="xl:col-span-2 space-y-8">
                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-primary/20">
                        <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                            <Info className="w-5 h-5 text-primary" />
                            ¿Por qué es Real?
                        </h4>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0 border border-primary/30 font-black text-primary italic">L</div>
                                <div>
                                    <p className="font-bold text-sm">Lift (Elevación)</p>
                                    <p className="text-xs text-slate-400 mt-1">Si el Lift es 2.0x, significa que el cliente tiene el **doble de probabilidades** de contratar el segundo ramo que un cliente medio.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0 border border-blue-500/30 font-black text-blue-400 italic">C</div>
                                <div>
                                    <p className="font-bold text-sm">Confianza Relevante</p>
                                    <p className="text-xs text-slate-400 mt-1">Calculamos el porcentaje histórico de éxito de esta combinación específica en toda tu base de datos.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30 font-black text-emerald-400 italic">S</div>
                                <div>
                                    <p className="font-bold text-sm">Soporte Estratégico</p>
                                    <p className="text-xs text-slate-400 mt-1">Solo mostramos patrones que han ocurrido suficientes veces para ser estadísticamente significativos.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="text-center space-y-4">
                            <div className="p-3 bg-slate-50 rounded-2xl inline-block">
                                <Gauge className="w-8 h-8 text-slate-300" />
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800">Próximos Pasos</h5>
                                <p className="text-xs text-slate-500 mt-2 px-4 leading-relaxed">Pronto podrás aplicar estas predicciones directamente en la ficha del cliente para recibir recomendaciones en tiempo real.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
