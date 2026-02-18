'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    TrendingUp,
    FileText,
    Calendar,
    FileDown,
    Printer,
    LayoutList,
    TrendingDown,
    BarChart3,
    ShieldCheck,
    AlertTriangle,
    PieChart,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Search
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels
);

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const numberFormatter = new Intl.NumberFormat('es-ES');

interface EvolutionData {
    anio: number;
    mes: number;
    primas: number;
    polizas: number;
    anuladas: number;
    enVigor: number;
    suspension: number;
    anulacionesTempranas: number;
    ratioRetencion: number;
}

interface GlobalStats {
    active: number;
    suspension: number;
    totalAnuladas: number;
}

interface ProductMixItem {
    producto: string;
    primas: number;
    polizas: number;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DONUT_COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48'
];

const KPITooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
    <div className="group relative">
        {children}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block w-56 p-3 bg-slate-800 text-white text-[11px] leading-tight rounded-lg shadow-xl z-50 text-center pointer-events-none">
            {text}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
        </div>
    </div>
);

function EvolutionContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ente = searchParams.get('ente');

    const [data, setData] = useState<EvolutionData[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats>({ active: 0, suspension: 0, totalAnuladas: 0 });
    const [productMix, setProductMix] = useState<ProductMixItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [interactiveProduct, setInteractiveProduct] = useState<string | null>(null);

    const [startPeriod, setStartPeriod] = useState({ year: 0, month: 1 });
    const [endPeriod, setEndPeriod] = useState({ year: 0, month: 12 });
    const [availableYears, setAvailableYears] = useState<number[]>([]);

    useEffect(() => {
        if (ente) fetchEvolution();
    }, [ente]);

    const fetchEvolution = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/entes/evolucion?ente=${encodeURIComponent(ente!)}`);
            const json = await res.json();
            if (json.evolution) {
                setData(json.evolution);
                setGlobalStats(json.globalStats || { active: 0, suspension: 0, totalAnuladas: 0 });
                setProductMix(json.productMix || []);
                const years = Array.from(new Set(json.evolution.map((d: any) => d.anio))) as number[];
                setAvailableYears(years.sort((a, b) => a - b));
                if (years.length > 0) {
                    setStartPeriod({ year: years[0], month: 1 });
                    setEndPeriod({ year: years[years.length - 1], month: 12 });
                }
            }
        } catch (error) {
            console.error('Error fetching evolution', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const startVal = startPeriod.year * 100 + startPeriod.month;
            const endVal = endPeriod.year * 100 + endPeriod.month;
            const currentVal = d.anio * 100 + d.mes;
            return currentVal >= startVal && currentVal <= endVal;
        });
    }, [data, startPeriod, endPeriod]);

    // === MoM % Change ===
    const momChanges = useMemo(() => {
        return filteredData.map((d, i) => {
            if (i === 0) return null;
            const prev = filteredData[i - 1].primas;
            if (prev === 0) return d.primas > 0 ? 100 : 0;
            return Math.round(((d.primas - prev) / prev) * 100);
        });
    }, [filteredData]);

    // === MoM % Change Polizas ===
    const momChangesPolizas = useMemo(() => {
        return filteredData.map((d, i) => {
            if (i === 0) return null;
            const prev = filteredData[i - 1].polizas;
            if (prev === 0) return d.polizas > 0 ? 100 : 0;
            return Math.round(((d.polizas - prev) / prev) * 100);
        });
    }, [filteredData]);

    const sortedData = useMemo(() => {
        if (!sortConfig) return [...filteredData].reverse();

        const searched = [...filteredData].filter(d => {
            const periodStr = `${MONTHS[d.mes - 1]} ${d.anio}`.toLowerCase();
            return periodStr.includes(searchTerm.toLowerCase());
        });

        const sorted = searched.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof EvolutionData];
            let bVal: any = b[sortConfig.key as keyof EvolutionData];

            // Handle calculated fields
            if (sortConfig.key === 'ticketMedio') {
                aVal = a.polizas > 0 ? a.primas / a.polizas : 0;
                bVal = b.polizas > 0 ? b.primas / b.polizas : 0;
            } else if (sortConfig.key === 'varPrimas') {
                const idxA = filteredData.indexOf(a);
                const idxB = filteredData.indexOf(b);
                aVal = momChanges[idxA] ?? -999999;
                bVal = momChanges[idxB] ?? -999999;
            } else if (sortConfig.key === 'varPolizas') {
                const idxA = filteredData.indexOf(a);
                const idxB = filteredData.indexOf(b);
                aVal = momChangesPolizas[idxA] ?? -999999;
                bVal = momChangesPolizas[idxB] ?? -999999;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredData, sortConfig, momChanges, momChangesPolizas]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ChevronsUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
        return sortConfig.direction === 'asc' ?
            <ChevronUp className="w-3 h-3 text-indigo-500 ml-1 inline" /> :
            <ChevronDown className="w-3 h-3 text-indigo-500 ml-1 inline" />;
    };

    // === CHART DATA with Ticket Medio + YoY ===
    const chartData = useMemo(() => {
        const labels = filteredData.map(d => `${MONTHS[d.mes - 1]} ${d.anio}`);
        const datasets: any[] = [
            {
                label: 'Primas (€)',
                data: filteredData.map(d => d.primas),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                fill: false,
                yAxisID: 'y',
                tension: 0.1,
            },
            {
                label: 'Número de Pólizas',
                data: filteredData.map(d => d.polizas),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                fill: false,
                yAxisID: 'y1',
                tension: 0.1,
            },
            {
                label: 'Ticket Medio (€)',
                data: filteredData.map(d => d.polizas > 0 ? d.primas / d.polizas : 0),
                borderColor: '#ec4899',
                backgroundColor: 'transparent',
                fill: false,
                yAxisID: 'y',
                tension: 0.3,
                borderDash: [3, 3],
                pointStyle: 'triangle',
            },
            {
                label: 'Cartera Activa',
                data: filteredData.map(d => d.enVigor),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.4)',
                fill: false, yAxisID: 'y1', tension: 0.1,
                borderDash: [5, 5],
            },
            {
                label: 'Anuladas',
                data: filteredData.map(d => d.anuladas),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                fill: false, yAxisID: 'y1', tension: 0.1,
            },
            {
                label: 'En Suspensión',
                data: filteredData.map(d => d.suspension),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                fill: false, yAxisID: 'y1', tension: 0.1,
            }
        ];

        return { labels, datasets };
    }, [filteredData]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    boxWidth: 12,
                    font: { size: 11, weight: 'bold' as const },
                    padding: 15,
                    color: '#334155'
                }
            },
            tooltip: { mode: 'index' as const, intersect: false },
            datalabels: { display: false },
        },
        onClick: (_event: any, elements: any) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const item = filteredData[index];
                router.push(`/entes/evolucion/mes?ente=${encodeURIComponent(ente!)}&anio=${item.anio}&mes=${item.mes}`);
            }
        },
        scales: {
            y: {
                type: 'linear' as const, display: true, position: 'left' as const,
                title: {
                    display: true,
                    text: 'Primas (€)',
                    font: { size: 12, weight: 'bold' as const },
                    color: '#475569',
                    padding: { bottom: 10 }
                },
                ticks: {
                    font: { size: 11, weight: 'normal' as const },
                    color: '#64748b'
                }
            },
            y1: {
                type: 'linear' as const, display: true, position: 'right' as const,
                grid: { drawOnChartArea: false },
                title: {
                    display: true,
                    text: 'Número de Pólizas',
                    font: { size: 12, weight: 'bold' as const },
                    color: '#475569',
                    padding: { bottom: 10 }
                },
                ticks: {
                    font: { size: 11, weight: 'normal' as const },
                    color: '#64748b'
                }
            },
            x: {
                ticks: {
                    font: { size: 11, weight: 'normal' as const },
                    color: '#64748b',
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };

    // === FEATURE 3: Donut Chart ===
    const donutData = useMemo(() => {
        const top = productMix.slice(0, 10);
        const rest = productMix.slice(10);
        const restTotal = rest.reduce((sum, r) => sum + r.primas, 0);
        const labels = top.map(p => p.producto);
        const values = top.map(p => p.primas);
        if (restTotal > 0) {
            labels.push('Otros');
            values.push(restTotal);
        }
        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: DONUT_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }, [productMix]);

    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { boxWidth: 10, font: { size: 9 }, padding: 10 }
            },
            datalabels: {
                formatter: (val: number, ctx: any) => {
                    const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                    return `${pct}%`;
                },
                color: '#fff',
                font: { weight: 'bold' as const, size: 10 },
                display: (ctx: any) => {
                    const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    return total > 0 && (ctx.dataset.data[ctx.dataIndex] / total) > 0.05;
                }
            }
        },
        onClick: (event: any, elements: any, chart: any) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const label = chart.data.labels[index];
                setInteractiveProduct(prev => prev === label ? null : label);
            }
        }
    };

    // === FEATURE 1: Retention KPIs ===
    const retentionKPIs = useMemo(() => {
        const total = filteredData.reduce((s, d) => s + d.polizas, 0);
        const anuladas = filteredData.reduce((s, d) => s + d.anuladas, 0);
        const tempranas = filteredData.reduce((s, d) => s + d.anulacionesTempranas, 0);
        const ratio = total > 0 ? Math.round((total - anuladas) / total * 100) : 100;
        return { total, anuladas, tempranas, ratio };
    }, [filteredData]);

    const handleExportExcel = () => {
        const title = [['EVOLUCIÓN MENSUAL'], [`Ente: ${ente}`], [`Periodo: ${MONTHS[startPeriod.month - 1]} ${startPeriod.year} a ${MONTHS[endPeriod.month - 1]} ${endPeriod.year}`], []];
        const rows = filteredData.map((d, i) => ({
            'Año': d.anio, 'Mes': MONTHS[d.mes - 1],
            'Primas (€)': d.primas, 'Var. MoM (%)': momChanges[i] !== null ? momChanges[i] : '',
            'Nº Pólizas': d.polizas,
            'Ticket Medio (€)': d.polizas > 0 ? Math.round(d.primas / d.polizas * 100) / 100 : 0,
            'Anuladas': d.anuladas, 'En Vigor': d.enVigor,
            'Anulaciones Tempranas (<180d)': d.anulacionesTempranas,
            'Retención (%)': d.ratioRetencion
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(title);
        XLSX.utils.sheet_add_json(ws, rows, { origin: title.length });

        // Product Mix sheet
        const ws2 = XLSX.utils.json_to_sheet(productMix.map(p => ({
            'Producto': p.producto, 'Primas (€)': p.primas, 'Nº Pólizas': p.polizas
        })));
        XLSX.utils.book_append_sheet(wb, ws, "Evolucion");
        XLSX.utils.book_append_sheet(wb, ws2, "Mix_Productos");
        XLSX.writeFile(wb, `Evolucion_${ente?.replace(/ /g, '_')}.xlsx`);
    };

    if (!ente) return <div className="p-8 text-center">No se ha seleccionado ningún ente</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
                    <ArrowLeft className="w-5 h-5" /> Volver
                </button>
                <div className="flex gap-2">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-medium">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm text-sm font-medium">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 print:p-4 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{ente}</h1>
                        <p className="text-slate-500 font-medium">Análisis de evolución histórica mensual</p>
                    </div>
                </div>

                {/* Feature 1: Refined KPIs (Global Stock vs Period Flow) */}
                {!loading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {/* 1. CARTERA ACTIVA (Global Stock) */}
                        <KPITooltip text="Ver listado de pólizas actualmente EN VIGOR.">
                            <div
                                onClick={() => router.push(`/polizas/listado?ente=${encodeURIComponent(ente!)}&estado=VIGOR`)}
                                className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 h-full transition-all hover:border-emerald-400 hover:shadow-md cursor-pointer group/card"
                            >
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Cartera Activa
                                </p>
                                <p className="text-2xl font-extrabold text-emerald-700 mt-1 group-hover/card:scale-105 transition-transform origin-left">{numberFormatter.format(globalStats.active)}</p>
                            </div>
                        </KPITooltip>

                        {/* 2. EN SUSPENSIÓN (Global Stock) */}
                        <KPITooltip text="Ver listado de pólizas actualmente en estado de SUSPENSIÓN.">
                            <div
                                onClick={() => router.push(`/polizas/listado?ente=${encodeURIComponent(ente!)}&estado=SUSPENSION`)}
                                className="bg-amber-50 rounded-xl p-4 border border-amber-100 h-full transition-all hover:border-amber-400 hover:shadow-md cursor-pointer group/card"
                            >
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> En Suspensión
                                </p>
                                <p className="text-2xl font-extrabold text-amber-700 mt-1 group-hover/card:scale-105 transition-transform origin-left">{numberFormatter.format(globalStats.suspension)}</p>
                            </div>
                        </KPITooltip>

                        {/* 3. ANULADAS DEL PERIODO (Flow) */}
                        <KPITooltip text="Ver listado de pólizas producidas en este periodo que han sido anuladas.">
                            <div
                                onClick={() => router.push(`/polizas/listado?ente=${encodeURIComponent(ente!)}&estado=ANULADA&startYear=${startPeriod.year}&startMonth=${startPeriod.month}&endYear=${endPeriod.year}&endMonth=${endPeriod.month}`)}
                                className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-full transition-all hover:border-slate-400 hover:shadow-md cursor-pointer group/card"
                            >
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anuladas Periodo</p>
                                <p className="text-2xl font-extrabold text-slate-700 mt-1 group-hover/card:scale-105 transition-transform origin-left">{numberFormatter.format(retentionKPIs.anuladas)}</p>
                            </div>
                        </KPITooltip>

                        {/* 4. RETENCIÓN DEL PERIODO (Flow) */}
                        <KPITooltip text="Porcentaje de pólizas producidas en el periodo que NO han sido anuladas.">
                            <div className={`rounded-xl p-4 border h-full transition-colors ${retentionKPIs.ratio >= 70 ? 'bg-white border-slate-200' : 'bg-red-50 border-red-100'}`}>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retención Periodo</p>
                                <p className={`text-2xl font-extrabold mt-1 ${retentionKPIs.ratio >= 70 ? 'text-slate-700' : 'text-red-700'}`}>{retentionKPIs.ratio}%</p>
                            </div>
                        </KPITooltip>
                    </div>
                )}

                {/* Period Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 no-print">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4" /> Desde</h3>
                        <div className="flex gap-2">
                            <select value={startPeriod.month} onChange={(e) => setStartPeriod(p => ({ ...p, month: parseInt(e.target.value) }))} className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20">
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <select value={startPeriod.year} onChange={(e) => setStartPeriod(p => ({ ...p, year: parseInt(e.target.value) }))} className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20">
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4" /> Hasta</h3>
                        <div className="flex gap-2">
                            <select value={endPeriod.month} onChange={(e) => setEndPeriod(p => ({ ...p, month: parseInt(e.target.value) }))} className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20">
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <select value={endPeriod.year} onChange={(e) => setEndPeriod(p => ({ ...p, year: parseInt(e.target.value) }))} className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20">
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Chart */}
                <div className="bg-white p-8 print:p-6 rounded-2xl shadow-sm border border-slate-200 mt-8 break-inside-avoid">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            Producción, Pólizas y Ticket Medio
                        </h2>
                        <div className="flex bg-slate-100 p-1 rounded-lg no-print">
                            <button onClick={() => setChartType('line')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'line' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Línea</button>
                            <button onClick={() => setChartType('bar')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Barras</button>
                        </div>
                    </div>
                    <div className="h-[400px] w-full print:h-[500px] print:w-full">
                        {loading ? (
                            <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-medium">Cargando histórico...</div>
                        ) : filteredData.length > 0 ? (
                            chartType === 'line' ? <Line data={chartData} options={chartOptions} /> : <Bar data={chartData} options={chartOptions} />
                        ) : (
                            <div className="h-full w-full bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">No hay datos para el periodo seleccionado</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Feature 3: Product Mix Donut */}
            {!loading && productMix.length > 0 && (
                <div className="bg-white p-8 print:p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid print:w-full">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <PieChart className="w-5 h-5 text-purple-500" />
                        Mix de Productos por Ramo
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1">
                        <div className="h-[300px]">
                            <Doughnut data={donutData} options={donutOptions} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="p-3 text-left text-xs font-bold text-slate-400 uppercase">Producto</th>
                                        <th className="p-3 text-right text-xs font-bold text-slate-400 uppercase">Primas</th>
                                        <th className="p-3 text-right text-xs font-bold text-slate-400 uppercase">Pólizas</th>
                                        <th className="p-3 text-right text-xs font-bold text-slate-400 uppercase">Peso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {productMix
                                        .filter(p => !interactiveProduct || p.producto === interactiveProduct)
                                        .slice(0, 12).map((p, i) => {
                                            const totalPrimas = productMix.reduce((s, x) => s + x.primas, 0);
                                            const pct = totalPrimas > 0 ? ((p.primas / totalPrimas) * 100).toFixed(1) : '0';
                                            return (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="p-3 font-medium text-slate-700 flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                        {p.producto}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-primary font-mono">{currencyFormatter.format(p.primas)}</td>
                                                    <td className="p-3 text-right font-mono text-slate-600">{numberFormatter.format(p.polizas)}</td>
                                                    <td className="p-3 text-right font-bold text-slate-500">{pct}%</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Breakdown Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <LayoutList className="w-5 h-5 text-slate-400" />
                    <h3 className="text-lg font-bold text-slate-800">Desglose Mensual</h3>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar periodo (ej: Enero 2024)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs cursor-pointer hover:bg-slate-100" onClick={() => requestSort('anio')}>Periodo <SortIcon column="anio" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('primas')}>Primas (€) <SortIcon column="primas" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('varPrimas')}>Var. Primas <SortIcon column="varPrimas" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('polizas')}>Pólizas <SortIcon column="polizas" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('varPolizas')}>Var. Pólizas <SortIcon column="varPolizas" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('ticketMedio')}>Ticket Medio <SortIcon column="ticketMedio" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('ratioRetencion')}>Retención <SortIcon column="ratioRetencion" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('anuladas')}>Anuladas <SortIcon column="anuladas" /></th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right cursor-pointer hover:bg-slate-100" onClick={() => requestSort('anulacionesTempranas')}>Tempranas <SortIcon column="anulacionesTempranas" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedData.map((d, i) => {
                                const origIdx = filteredData.findIndex(x => x.anio === d.anio && x.mes === d.mes);
                                const pct = momChanges[origIdx];
                                return (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 font-medium">
                                            <button
                                                onClick={() => router.push(`/entes/evolucion/mes?ente=${encodeURIComponent(ente!)}&anio=${d.anio}&mes=${d.mes}`)}
                                                className="text-indigo-600 hover:text-indigo-900 hover:underline underline-offset-4 font-bold"
                                            >
                                                {MONTHS[d.mes - 1]} {d.anio}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-700">{currencyFormatter.format(d.primas)}</td>
                                        <td className={`p-4 text-right font-bold text-xs ${pct === null ? 'text-slate-300' : pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {pct !== null ? `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%` : '—'}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-slate-700">{numberFormatter.format(d.polizas)}</td>
                                        {(() => {
                                            const pctPol = momChangesPolizas[origIdx];
                                            return (
                                                <td className={`p-4 text-right font-bold text-xs ${pctPol === null ? 'text-slate-300' : pctPol >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {pctPol !== null ? `${pctPol >= 0 ? '▲' : '▼'} ${Math.abs(pctPol)}%` : '—'}
                                                </td>
                                            );
                                        })()}
                                        <td className="p-4 text-right text-amber-600 font-bold">{currencyFormatter.format(d.polizas > 0 ? d.primas / d.polizas : 0)}</td>
                                        <td className={`p-4 text-right font-bold ${d.ratioRetencion >= 70 ? 'text-green-600' : 'text-red-600'}`}>{d.ratioRetencion}%</td>
                                        <td className="p-4 text-right text-orange-600 font-mono">{d.anuladas}</td>
                                        <td className={`p-4 text-right font-mono ${d.anulacionesTempranas > 0 ? 'text-red-600 font-bold' : 'text-slate-300'}`}>{d.anulacionesTempranas}</td>
                                    </tr>);
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function EvolutionPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-slate-400 font-medium">Cargando Panel de Evolución...</div>}>
            <EvolutionContent />
        </Suspense>
    );
}
