"use client";

import { useEffect, useState, useMemo } from 'react';
import {
    PieChart,
    FileText,
    LayoutList,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    FileDown,
    Printer,
    BarChart2,
    TrendingUp,
    Info,
    Package,
    ChevronDown,
    ChevronRight,
    Users,
    Building2,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, ChartDataLabels);

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface MetricItem {
    primas: number;
    polizas: number;
    numEntes: number;
    numAsesores: number;
}

interface ProductItem extends MetricItem {
    producto: string;
}

interface RamoItem extends MetricItem {
    ramo: string;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

const DONUT_COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48'
];

export default function CarteraPage() {
    const [ramosBreakdown, setRamosBreakdown] = useState<RamoItem[]>([]);
    const [productosBreakdown, setProductosBreakdown] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [depth, setDepth] = useState<'ramo' | 'producto'>('ramo');
    const [expandedRamos, setExpandedRamos] = useState<Set<string>>(new Set());

    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        anios: [], meses: [], estados: [], asesores: [], entes: []
    });

    const [filters, setFilters] = useState({
        comercial: [] as string[],
        ente: [] as string[],
        anio: [] as string[],
        mes: [] as string[],
        estado: [] as string[]
    });

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'primas',
        direction: 'desc'
    });

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.comercial.length > 0) params.append('comercial', filters.comercial.join(','));
            if (filters.ente.length > 0) params.append('ente', filters.ente.join(','));
            if (filters.anio.length > 0) params.append('anio', filters.anio.join(','));
            if (filters.mes.length > 0) params.append('mes', filters.mes.join(','));
            if (filters.estado.length > 0) params.append('estado', filters.estado.join(','));

            const res = await fetch(`/api/metrics?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch metrics');

            const data = await res.json();
            setFilterOptions(data.filters);
            setRamosBreakdown(data.ramosBreakdown || []);
            setProductosBreakdown(data.productosBreakdown || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [filters]);

    const handleFilterChange = (key: keyof typeof filters, selected: string[]) => {
        setFilters(prev => ({ ...prev, [key]: selected }));
    };

    const toggleRamo = (ramo: string) => {
        const next = new Set(expandedRamos);
        if (next.has(ramo)) next.delete(ramo);
        else next.add(ramo);
        setExpandedRamos(next);
    };

    // Mapping for grouped view
    const getRamo = (producto: string): string => {
        const p = producto.toLowerCase();
        if (p.includes('sanit')) return 'SALUD';
        if (p.includes('accid')) return 'ACCIDENTES';
        if (p.includes('agro')) return 'DIVERSOS';
        if (p.includes('ind.riesgo') || p.includes('riesgo') || p.includes('ahorro') || p.includes('sialp')) return 'VIDA RIESGO';
        if (p.includes('decesos')) return 'DECESOS';
        if (producto.includes('<A>')) return 'AUTOS';
        if (producto.includes('<D>')) return 'DIVERSOS';
        return 'OTROS';
    };

    const donutData = useMemo(() => {
        const data = depth === 'ramo' ? ramosBreakdown : productosBreakdown;
        const top = data.slice(0, 10);
        const rest = data.slice(10);
        const restPrimas = rest.reduce((sum, item) => sum + item.primas, 0);

        const labels = top.map(item => depth === 'ramo' ? (item as RamoItem).ramo : (item as ProductItem).producto);
        const values = top.map(item => item.primas);

        if (restPrimas > 0) {
            labels.push('Otros');
            values.push(restPrimas);
        }

        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: DONUT_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff',
                hoverOffset: 15
            }]
        };
    }, [depth, ramosBreakdown, productosBreakdown]);

    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    boxWidth: 12,
                    font: { size: 11, weight: 'bold' as const },
                    padding: 15,
                    color: '#475569'
                }
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
                    return total > 0 && (ctx.dataset.data[ctx.dataIndex] / total) > 0.04;
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const val = context.raw;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const pct = ((val / total) * 100).toFixed(1);
                        return ` ${currencyFormatter.format(val)} (${pct}%)`;
                    }
                }
            }
        }
    };

    const handleExportExcel = () => {
        const dataToExport = productosBreakdown.map(item => ({
            'Producto': item.producto,
            'Ramo': getRamo(item.producto),
            'Nº Pólizas': item.polizas,
            'Nº Entes': item.numEntes,
            'Nº Asesores': item.numAsesores,
            'Total Primas (€)': item.primas
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Cartera_Detalle");
        XLSX.writeFile(wb, `Cartera_GrupoData_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Salud de la Cartera</h1>
                    <p className="mt-2 text-slate-500 font-medium">Análisis estratégico de producción por Ramo y Producto</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all font-semibold shadow-sm">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-sm">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-3 mb-6 text-slate-800 font-bold">
                    <div className="p-2 bg-indigo-50 rounded-xl text-primary"><LayoutList className="w-5 h-5" /></div>
                    <h3>Filtros de Análisis</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Asesor" options={filterOptions.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
                </div>
            </div>

            {/* Charts Section */}
            {!loading && (ramosBreakdown.length > 0 || productosBreakdown.length > 0) && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-xl text-purple-600"><PieChart className="w-6 h-6" /></div>
                            <h3 className="text-xl font-bold text-slate-800">Distribución de Cartera</h3>
                        </div>
                        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl no-print">
                            <button
                                onClick={() => setDepth('ramo')}
                                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${depth === 'ramo' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Por Ramos
                            </button>
                            <button
                                onClick={() => setDepth('producto')}
                                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${depth === 'producto' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Por Productos
                            </button>
                        </div>
                    </div>
                    <div className="h-[400px] w-full">
                        <Doughnut data={donutData} options={donutOptions} />
                    </div>
                </div>
            )}

            {/* Grouped Table View */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Package className="w-6 h-6" /></div>
                        <h3 className="text-xl font-bold text-slate-800">Desglose Detallado</h3>
                    </div>
                    <p className="text-sm text-slate-500 font-medium no-print">Haz clic en un ramo para ver sus productos</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-widest px-8">Categoría / Ítem</th>
                                <th className="px-4 py-4 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-widest"><div className="flex items-center justify-end gap-1"><Users className="w-3 h-3" /> Entes</div></th>
                                <th className="px-4 py-4 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-widest"><div className="flex items-center justify-end gap-1"><Building2 className="w-3 h-3" /> Cometos</div></th>
                                <th className="px-4 py-4 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Pólizas</th>
                                <th className="px-4 py-4 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Primas (€)</th>
                                <th className="px-8 py-4 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-widest px-8">Peso %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}><td className="px-8 py-6" colSpan={6}><div className="h-5 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>
                                ))
                            ) : ramosBreakdown.map((ramo) => {
                                const totalPrimas = ramosBreakdown.reduce((sum, r) => sum + r.primas, 0);
                                const isExpanded = expandedRamos.has(ramo.ramo);
                                const products = productosBreakdown.filter(p => getRamo(p.producto) === ramo.ramo);

                                return (
                                    <>
                                        {/* Ramo Row */}
                                        <tr
                                            key={ramo.ramo}
                                            onClick={() => toggleRamo(ramo.ramo)}
                                            className="group hover:bg-indigo-50/30 cursor-pointer transition-colors bg-white"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                    <span className="text-base font-bold text-slate-900">{ramo.ramo}</span>
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{products.length} productos</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-right font-bold text-slate-700 text-sm">{numberFormatter.format(ramo.numEntes)}</td>
                                            <td className="px-4 py-5 text-right font-bold text-slate-700 text-sm">{numberFormatter.format(ramo.numAsesores)}</td>
                                            <td className="px-4 py-5 text-right font-bold text-slate-700 text-sm">{numberFormatter.format(ramo.polizas)}</td>
                                            <td className="px-4 py-5 text-right font-bold text-primary text-sm">{currencyFormatter.format(ramo.primas)}</td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="inline-flex items-center gap-2 group-hover:scale-110 transition-transform">
                                                    <span className="text-sm font-bold text-slate-900 px-3 py-1 bg-slate-100 rounded-lg">
                                                        {((ramo.primas / (totalPrimas || 1)) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Product Rows (when expanded) */}
                                        {isExpanded && products.map((prod) => (
                                            <tr key={prod.producto} className="bg-slate-50/30 hover:bg-white transition-colors">
                                                <td className="px-8 py-4 pl-16">
                                                    <span className="text-sm font-medium text-slate-600 italic">{prod.producto}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-500 font-mono">{numberFormatter.format(prod.numEntes)}</td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-500 font-mono">{numberFormatter.format(prod.numAsesores)}</td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-500 font-mono">{numberFormatter.format(prod.polizas)}</td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-800 font-bold font-mono">{currencyFormatter.format(prod.primas)}</td>
                                                <td className="px-8 py-4 text-right">
                                                    <span className="text-xs font-semibold text-slate-400">
                                                        {((prod.primas / (ramo.primas || 1)) * 100).toFixed(1)}% <span className="text-[10px] opacity-60">del ramo</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
