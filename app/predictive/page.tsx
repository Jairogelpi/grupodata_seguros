"use client";

import { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, Sparkles, Filter, Info, Package, Target, ArrowRight, Gauge, ChevronRight, AlertTriangle, ShieldAlert, History, UserMinus } from 'lucide-react';
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
    targets: string[];
}

interface ChurnRisk {
    poliza: string;
    ente: string;
    ramo: string;
    cia: string;
    seniority: string;
    score: number;
    factors: { name: string, impact: number }[];
}

export default function PredictivePage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [churnList, setChurnList] = useState<ChurnRisk[]>([]);
    const [churnStats, setChurnStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'cross-sell' | 'churn'>('cross-sell');

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            const [nbaRes, churnRes] = await Promise.all([
                fetch('/api/predictive/cross-sell'),
                fetch('/api/predictive/churn')
            ]);

            const nbaData = await nbaRes.json();
            const churnData = await churnRes.json();

            setRules(nbaData.rules || []);
            setStats(nbaData.stats);
            setChurnList(churnData.riskList || []);
            setChurnStats(churnData.stats);
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
                        Centro de Acción IA <span className="text-primary/50 text-xl font-medium">Predictive Intelligence</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Identificación de brechas de cobertura y protección de clientes en riesgo</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl mr-4 border border-slate-200">
                        <button onClick={() => setActiveTab('cross-sell')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'cross-sell' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Venta Cruzada</button>
                        <button onClick={() => setActiveTab('churn')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'churn' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Riesgo Abandono</button>
                    </div>
                    <button onClick={fetchPredictions} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm font-bold">
                        <Sparkles className="w-4 h-4" />
                        Recalcular Modelo
                    </button>
                </div>
            </div>

            {activeTab === 'cross-sell' ? (
                <>
                    {/* Quality Summary (NBA) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Base de Datos Analizada</h3>
                                <Package className="w-4 h-4 text-primary" />
                            </div>
                            <div className="mt-4">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">{(stats?.totalTransactions || 0).toLocaleString()} <span className="text-slate-400 text-lg font-bold">Clientes</span></span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acierto Medio</h3>
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
                                        Oportunidades de Captación (Cross-Sell)
                                    </h3>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase bg-white px-3 py-1 rounded-full border border-slate-200 tracking-widest">Basado en Patrones Reales</div>
                                </div>

                                {loading ? (
                                    <div className="p-12 space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl"></div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {rules.length > 0 ? rules.map((rule, idx) => {
                                            const conf = getConfidenceLabel(rule.confidence);
                                            return (
                                                <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors group">
                                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                                        {/* Antecedent */}
                                                        <div className="flex-1 text-center md:text-left">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado Initial</div>
                                                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                                                {rule.antecedent.map(a => (
                                                                    <div key={a} className="flex flex-col">
                                                                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">{a}</span>
                                                                        <span className="text-[9px] text-slate-400 mt-1 font-medium">{rule.totalA} clientes con este perfil</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="text-primary/30 flex flex-col items-center gap-1 group-hover:text-primary transition-colors">
                                                            <span className="text-[10px] font-bold uppercase tracking-tighter mb-1">Potencial</span>
                                                            <ChevronRight className="w-5 h-5" />
                                                        </div>

                                                        {/* Consequent */}
                                                        <div className="flex-1 text-center md:text-left">
                                                            <div className="text-[10px] font-bold text-primary uppercase mb-1">Oferta Recomendada</div>
                                                            <div className="flex flex-col gap-1 items-center md:items-start">
                                                                <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-xl text-md font-black ring-2 ring-primary/20">{rule.consequent}</span>
                                                                <span className="text-[9px] text-primary/60 font-medium">{rule.count} casos de éxito probados</span>
                                                            </div>
                                                        </div>

                                                        {/* Metrics */}
                                                        <div className="flex items-center gap-4 border-l border-slate-100 pl-6 w-full md:w-auto">
                                                            <div className="text-center">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Conversión</div>
                                                                <div className={`text-lg font-black ${conf.color}`}>{(rule.confidence * 100).toFixed(0)}%</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Impacto</div>
                                                                <div className={`text-sm font-bold px-2 py-1 rounded-lg border ${getLiftColor(rule.lift)}`}>{rule.lift.toFixed(1)}x</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Target Customers Sub-List */}
                                                    {rule.targets && rule.targets.length > 0 && (
                                                        <div className="mt-6 pt-4 border-t border-slate-100">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                                                                <Target className="w-3 h-3 text-primary" />
                                                                Candidatos ideales (Clientes que cumplen el perfil pero no tienen {rule.consequent})
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {rule.targets.map(target => (
                                                                    <span key={target} className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-primary hover:text-primary transition-colors cursor-default">
                                                                        {target}
                                                                    </span>
                                                                ))}
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-slate-50 text-slate-400 rounded-full">... y más</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="p-20 text-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                                    <BrainCircuit className="w-8 h-8 text-slate-300" />
                                                </div>
                                                <h4 className="text-slate-800 font-bold">Sin Patrones Detectados</h4>
                                                <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">La base de datos actual no tiene suficientes secuencias de compra cruzada para generar reglas estadísticas seguras.</p>
                                            </div>
                                        )}
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
                </>
            ) : (
                <>
                    {/* Quality Summary (Churn) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasa Media Cancelación</h3>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="mt-4">
                                <span className="text-2xl font-black text-red-600 tracking-tight">{(churnStats?.avgChurn * 100 || 0).toFixed(1)}%</span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Histórico General</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pólizas en Riesgo Crítico</h3>
                                <ShieldAlert className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="mt-4 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-600 tracking-tight">{churnStats?.atHighRisk || 0}</span>
                                <span className="text-xs font-bold text-amber-500/70 bg-amber-50 px-2 py-0.5 rounded-full">Score {'>'} 2x Media</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carga Proactiva</h3>
                                <History className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="mt-4">
                                <span className="text-2xl font-black text-emerald-600 tracking-tight">Top 50</span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Revisión Recomendada</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                        <div className="xl:col-span-3 space-y-6">
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-8 py-6 border-b border-slate-100 bg-red-50/20 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        Plan de Rescate (Pólizas en Peligro)
                                    </h3>
                                    <div className="text-[10px] font-bold text-red-500 uppercase bg-white px-3 py-1 rounded-full border border-red-100 tracking-widest italic">Acción Inmediata Requerida</div>
                                </div>

                                {loading ? (
                                    <div className="p-12 space-y-4">
                                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl"></div>)}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {churnList.length > 0 ? churnList.map((item, idx) => (
                                            <div key={idx} className="p-6 hover:bg-red-50/30 transition-colors group">
                                                <div className="flex flex-col lg:flex-row items-center gap-6">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Póliza nº {item.poliza}</div>
                                                        <div className="text-sm font-black text-slate-800 truncate">{item.ente}</div>
                                                        <div className="flex gap-4 mt-2">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 italic">{item.ramo}</div>
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">{item.cia}</div>
                                                        </div>
                                                    </div>

                                                    {/* Risk Level Gauge */}
                                                    <div className="flex items-center gap-6 border-l border-slate-100 pl-6 w-full lg:w-auto">
                                                        <div className="text-center">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Riesgo</div>
                                                            <div className={`text-xl font-black ${(item.score * 100) > (churnStats?.avgChurn * 200) ? 'text-red-600' : 'text-amber-600'}`}>
                                                                {(item.score * 100).toFixed(1)}%
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 lg:w-40">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Factores Críticos</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.factors.slice(0, 2).map(f => (
                                                                    <span key={f.name} className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${f.impact > 1.2 ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500'}`}>
                                                                        {f.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <button className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 group-hover:text-primary">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-20 text-center">
                                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                                                    <ShieldAlert className="w-8 h-8 text-red-300" />
                                                </div>
                                                <h4 className="text-slate-800 font-bold">Sin Alertas Críticas</h4>
                                                <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">No se han encontrado pólizas que superen el umbral de riesgo basado en el histórico de cancelaciones actual.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="xl:col-span-2 space-y-8">
                            <div className="bg-red-900 rounded-3xl p-8 text-white shadow-2xl shadow-red-900/20">
                                <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                                    <UserMinus className="w-5 h-5 text-red-400" />
                                    Justificación del Riesgo
                                </h4>
                                <div className="space-y-6">
                                    <p className="text-xs text-red-100/70 leading-relaxed italic">Este scoring se basa en la **correlación histórica de bajas**. No es una opinión; es estadística aplicada a tu historial de cancelaciones.</p>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center shrink-0 border border-red-700 font-black">1</div>
                                            <p className="text-xs text-red-100 mt-1">Analizamos la **siniestralidad por Cía y Ramo**: Detectamos qué productos tienen "fuga" natural.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center shrink-0 border border-red-700 font-black">2</div>
                                            <p className="text-xs text-red-100 mt-1">Estudiamos la **curva de supervivencia**: Identificamos cuándo el cliente suele "enfriarse" y plantearse la baja.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center shrink-0 border border-red-700 font-black">3</div>
                                            <p className="text-xs text-red-100 mt-1">Asignamos un **Score Probabilístico**: Multiplicamos los impactos para priorizar tu acción comercial.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
