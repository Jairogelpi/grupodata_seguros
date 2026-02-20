"use client";

import { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, Sparkles, Filter, Info, Package, Target, ArrowRight, Gauge, ChevronRight, AlertTriangle, ShieldAlert, History, UserMinus, LayoutList, Zap } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

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
    pago: string;
    score: number;
    factors: { name: string, impact: number }[];
    rejectedPolicies?: { num: string, ramo: string, cia: string, fecha: string }[];
    ramoChurnRate?: number;
    ciaChurnRate?: number;
}

const MetricTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
        <Info className="w-3 h-3 text-slate-300 cursor-help hover:text-primary transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-xl z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

export default function PredictivePage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [churnList, setChurnList] = useState<ChurnRisk[]>([]);
    const [churnStats, setChurnStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'cross-sell' | 'churn'>('cross-sell');
    const [selectedRiskPoliza, setSelectedRiskPoliza] = useState<ChurnRisk | null>(null);
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
    const [candidateProfile, setCandidateProfile] = useState<any>(null);
    const [loadingCandidate, setLoadingCandidate] = useState(false);
    const [riskFilter, setRiskFilter] = useState<'all' | 'critical'>('all');

    // Filter State
    const [filterOptions, setFilterOptions] = useState<any>({
        asesores: [],
        entes: [],
        anios: [],
        meses: [],
        estados: []
    });

    const [filters, setFilters] = useState({
        comercial: [] as string[],
        ente: [] as string[],
        anio: [] as string[],
        mes: [] as string[],
        estado: [] as string[]
    });

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.comercial.length > 0) params.append('comercial', filters.comercial.join(','));
            if (filters.ente.length > 0) params.append('ente', filters.ente.join(','));
            if (filters.anio.length > 0) params.append('anio', filters.anio.join(','));
            if (filters.mes.length > 0) params.append('mes', filters.mes.join(','));
            if (filters.estado.length > 0) params.append('estado', filters.estado.join(','));

            const [nbaRes, churnRes, optionsRes] = await Promise.all([
                fetch(`/api/predictive/cross-sell?${params.toString()}`),
                fetch(`/api/predictive/churn?${params.toString()}`),
                fetch(`/api/metrics?${params.toString()}`) // Use metrics API to populate filter options
            ]);

            const nbaData = await nbaRes.json();
            const churnData = await churnRes.json();
            const optionsData = await optionsRes.json();

            setRules(nbaData.rules || []);
            setStats(nbaData.stats);
            setChurnList(churnData.riskList || []);
            setChurnStats(churnData.stats);
            setFilterOptions(optionsData.filters);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPredictions();
    }, [filters]);

    const handleFilterChange = (key: string, values: string[]) => {
        setFilters(prev => ({ ...prev, [key]: values }));
    };

    const clearFilters = () => {
        setFilters({
            comercial: [],
            ente: [],
            anio: [],
            mes: [],
            estado: []
        });
    };

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

    const getRamoIcon = (ramo: string) => {
        const r = ramo.toUpperCase();
        if (r.includes('AUTO')) return <Zap className="w-4 h-4 text-blue-500" />;
        if (r.includes('HOGAR')) return <Target className="w-4 h-4 text-orange-500" />;
        if (r.includes('SALUD')) return <Sparkles className="w-4 h-4 text-red-500" />;
        if (r.includes('VIDA')) return <ShieldAlert className="w-4 h-4 text-emerald-500" />;
        if (r.includes('DECESOS')) return <TrendingUp className="w-4 h-4 text-purple-500" />;
        return <Package className="w-4 h-4 text-slate-400" />;
    };

    const fetchCandidateDetail = async (code: string) => {
        setLoadingCandidate(true);
        setSelectedCandidate(code);
        try {
            const res = await fetch(`/api/predictive/ente-detail?code=${code}`);
            const data = await res.json();
            setCandidateProfile(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingCandidate(false);
        }
    };

    const getDiagnosis = (poliza: ChurnRisk) => {
        const reasons: string[] = [];
        const actions: string[] = [];

        poliza.factors.forEach(f => {
            if (f.name === 'Contagio') {
                reasons.push("Este Ente ha cancelado otras pólizas recientemente, lo que genera una inercia de abandono total.");
                actions.push("Llamada de fidelización inmediata para preguntar por el motivo de las bajas previas y ofrecer un pack global.");
            }
            if (f.name === 'Renovación') {
                reasons.push("La póliza se encuentra en la ventana crítica de 45 días antes de su renovación anual.");
                actions.push("Revisar condiciones actuales y contactar proactivamente antes de que el cliente busque otras ofertas.");
            }
            if (f.name === 'Ticket Alto') {
                reasons.push("La prima de esta póliza es significativamente superior a la media de su ramo, siendo vulnerable a la competencia.");
                actions.push("Estudiar margen de mejora en prima o añadir coberturas de valor sin coste extra para justificar el precio.");
            }
            if (f.name === 'F. Pago') {
                reasons.push("La forma de pago actual (fraccionada/mensual) tiene una correlación estadística mayor con las cancelaciones.");
                actions.push("Proponer cambio a Pago Anual con un pequeño descuento de pronto pago para asegurar la anualidad.");
            }
            if (f.name === 'Mono-ente') {
                reasons.push("El Ente tiene una vinculación muy débil (solo esta póliza), lo que facilita su salida.");
                actions.push("Utilizar el Motor de Venta Cruzada para ofrecer un segundo producto y 'anclar' al cliente.");
            }
            if (f.name === 'Compañía') {
                reasons.push(`La compañía (${poliza.cia}) está experimentando una tasa de rotación superior a la media en este ramo.`);
                actions.push("Verificar si hay problemas de servicio conocidos con esta compañía y estar preparado para reubicar la póliza.");
            }
        });

        if (reasons.length === 0) {
            reasons.push("Combinación de factores demográficos y estacionales que superan el umbral de riesgo.");
            actions.push("Realizar seguimiento preventivo de satisfacción.");
        }

        return { reasons, actions };
    };

    const getNBADiagnosis = (rule: Rule) => {
        const reasons: string[] = [];
        const actions: string[] = [];

        // 1. Lift Explanation (The "14.0x") - Focusing on "Effort reduction"
        reasons.push(`**Fuerza de Correlación:** Los clientes con ${rule.antecedent.join(' + ')} tienen una propensión **${rule.lift.toFixed(1)} veces superior** a la media de contratar ${rule.consequent}. Esto significa que tu esfuerzo comercial será mucho más eficiente aquí que disparando a ciegas al resto de la cartera.`);

        // 2. Support Explanation (Historical validation) with pedagogical touch
        const caseText = rule.count === 1 ? 'caso de éxito real' : 'casos de éxito reales';
        reasons.push(`**Validación Histórica:** Hemos detectado ${rule.count} ${caseText} que confirman este patrón. Aunque sea un grupo pequeño, la IA identifica que este es el "camino de menor resistencia" para crecer en ${rule.consequent}.`);

        if (rule.confidence > 0.6) {
            reasons.push(`**Probabilidad de Éxito:** La confianza en este patrón es del ${(rule.confidence * 100).toFixed(0)}%. No es una suposición; es la dirección que han tomado tus mejores clientes con perfiles similares.`);
        }

        actions.push(`Contactar a los ${rule.targets.length} candidatos: el 80% del éxito en venta cruzada depende de elegir al cliente con el perfil adecuado, y estos lo tienen.`);
        actions.push(`Utilizar el argumento de "paso natural": este producto es la elección lógica para alguien que ya protege su ${rule.antecedent.join(' y ')} contigo.`);
        actions.push(`Detectar pólizas externas: es muy probable que estos clientes ya tengan ${rule.consequent} con la competencia; tráelos a tu cartera con una oferta de mejora.`);

        return { reasons, actions };
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
                    {Object.values(filters).some(f => f.length > 0) && (
                        <button onClick={clearFilters} className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors mr-2">Limpiar</button>
                    )}
                    <button onClick={fetchPredictions} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm font-bold">
                        <Sparkles className="w-4 h-4" />
                        Recalcular
                    </button>
                </div>
            </div>

            <PrintFilterSummary filters={filters} />

            {/* Filters Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3 className="uppercase text-xs tracking-widest">Filtros de Análisis IA</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Comercial" options={filterOptions.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
                </div>
            </div>

            {activeTab === 'cross-sell' ? (
                <>
                    {/* Quality Summary (NBA) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número de Pólizas</h3>
                                    <MetricTooltip text="Universo total de pólizas filtradas que tienen un asesor asignado en el registro comercial." />
                                </div>
                                <LayoutList className="w-4 h-4 text-primary" />
                            </div>
                            <div className="mt-4 flex items-center h-8">
                                {loading && !stats ? (
                                    <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <span className="text-2xl font-black text-slate-800 tracking-tight">{(stats?.totalPolizas || 0).toLocaleString()} <span className="text-slate-400 text-lg font-bold">Pólizas</span></span>
                                )}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acierto Medio</h3>
                                    <MetricTooltip text="Probabilidad promedio de éxito estadístico basada en comportamientos reales verificados en tu propia cartera." />
                                </div>
                                <Target className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="mt-4 flex items-baseline gap-2 h-8">
                                {loading && !stats ? (
                                    <div className="h-6 w-32 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <>
                                        <span className="text-2xl font-black text-blue-600 tracking-tight">{(stats?.avgConfidence * 100 || 0).toFixed(1)}%</span>
                                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${stats?.avgConfidence * 100}%` }}></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patrones Detectados</h3>
                                    <MetricTooltip text="Reglas matemáticas de comportamiento encontradas en tus datos con significancia estadística certificada (Test Chi-Cuadrado)." />
                                </div>
                                <ArrowRight className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="mt-4 flex items-center h-8">
                                {loading && !stats ? (
                                    <div className="h-6 w-16 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <>
                                        <span className="text-2xl font-black text-emerald-600 tracking-tight">{stats?.numRules || 0}</span>
                                        <span className="ml-2 text-xs font-bold text-emerald-500/70 bg-emerald-50 px-2 py-0.5 rounded-full">Calidad Certificada</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                        {/* Main Rule List */}
                        <div className="xl:col-span-5 space-y-6">
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
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedRule(rule)}
                                                    className="p-6 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                >
                                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                                        {/* Antecedent */}
                                                        <div className="flex-1 text-center md:text-left">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado Initial</div>
                                                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                                                {rule.antecedent.map(a => (
                                                                    <div key={a} className="flex flex-col">
                                                                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">{a}</span>
                                                                        <span className="text-[9px] text-slate-400 mt-1 font-medium">{rule.totalA} entes con este perfil</span>
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
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Conversión</div>
                                                                    <MetricTooltip text="Probabilidad (Confianza) de que un ente que tiene el perfil inicial también adquiera la oferta recomendada." />
                                                                </div>
                                                                <div className={`text-lg font-black ${conf.color}`}>{(rule.confidence * 100).toFixed(0)}%</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Impacto</div>
                                                                    <MetricTooltip text="Multiplicador que indica cuántas veces es más probable esta venta comparada con una venta aleatoria. Mide la potencia de la recomendación." />
                                                                </div>
                                                                <div className={`text-sm font-bold px-2 py-1 rounded-lg border ${getLiftColor(rule.lift)}`}>{rule.lift.toFixed(1)}x</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Target Customers Sub-List */}
                                                    {rule.targets && rule.targets.length > 0 && (
                                                        <div className="mt-6 pt-4 border-t border-slate-100">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                                                                <Target className="w-3 h-3 text-primary" />
                                                                Candidatos ideales (Entes que cumplen el perfil pero no tienen {rule.consequent})
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {rule.targets.map(target => (
                                                                    <span key={target} className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-primary hover:text-primary transition-colors cursor-default">
                                                                        {target}
                                                                    </span>
                                                                ))}
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

                    </div>
                </>
            ) : (
                <>
                    {/* Quality Summary (Churn) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número de Pólizas</h3>
                                    <MetricTooltip text="Universo total de pólizas filtradas que tienen un asesor asignado en el registro comercial." />
                                </div>
                                <LayoutList className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="mt-4 h-8 flex items-center">
                                {loading && !churnStats ? (
                                    <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <span className="text-2xl font-black text-slate-800 tracking-tight">{(churnStats?.totalPolizas || 0).toLocaleString()} <span className="text-slate-400 text-lg font-bold">Pólizas</span></span>
                                )}
                            </div>
                        </div>
                        <div
                            onClick={() => setRiskFilter(riskFilter === 'critical' ? 'all' : 'critical')}
                            className={`bg-white p-6 rounded-2xl shadow-sm border transition-all cursor-pointer group ${riskFilter === 'critical' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-amber-200'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pólizas en Riesgo Crítico</h3>
                                    <MetricTooltip text="Pólizas con una probabilidad de cancelación superior al 1.5x de la media, identificadas por patrones de comportamiento atípico." />
                                </div>
                                <ShieldAlert className={`w-4 h-4 transition-colors ${riskFilter === 'critical' ? 'text-amber-600' : 'text-amber-500 group-hover:text-amber-600'}`} />
                            </div>
                            <div className="mt-4 flex items-baseline gap-2 h-8">
                                {loading && !churnStats ? (
                                    <div className="h-6 w-20 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <>
                                        <span className={`text-2xl font-black tracking-tight transition-colors ${riskFilter === 'critical' ? 'text-amber-700' : 'text-amber-600'}`}>{churnStats?.atHighRisk || 0}</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-amber-500/70 bg-amber-50 px-2 py-0.5 rounded-full">{(churnStats?.highRiskPct || 0).toFixed(1)}% de Cartera</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 ml-1">Score {'>'} 1.5x Media</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div
                            onClick={() => setRiskFilter('all')}
                            className={`bg-white p-6 rounded-2xl shadow-sm border transition-all cursor-pointer group ${riskFilter === 'all' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-200'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carga Proactiva</h3>
                                    <MetricTooltip text="Pólizas seleccionadas por el algoritmo de retención que requieren una acción comercial inmediata." />
                                </div>
                                <History className={`w-4 h-4 transition-colors ${riskFilter === 'all' ? 'text-emerald-600' : 'text-emerald-500 group-hover:text-emerald-600'}`} />
                            </div>
                            <div className="mt-4 h-8">
                                {loading && !churnStats ? (
                                    <div className="h-6 w-16 bg-slate-100 animate-pulse rounded"></div>
                                ) : (
                                    <>
                                        <span className={`text-2xl font-black tracking-tight transition-colors ${riskFilter === 'all' ? 'text-emerald-700' : 'text-emerald-600'}`}>{churnList.length}</span>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pólizas en Revisión</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                        <div className="xl:col-span-5 space-y-6">
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-8 py-6 border-b border-slate-100 bg-red-50/20 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        Plan de Rescate (Pólizas en Peligro)
                                    </h3>
                                    <div className="text-[10px] font-bold text-red-500 uppercase bg-white px-3 py-1 rounded-full border border-red-100 tracking-widest italic">Acción Requerida: Prioridad Máxima</div>
                                </div>

                                {loading ? (
                                    <div className="p-12 space-y-4">
                                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl"></div>)}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                        {(() => {
                                            const displayList = riskFilter === 'critical'
                                                ? churnList.filter(p => p.score > (churnStats?.avgChurn || 0) * 1.5)
                                                : churnList;

                                            return displayList.length > 0 ? (
                                                displayList.map((poliza, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setSelectedRiskPoliza(poliza)}
                                                        className="p-6 hover:bg-slate-50 transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-6"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Póliza Nº {poliza.poliza}</div>
                                                            <h4 className="text-sm md:text-base font-black text-slate-800 mb-2 group-hover:text-primary transition-colors">{poliza.ente}</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase italic">{poliza.ramo}</span>
                                                                <span className="text-[10px] font-medium text-slate-400">{poliza.cia}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-12">
                                                            <div className="text-right">
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Riesgo</div>
                                                                <div className="text-xl font-black text-red-600">{(poliza.score * 100).toFixed(1)}%</div>
                                                            </div>

                                                            <div className="hidden lg:block">
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1.5 ml-1">Factores Críticos</div>
                                                                <div className="flex gap-1.5">
                                                                    {poliza.factors.map((f, fidx) => (
                                                                        <span key={fidx} className="text-[9px] font-black px-2 py-0.5 bg-red-50 text-red-600 rounded-lg border border-red-100 uppercase tracking-tighter">
                                                                            {f.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                                                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-20 text-center">
                                                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                                                        <ShieldAlert className="w-8 h-8 text-red-300" />
                                                    </div>
                                                    <h4 className="text-slate-800 font-bold">{riskFilter === 'critical' ? 'No hay pólizas críticas en esta selección' : 'Sin Alertas Críticas'}</h4>
                                                    <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                                                        {riskFilter === 'critical'
                                                            ? 'Prueba a cambiar los filtros globales o selecciona la tarjeta de Carga Proactiva para ver toda la lista.'
                                                            : 'No se han encontrado pólizas que superen el umbral de riesgo basado en el histórico de cancelaciones actual.'}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </>
            )}

            {selectedRiskPoliza && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-primary p-8 text-white relative">
                            <button
                                onClick={() => setSelectedRiskPoliza(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                            >
                                <ChevronRight className="w-6 h-6 rotate-180" />
                            </button>

                            <div className="flex items-center gap-2 text-white/80 mb-2 mt-4 md:mt-0">
                                <ShieldAlert className="w-5 h-5 text-white" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Diagnóstico de Retención</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-black tracking-tight mb-2 pr-12 line-clamp-2 md:line-clamp-none">{selectedRiskPoliza.ente}</h2>
                            <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                                <div className="text-xs font-bold text-white/70">Póliza: <span className="text-white">{selectedRiskPoliza.poliza}</span></div>
                                <div className="text-xs font-bold text-white/70">Ramo: <span className="text-white italic">{selectedRiskPoliza.ramo}</span></div>
                            </div>

                            <div className="absolute -bottom-6 right-8 bg-white px-6 py-4 rounded-2xl shadow-xl flex flex-col items-center border-4 border-primary">
                                <span className="text-[10px] font-black text-primary/70 uppercase">Score de Riesgo</span>
                                <span className="text-3xl font-black text-primary">{(selectedRiskPoliza.score * 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 pt-12 space-y-8 max-h-[70vh] overflow-y-auto text-slate-700">
                            {/* Rotation Analysis Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Análisis de Rotación (Sistémico)</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="p-4 bg-blue-50/50 rounded-xl border-l-4 border-blue-400 text-sm leading-relaxed font-medium">
                                        La compañía <span className="font-black text-slate-900">{selectedRiskPoliza.cia}</span> presenta una tasa de rotación acumulada del <span className="text-blue-600 font-black">{(selectedRiskPoliza.ramoChurnRate! * 100).toFixed(1)}%</span> en el ramo <span className="font-black text-slate-900">{selectedRiskPoliza.ramo}</span> dentro de tu cartera filtrada.
                                    </div>
                                    <div className="p-4 bg-blue-50/50 rounded-xl border-l-4 border-blue-400 text-sm leading-relaxed font-medium">
                                        Este indicador sugiere una inestabilidad sistémica en este segmento de negocio, lo que requiere un seguimiento estrecho antes de la próxima renovación.
                                    </div>
                                </div>
                            </section>

                            {/* Rejected Policies History Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Inercia de Abandono (Historial Real)</h3>
                                </div>
                                <div className="space-y-3">
                                    {selectedRiskPoliza.rejectedPolicies && selectedRiskPoliza.rejectedPolicies.length > 0 ? (
                                        <>
                                            <div className="p-4 bg-red-50/50 rounded-xl border-l-4 border-red-400 text-sm leading-relaxed font-medium mb-4">
                                                Este Ente ha cancelado o rechazado <span className="font-black text-red-700">{selectedRiskPoliza.rejectedPolicies.length}</span> pólizas anteriormente, lo que genera una alta probabilidad de contagio en el resto de su cartera.
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedRiskPoliza.rejectedPolicies.map((p, pidx) => (
                                                    <div key={pidx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Póliza Nº {p.num}</span>
                                                            <span className="text-xs font-bold text-slate-700">{p.ramo}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[8px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase italic border border-red-100">RECHAZADA</span>
                                                            <div className="text-[9px] font-medium text-slate-400 mt-1">{p.cia}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                            <p className="text-xs text-slate-400 font-bold uppercase italic">Sin historial de rechazos previos detectado</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Este es el primer indicador crítico de este cliente.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Data Context */}
                            <div className="bg-slate-50 p-6 rounded-2xl flex justify-around border border-slate-100">
                                <div className="text-center">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Antigüedad</div>
                                    <div className="text-xs font-black text-slate-700">{selectedRiskPoliza.seniority}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Forma Pago</div>
                                    <div className="text-xs font-black text-slate-700">{selectedRiskPoliza.pago || 'Anual'}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Potencial</div>
                                    <div className="text-xs font-black text-emerald-600">RETENCIÓN</div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedRiskPoliza(null)}
                                className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                                Entendido, Actuar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Cross-Sell Modal (NBA) */}
            {selectedRule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-primary p-8 text-white relative">
                            <button
                                onClick={() => setSelectedRule(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                            >
                                <ChevronRight className="w-6 h-6 rotate-180" />
                            </button>

                            <div className="flex items-center gap-2 text-white/80 mb-2">
                                <Sparkles className="w-5 h-5 text-white" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Oportunidad Estratégica NBA</span>
                            </div>
                            <h2 className="text-2xl font-black tracking-tight mb-2">Objetivo: {selectedRule.consequent}</h2>
                            <div className="flex gap-4">
                                <div className="text-xs font-bold text-white/70">Estado Inicial: <span className="text-white bg-white/20 px-2 py-0.5 rounded ml-1">{selectedRule.antecedent.join(' + ')}</span></div>
                            </div>

                            <div className="absolute -bottom-6 right-8 bg-white px-6 py-4 rounded-2xl shadow-xl flex flex-col items-center border-4 border-primary">
                                <span className="text-[10px] font-black text-primary/70 uppercase">Impacto Comercial</span>
                                <span className="text-3xl font-black text-primary">{selectedRule.lift.toFixed(1)}x</span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 pt-12 space-y-8 max-h-[70vh] overflow-y-auto">
                            {/* Diagnosis Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">¿Por qué es una oportunidad?</h3>
                                </div>
                                <div className="space-y-3">
                                    {getNBADiagnosis(selectedRule).reasons.map((reason, idx) => (
                                        <div key={idx} className="p-4 bg-blue-50/50 rounded-xl border-l-4 border-blue-400 text-sm text-slate-700 leading-relaxed font-medium">
                                            {reason}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Plan de Acción Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                                        <Target className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Plan de Acción Sugerido</h3>
                                </div>
                                <div className="space-y-4">
                                    {getNBADiagnosis(selectedRule).actions.map((action, idx) => (
                                        <div key={idx} className="flex gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-emerald-200 transition-colors">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex-shrink-0 flex items-center justify-center text-xs font-black italic">
                                                {idx + 1}
                                            </div>
                                            <p className="text-sm text-slate-600 font-bold leading-snug group-hover:text-slate-900 transition-colors">{action}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Ideales Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Candidatos Ideales ({selectedRule.targets.length})</h3>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                                        {selectedRule.targets.map(target => (
                                            <button
                                                key={target}
                                                onClick={() => fetchCandidateDetail(target)}
                                                className="text-center p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 shadow-sm hover:border-primary hover:text-primary hover:shadow-md transition-all active:scale-95"
                                            >
                                                {target}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedRule(null)}
                                className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                                Entendido, Lanzar Campaña
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Profile Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                        {loadingCandidate ? (
                            <div className="p-20 text-center space-y-4">
                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="text-slate-500 font-bold animate-pulse">Consultando Cartera Real...</p>
                            </div>
                        ) : candidateProfile && (
                            <>
                                <div className="p-8 text-center relative bg-gradient-to-b from-slate-50 to-white">
                                    <button
                                        onClick={() => setSelectedCandidate(null)}
                                        className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <ChevronRight className="w-6 h-6 rotate-180" />
                                    </button>

                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
                                        <Package className="w-10 h-10 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{candidateProfile.name}</h2>
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">ID: {candidateProfile.code}</span>
                                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded">{candidateProfile.asesor}</span>
                                    </div>
                                </div>

                                <div className="px-8 pb-8 space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Cartera Detectada ({candidateProfile.totalActivePolicies})</h3>
                                        <div className="flex flex-wrap justify-center gap-3">
                                            {candidateProfile.activeRamos.length > 0 ? (
                                                candidateProfile.activeRamos.map((ramo: string) => (
                                                    <div key={ramo} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm min-w-[70px]">
                                                        {getRamoIcon(ramo)}
                                                        <span className="text-[9px] font-black text-slate-600 uppercase text-center leading-tight">{ramo}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[10px] font-bold text-slate-400 italic py-2">Sin ramos vigentes detectados</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12"></div>
                                        <h3 className="text-[10px] font-black text-primary/70 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                            <Sparkles className="w-3 h-3" />
                                            Oportunidad Detectada
                                        </h3>
                                        <p className="text-sm text-slate-800 font-black leading-relaxed">
                                            {candidateProfile.activeRamos.length > 0 ? (
                                                <>Este cliente ya confía en ti para <span className="text-primary">{candidateProfile.activeRamos.join(' y ')}</span>.</>
                                            ) : (
                                                <>Basándonos en su **perfil de consumo comercial** y comportamiento de pares:</>
                                            )}
                                            {" "}El motor IA sugiere que es el momento ideal para ofrecerle <span className="underline decoration-primary decoration-2 underline-offset-4">{selectedRule?.consequent}</span>.
                                        </p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <div className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-lg">MATCH ALTO</div>
                                            <span className="text-[10px] font-bold text-slate-500 italic">Basado en comportamiento de pares</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedCandidate(null)}
                                        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95"
                                    >
                                        Generar Propuesta para {selectedRule?.consequent}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
