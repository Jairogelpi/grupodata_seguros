"use client";

import { useEffect, useState, useMemo } from 'react';
import { PieChart as PieIcon, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, Package, ShieldCheck, Zap, AlertCircle, XCircle, Users } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';
import { Doughnut, Bar, Chart } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import { getRamo } from '@/lib/ramos';

import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, ChartDataLabels);

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface ProductBreakdownItem {
    producto: string;
    primas: number;
    polizas: number;
    ramo?: string;
    ticketMedio?: number;
}

interface RamoBreakdownItem {
    ramo: string;
    primas: number;
    polizas: number;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
    ramos: string[];
    productos: string[];
}

type SortKey = 'producto' | 'primas' | 'polizas' | 'ramo' | 'ticketMedio';

export default function CarteraPage() {
    const [productosBreakdown, setProductosBreakdown] = useState<ProductBreakdownItem[]>([]);
    const [ramosBreakdown, setRamosBreakdown] = useState<RamoBreakdownItem[]>([]);
    const [estadosBreakdown, setEstadosBreakdown] = useState<any[]>([]);
    const [cancellationReasons, setCancellationReasons] = useState<{ reason: string; count: number }[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [advancedMetrics, setAdvancedMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Modals State
    const [selectedEnteForProfile, setSelectedEnteForProfile] = useState<any | null>(null);
    const [selectedRamoForList, setSelectedRamoForList] = useState<{ ramoName: string, clients: any[] } | null>(null);

    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        anios: [],
        meses: [],
        estados: [],
        asesores: [],
        entes: [],
        ramos: [],
        productos: []
    });

    const [filters, setFilters] = useState({
        comercial: [] as string[],
        ente: [] as string[],
        anio: [] as string[],
        mes: [] as string[],
        estado: [] as string[],
        ramo: [] as string[],
        producto: [] as string[]
    });

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
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
            if (filters.ramo.length > 0) params.append('ramo', filters.ramo.join(','));
            if (filters.producto.length > 0) params.append('producto', filters.producto.join(','));

            const res = await fetch(`/api/metrics?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch metrics');

            const data = await res.json();
            setFilterOptions(data.filters);

            // Map products to their ramos for the table
            const prodsWithRamos = (data.productosBreakdown || []).map((p: any) => ({
                ...p,
                ramo: getRamo(p.producto)
            }));

            setProductosBreakdown(prodsWithRamos);
            setRamosBreakdown(data.ramosBreakdown || []);
            setEstadosBreakdown(data.estadosBreakdown || []);
            setCancellationReasons(data.cancellationReasons || []);
            setMetrics(data.metrics);
            setAdvancedMetrics(data.advanced);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [filters]);

    // Handle interactive chart/table clicks
    const toggleFilter = (type: 'ramo' | 'producto', value: string) => {
        setFilters(prev => {
            const current = type === 'ramo' ? prev.ramo : prev.producto;
            const exists = current.includes(value);
            const newValues = exists ? current.filter(v => v !== value) : [...current, value];

            // If selecting a Ramo, optionally switch view to Product to see breakdown
            if (type === 'ramo' && !exists) {
                setMixDepth('producto');
            }

            return { ...prev, [type]: newValues };
        });
    };

    const handleChartClick = (event: any, elements: any, chart: any) => {
        if (elements.length > 0) {
            const index = elements[0].index;
            const label = chart.data.labels[index];
            if (label === 'Otros') return;
            toggleFilter(mixDepth, label);
        }
    };

    const handleFilterChange = (key: keyof typeof filters, selected: string[]) => {
        setFilters(prev => ({ ...prev, [key]: selected }));
    };

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = [...productosBreakdown].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (key === 'producto') {
            return direction === 'asc' ? a.producto.localeCompare(b.producto) : b.producto.localeCompare(a.producto);
        }
        if (key === 'ramo') {
            return direction === 'asc' ? (a.ramo || '').localeCompare(b.ramo || '') : (b.ramo || '').localeCompare(a.ramo || '');
        }
        // Handle numeric fields
        const x = Number(a[key]) || 0;
        const y = Number(b[key]) || 0;
        return direction === 'asc' ? x - y : y - x;
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
    };

    const handleExportExcel = () => {
        const filterRows = [
            ['REPORTE DE CARTERA POR PRODUCTO'],
            ['Filtros Aplicados:', new Date().toLocaleString()],
            ['Asesor:', filters.comercial.length > 0 ? filters.comercial.join(', ') : 'Todos'],
            ['Ente:', filters.ente.length > 0 ? filters.ente.join(', ') : 'Todos'],
            ['Año:', filters.anio.length > 0 ? filters.anio.join(', ') : 'Todos'],
            ['Mes:', filters.mes.length > 0 ? filters.mes.join(', ') : 'Todos'],
            ['Estado:', filters.estado.length > 0 ? filters.estado.join(', ') : 'Todos'],
            [],
        ];

        const dataToExport = sortedData.map(item => ({
            'Ramo': item.ramo,
            'Producto': item.producto,
            'Nº Pólizas': item.polizas,
            'Primas Totales (€)': item.primas
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filterRows);
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: filterRows.length });

        ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, "Cartera");
        XLSX.writeFile(wb, `Cartera_GrupoData_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Chart Colors
    const COLORS = [
        'rgba(155, 30, 41, 0.8)',  // Primary Maroon
        'rgba(51, 65, 85, 0.8)',   // Slate
        'rgba(30, 64, 175, 0.8)',  // Blue
        'rgba(21, 128, 61, 0.8)',  // Green
        'rgba(126, 34, 206, 0.8)', // Purple
        'rgba(180, 83, 9, 0.8)',   // Amber
        'rgba(190, 18, 60, 0.8)',  // Rose
    ];

    const generatePieData = (data: any[], labelKey: string, valueKey: string) => {
        const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
        const top = sorted.slice(0, 6);
        const others = sorted.slice(6);

        const labels = top.map(d => d[labelKey]);
        const values = top.map(d => d[valueKey]);

        if (others.length > 0) {
            labels.push('Otros');
            values.push(others.reduce((sum, d) => sum + d[valueKey], 0));
        }

        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: COLORS,
                borderWidth: 2,
                borderColor: '#ffffff',
            }]
        };
    };

    const [mixDepth, setMixDepth] = useState<'ramo' | 'producto'>('ramo');

    const activeMixData = useMemo(() => {
        if (mixDepth === 'ramo') {
            return ramosBreakdown.map(r => ({ name: r.ramo, primas: r.primas, polizas: r.polizas, entes: (r as any).entes || 0 }));
        }
        return productosBreakdown.map(p => ({ name: p.producto, primas: p.primas, polizas: p.polizas, entes: (p as any).entes || 0 }));
    }, [mixDepth, ramosBreakdown, productosBreakdown]);

    const DONUT_COLORS = [
        '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
        '#14b8a6', '#e11d48'
    ];

    const generateDonutData = () => {
        const sorted = [...activeMixData].sort((a, b) => b.primas - a.primas);
        const top = sorted.slice(0, 10);
        const rest = sorted.slice(10);
        const restTotal = rest.reduce((sum, r) => sum + r.primas, 0);

        const labels = top.map(p => p.name);
        const values = top.map(p => p.primas);

        // Parallel arrays for tooltip data
        const polizas = top.map(p => p.polizas);
        const entes = top.map(p => p.entes);

        if (restTotal > 0) {
            labels.push('Otros');
            values.push(restTotal);
            polizas.push(rest.reduce((sum, r) => sum + r.polizas, 0));
            entes.push(rest.reduce((sum, r) => sum + r.entes, 0));
        }

        return {
            labels,
            datasets: [{
                data: values,
                // Extra data for tooltip
                polizas: polizas,
                entes: entes,
                backgroundColor: DONUT_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff',
            }]
        };
    };

    const generateParetoData = () => {
        if (!advancedMetrics?.paretoData) return { labels: [], datasets: [] };
        // Limit to Top 15 for LEGIBILITY in chart, but use full data for calculations
        const chartData = advancedMetrics.paretoData;

        return {
            labels: chartData.map((d: any) => d.ente),
            datasets: [
                {
                    type: 'line' as const,
                    label: '% Acumulado',
                    data: chartData.map((d: any) => d.cumulativePct),
                    borderColor: '#f59e0b',
                    backgroundColor: '#fbbf24',
                    yAxisID: 'y1',
                    pointRadius: 3,
                    borderWidth: 2,
                    tension: 0.1,
                },
                {
                    type: 'bar' as const,
                    label: 'Primas (€)',
                    data: chartData.map((d: any) => d.primas),
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgb(79, 70, 229)',
                    borderWidth: 1,
                    yAxisID: 'y',
                }
            ]
        };
    };

    const paretoOptions = {
        indexAxis: 'x' as const, // Vertical Columns (Axes Reversed)
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: { left: 0, right: 0, top: 20, bottom: 0 }
        },
        plugins: {
            datalabels: { display: false },
            legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10, weight: 'bold' as const } } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 12 },
                callbacks: {
                    label: (context: any) => {
                        const val = context.raw;
                        if (context.datasetIndex === 0) return `Acumulado: ${val.toFixed(1)}%`;
                        return `Primas: ${currencyFormatter.format(val)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                display: true, // Client Names on Bottom
                grid: { display: false },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 45,
                    font: { size: 9, weight: 'bold' as const },
                    color: '#475569'
                }
            },
            y: {
                display: false, // Clean look for values
            },
            y1: {
                display: false,
                position: 'right' as const,
                grid: { display: false }
            }
        }
    };

    const crossSellData = {
        labels: ['1 Ramo', '2 Ramos', '3+ Ramos'],
        datasets: [{
            label: 'Nº Entes',
            data: advancedMetrics?.crossSellingDistribution ? [
                advancedMetrics.crossSellingDistribution[1],
                advancedMetrics.crossSellingDistribution[2],
                advancedMetrics.crossSellingDistribution['3+']
            ] : [0, 0, 0],
            backgroundColor: ['#818cf8', '#6366f1', '#4f46e5'],
            borderRadius: 8,
        }]
    };

    const survivalData = {
        labels: advancedMetrics?.survivalByRamo?.map((r: any) => r.ramo) || [],
        datasets: [{
            label: 'Meses Vida Media',
            data: advancedMetrics?.survivalByRamo?.map((r: any) => r.avgMonths) || [],
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            borderRadius: 8,
        }]
    };

    const sinEfectoChartData = {
        labels: advancedMetrics?.sinEfectoByRamo?.map((r: any) => r.ramo) || [],
        datasets: [{
            label: 'Pólizas Sin Efecto',
            data: advancedMetrics?.sinEfectoByRamo?.map((r: any) => r.count) || [],
            backgroundColor: 'rgba(148, 163, 184, 0.6)',
            borderColor: 'rgb(100, 116, 139)',
            borderWidth: 1,
            borderRadius: 6,
        }]
    };

    const statusHealthData = {
        labels: ramosBreakdown.map(r => r.ramo).slice(0, 8), // Just for context, but user wants status
    };

    // Correcting statusHealthData - user wants status (Vigor, Pendiente, etc) weighted by Primas
    const generateStatusHealthData = () => {
        const sorted = [...estadosBreakdown].sort((a, b) => b.primas - a.primas);
        return {
            labels: sorted.map(s => s.estado),
            datasets: [{
                label: 'Volumen de Primas (€)',
                data: sorted.map(s => s.primas),
                backgroundColor: sorted.map(s => {
                    const e = s.estado.toLowerCase();
                    if (e.includes('vigor')) return 'rgba(16, 185, 129, 0.6)';
                    if (e.includes('anula') || e.includes('baja')) return 'rgba(239, 68, 68, 0.6)';
                    if (e.includes('pendien')) return 'rgba(245, 158, 11, 0.6)';
                    return 'rgba(100, 116, 139, 0.6)';
                }),
                borderRadius: 4,
            }]
        };
    };

    const statusHealthOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            datalabels: { display: false },
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => `Primas: ${currencyFormatter.format(context.raw)}`
                }
            }
        },
        scales: {
            x: { display: false },
            y: { ticks: { font: { size: 9, weight: 'bold' as const } }, grid: { display: false } }
        }
    };

    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: handleChartClick, // Enabling click interaction
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { boxWidth: 10, font: { size: 9 }, padding: 10, usePointStyle: true }
            },
            datalabels: {
                formatter: (val: number, ctx: any) => {
                    const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const pct = total > 0 ? (val / total * 100) : 0;
                    // Only show if > 4% to avoid clutter
                    if (pct < 4) return null;
                    return Math.round(pct) + '%';
                },
                color: '#fff',
                font: { weight: 'bold' as const, size: 10 },
                align: 'center' as const,
                anchor: 'center' as const,
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 12 },
                callbacks: {
                    label: (context: any) => {
                        const val = context.raw;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                        return `${context.label}: ${pct}%`;
                    },
                    afterLabel: (context: any) => {
                        const val = context.raw;
                        const polizasCount = context.dataset.polizas[context.dataIndex];
                        const entesCount = context.dataset.entes[context.dataIndex];
                        return [
                            `Primas: ${currencyFormatter.format(val)}`,
                            `Pólizas: ${numberFormatter.format(polizasCount)}`,
                            `Entes: ${numberFormatter.format(entesCount)}`
                        ];
                    }
                }
            }
        }
    };

    const getFilterParams = (item: string) => {
        const params = new URLSearchParams();
        if (filters.comercial.length > 0) params.append('comercial', filters.comercial.join(','));
        if (filters.ente.length > 0) params.append('ente', filters.ente.join(','));
        if (filters.anio.length > 0) params.append('anio', filters.anio.join(','));
        if (filters.mes.length > 0) params.append('mes', filters.mes.join(','));
        if (filters.estado.length > 0) params.append('estado', filters.estado.join(','));
        if (filters.ramo.length > 0) params.append('ramo', filters.ramo.join(',')); // Add global ramo filter
        if (filters.producto.length > 0) params.append('producto', filters.producto.join(',')); // Add global product filter

        if (mixDepth === 'ramo') {
            params.append('ramo', item); // Specific item override/add
        } else {
            params.append('producto', item);
        }
        return params.toString();
    };

    return (
        <div className="space-y-8 pb-12 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-3">
                            Salud de la Cartera
                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 uppercase tracking-tighter">
                                {loading ? 'Cargando...' : `${advancedMetrics?.totalEntes || 0} Entes únicos`}
                            </span>
                        </h1>
                        <p className="text-sm text-slate-500 font-medium tracking-wide">Auditoría estratégica 100% veraz basada en el historial completo</p>
                    </div>
                </div>

                {/* Action Buttons Group */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto no-print">
                    {(filters.ramo.length > 0 || filters.producto.length > 0) && (
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, ramo: [], producto: [] }))}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all shadow-sm text-xs md:text-sm font-medium text-red-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x w-4 h-4" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                            Limpiar
                        </button>
                    )}
                    <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-xs md:text-sm font-medium">
                        <FileDown className="w-4 h-4 text-green-600" />
                        Excel
                    </button>
                    <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm text-xs md:text-sm font-medium">
                        <Printer className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            <PrintFilterSummary filters={filters} />

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Comercial" options={filterOptions.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Primas en Cartera</h3>
                        <div className="p-2 bg-indigo-50 rounded-lg"><ShieldCheck className="w-4 h-4 text-indigo-500" /></div>
                    </div>
                    <div className="mt-4">
                        <span className="text-2xl font-black text-slate-800 tracking-tight">{metrics ? currencyFormatter.format(metrics.primasNP) : '0,00 €'}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pólizas Activas</h3>
                        <div className="p-2 bg-emerald-50 rounded-lg"><Package className="w-4 h-4 text-emerald-500" /></div>
                    </div>
                    <div className="mt-4">
                        <span className="text-2xl font-black text-slate-800 tracking-tight">{metrics ? numberFormatter.format(metrics.numPolizas) : '0'}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasa Abandono</h3>
                        <div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="w-4 h-4 text-red-500" /></div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-red-600 tracking-tight">{metrics ? metrics.churnRate.toFixed(1) : '0.0'}%</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Venta Cruzada</h3>
                        <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="w-4 h-4 text-purple-500" /></div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-purple-600 tracking-tight">{metrics ? metrics.crossSellRatio.toFixed(2) : '0.00'}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin Efecto</h3>
                        <div className="p-2 bg-slate-50 rounded-lg"><XCircle className="w-4 h-4 text-slate-400" /></div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-600 tracking-tight">{metrics ? metrics.polizasSinEfecto : '0'}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Anuladas</span>
                    </div>
                </div>
            </div>

            {/* Main Distribution */}
            <div className="bg-white p-8 print:p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-purple-50 rounded-lg"><PieIcon className="w-5 h-5 text-purple-500" /></div>
                        Mix de Productos por Ramo
                    </h2>
                    <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-100 no-print">
                        <button onClick={() => setMixDepth('ramo')} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${mixDepth === 'ramo' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Ramos</button>
                        <button onClick={() => setMixDepth('producto')} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${mixDepth === 'producto' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Productos</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 print:grid-cols-1">
                    <div className="h-[350px] relative">
                        {!loading && activeMixData.length > 0 ? (
                            <Doughnut data={generateDonutData()} options={donutOptions as any} />
                        ) : (
                            <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-medium">Cargando distribución...</div>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="p-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{mixDepth === 'ramo' ? 'Ramo' : 'Producto'}</th>
                                    <th className="p-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primas</th>
                                    <th className="p-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peso</th>
                                    <th className="p-3 pr-6 text-right no-print">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {activeMixData.sort((a, b) => b.primas - a.primas).slice(0, 8).map((p, i) => {
                                    const totalPrimas = activeMixData.reduce((s, x) => s + x.primas, 0);
                                    const pct = totalPrimas > 0 ? ((p.primas / totalPrimas) * 100).toFixed(1) : '0';
                                    const isSelected = mixDepth === 'ramo' ? filters.ramo.includes(p.name) : filters.producto.includes(p.name);
                                    return (
                                        <tr key={i} onClick={() => toggleFilter(mixDepth, p.name)} className={`transition-colors cursor-pointer group/row ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3 font-semibold text-slate-700 flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                <span className="truncate uppercase tracking-tight text-xs">{p.name}</span>
                                            </td>
                                            <td className="p-3 text-right font-extrabold text-primary font-mono text-xs">{currencyFormatter.format(p.primas)}</td>
                                            <td className="p-3 text-right font-bold text-slate-400 text-xs">{pct}%</td>
                                            <td className="p-3 pr-6 text-right no-print">
                                                <button onClick={(e) => { e.stopPropagation(); window.location.href = `/polizas/listado?${getFilterParams(p.name)}`; }} className="p-1.5 text-primary hover:text-white hover:bg-primary transition-all rounded-lg border border-slate-200 shadow-sm"><TrendingUp className="w-3.5 h-3.5" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Strategic Analysis & Pareto Section - Rebuilt for Horizontal Dominance */}
            <div className="space-y-8 no-print">
                <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4 tracking-tighter">
                                <div className="p-3 bg-amber-50 rounded-2xl text-amber-500 shadow-sm"><Zap className="w-6 h-6" /></div>
                                Análisis de Concentración Estratégica
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Identificación de activos críticos y potencial de expansión del Long Tail</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-10">
                        {/* Top: Insights Row */}
                        {advancedMetrics?.paretoData ? (
                            (() => {
                                const data = advancedMetrics.paretoData;
                                const totalEntes = advancedMetrics.totalEntes || 0;
                                const criticalIdx = data.findIndex((d: any) => d.cumulativePct >= 80);
                                const vips = criticalIdx !== -1 ? criticalIdx + 1 : 0;
                                const concentrationPct = totalEntes > 0 ? (vips / totalEntes) * 100 : 0;
                                const totalPlus1 = advancedMetrics.crossSellingDistribution?.[1] || 0;

                                const isRisky = concentrationPct > 0 && concentrationPct < 15;
                                const isResilient = concentrationPct > 25;

                                return (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {/* 1. Jump Probabilities Box (Fixed) */}
                                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800" />
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-3">Eficiencia de Conversión</h4>
                                                <div className="flex-1 flex flex-col justify-center gap-4 pl-3">
                                                    <div>
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">1 → 2 Ramos</span>
                                                            <span className="text-xs font-black text-slate-800">{advancedMetrics.jumpProbabilities?.['1to2'].toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${advancedMetrics.jumpProbabilities?.['1to2']}%` }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">2 → 3+ Ramos</span>
                                                            <span className="text-xs font-black text-slate-800">{advancedMetrics.jumpProbabilities?.['2to3'].toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${advancedMetrics.jumpProbabilities?.['2to3']}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Dynamic Strategies from Backend */}
                                            {advancedMetrics.marketingStrategies?.map((strategy: any, idx: number) => (
                                                <div key={idx} className={`p-6 rounded-[32px] border border-slate-100 shadow-sm bg-white relative overflow-hidden group hover:shadow-md transition-all`}>
                                                    <div className={`absolute top-0 left-0 w-1.5 h-full bg-${strategy.color}-500`} />
                                                    <div className="flex flex-col h-full pl-3">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <h4 className={`text-[9px] font-black uppercase tracking-widest text-${strategy.color}-600 bg-${strategy.color}-50 px-2 py-1 rounded-md`}>
                                                                {strategy.title}
                                                            </h4>
                                                            {strategy.type === 'CROSS_SELL' && <Zap className={`w-4 h-4 text-${strategy.color}-500`} />}
                                                            {strategy.type === 'RETENTION' && <AlertCircle className={`w-4 h-4 text-${strategy.color}-500`} />}
                                                            {strategy.type === 'EXPANSION' && <TrendingUp className={`w-4 h-4 text-${strategy.color}-500`} />}
                                                            {strategy.type === 'CONCENTRATION' && <ShieldCheck className={`w-4 h-4 text-${strategy.color}-500`} />}
                                                        </div>
                                                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                            {strategy.description.split('**').map((part: string, i: number) =>
                                                                i % 2 === 1 ? <strong key={i} className={`text-${strategy.color}-700`}>{part}</strong> : part
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Full Width Chart Area */}
                                        <div className="mt-4">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                                    Curva de Pareto: Todos los Entes
                                                    <div className="h-px bg-slate-100 w-40"></div>
                                                </h4>
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-400 opacity-40"></div><span className="text-[10px] font-bold text-slate-400">Primas (€)</span></div>
                                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-400">% Acumulado</span></div>
                                                </div>
                                            </div>

                                            <div className="h-[450px] w-full">
                                                <Chart
                                                    type="bar"
                                                    data={generateParetoData()}
                                                    options={paretoOptions as any}
                                                />
                                            </div>
                                        </div>
                                    </>
                                );
                            })()
                        ) : (
                            <div className="h-[400px] w-full bg-slate-50 animate-pulse rounded-[40px]" />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3 tracking-tight mb-4"><LayoutList className="w-4 h-4 text-indigo-500" /> Venta Cruzada</h2>
                    <div className="h-[100px]">
                        {advancedMetrics ? <Bar data={crossSellData} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } } } }} /> : <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-red-500" /> Vida Media</h3>
                        <div className="h-[100px]"><Bar data={survivalData} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 8, weight: 'bold' } } } } }} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Salud por Estado</h3>
                        <div className="h-[100px]"><Bar data={generateStatusHealthData()} options={statusHealthOptions as any} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3"><XCircle className="w-4 h-4 text-slate-500" /> Por Ramo (Sin Efecto)</h3>
                        <div className="h-[100px]"><Bar data={sinEfectoChartData} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 8, weight: 'bold' }, precision: 0 } } } }} /></div>
                    </div>
                </div>
            </div>

            {/* Clients per Ramo Intelligence Section */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden no-print">
                <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-lg font-extrabold flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Users className="w-5 h-5" /></div>
                        Inteligencia de Entes por Ramo
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top 5 Entes Comerciales por Ramo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 divide-x divide-y divide-slate-100">
                    {ramosBreakdown?.map((ramo: any) => (
                        <div key={ramo.ramo} className="p-6 hover:bg-slate-50/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className="cursor-pointer group/header"
                                    onClick={() => setSelectedRamoForList({ ramoName: ramo.ramo, clients: ramo.fullClients || ramo.topClients })}
                                >
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover/header:text-indigo-600 transition-colors">{ramo.ramo}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 group-hover/header:text-indigo-500 transition-colors">{ramo.entes} Entes en este ramo <span className="text-xs">→</span></p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-primary">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(ramo.primas)}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {ramo.topClients?.map((client: any, idx: number) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedEnteForProfile(client)}
                                        className="group p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
                                    >
                                        {client.nba && (
                                            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                                        )}
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-slate-800 truncate max-w-[120px] group-hover:text-indigo-700 transition-colors">{client.name}</span>
                                            {client.nba ? (
                                                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                    {client.nba.confidence}% Éxito
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-emerald-600">
                                                    {client.ramosCount} Ramos
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2 mb-2">
                                            {client.products.slice(0, 3).map((p: string) => (
                                                <span key={p} className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md font-medium border border-slate-200/50">{p}</span>
                                            ))}
                                            {client.products.length > 3 && <span className="text-[8px] text-slate-400">+{client.products.length - 3}</span>}
                                        </div>

                                        {/* NBA Recommendation */}
                                        {client.nba && (
                                            <div className="mt-2 pt-2 border-t border-slate-50">
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-700">
                                                    <Zap className="w-3 h-3 fill-indigo-100" />
                                                    Vender: {client.nba.product}
                                                </div>
                                                <div className="text-[8px] text-slate-400 mt-0.5 pl-4 leading-tight">
                                                    {client.nba.reason}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden no-print">
                <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-800">
                    <h3 className="text-lg font-extrabold flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Package className="w-5 h-5" /></div>
                        Desglose Detallado
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                        <MultiSelect label="Comercial" options={filterOptions.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                        <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                        <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                        <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                        <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/30">
                            <tr>
                                <th onClick={() => handleSort('ramo')} className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">Ramo <SortIcon col="ramo" /></th>
                                <th onClick={() => handleSort('producto')} className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">Producto <SortIcon col="producto" /></th>
                                <th onClick={() => handleSort('polizas')} className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">Pólizas <SortIcon col="polizas" /></th>
                                <th onClick={() => handleSort('primas')} className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">Primas (€) <SortIcon col="primas" /></th>
                                <th className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Peso</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {sortedData.map((item, idx) => {
                                const totalPrimas = productosBreakdown.reduce((sum, d) => sum + d.primas, 0);
                                const pct = totalPrimas > 0 ? ((item.primas / totalPrimas) * 100).toFixed(1) : '0';
                                return (
                                    <tr key={idx} onClick={() => toggleFilter('producto', item.producto)} className="hover:bg-slate-50 cursor-pointer transition-colors font-medium">
                                        <td className="px-8 py-4 text-[10px] uppercase text-slate-400 font-bold">{item.ramo}</td>
                                        <td className="px-8 py-4 text-xs font-bold text-slate-700">{item.producto}</td>
                                        <td className="px-8 py-4 text-xs text-right text-slate-500 font-mono">{numberFormatter.format(item.polizas)}</td>
                                        <td className="px-8 py-4 text-xs text-right text-primary font-black font-mono">{currencyFormatter.format(item.primas)}</td>
                                        <td className="px-8 py-4 text-[10px] text-right text-slate-400 font-bold">{pct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal: Full Client List per Ramo */}
            {selectedRamoForList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-500" />
                                    Entes Comerciales - {selectedRamoForList.ramoName}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{selectedRamoForList.clients.length} entes encontrados en este ramo</p>
                            </div>
                            <button onClick={() => setSelectedRamoForList(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedRamoForList.clients.map((client: any, idx: number) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setSelectedRamoForList(null);
                                            setSelectedEnteForProfile(client);
                                        }}
                                        className="group p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-slate-800 line-clamp-2 max-w-[75%] group-hover:text-indigo-700 transition-colors">{client.name}</span>
                                            <div className="text-right">
                                                <div className="text-xs font-black text-primary">{currencyFormatter.format(client.primas)}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-3">
                                            {client.products.slice(0, 4).map((p: string) => (
                                                <span key={p} className="text-[9px] px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium border border-slate-200/50">{p}</span>
                                            ))}
                                            {client.products.length > 4 && <span className="text-[9px] px-2 py-1 bg-slate-50 text-slate-400 rounded-md">+{client.products.length - 4}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Ente 360 Profile */}
            {selectedEnteForProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-slate-200/50">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-gradient-to-br from-slate-50 to-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

                            <div className="relative z-10 w-full pr-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded uppercase tracking-widest">
                                        Perfil 360
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">{selectedEnteForProfile.ramosCount} Ramos Contratados</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                    {selectedEnteForProfile.name}
                                </h3>
                                <div className="mt-3 flex gap-4">
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        {currencyFormatter.format(selectedEnteForProfile.primas)} Primas Anuales
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedEnteForProfile(null)} className="relative z-10 p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-700">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30 flex flex-col gap-8">

                            {/* Predictive NBA Panel */}
                            {selectedEnteForProfile.nba ? (
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                    <div className="flex items-start gap-4 relative z-10">
                                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                            <Zap className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-1">Motor Predictivo (Venta Cruzada)</h4>
                                            <div className="text-xl font-bold mb-2">Oportunidad: Vender <span className="font-black text-white bg-white/20 px-2 py-0.5 rounded-lg">{selectedEnteForProfile.nba.product}</span></div>
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className="bg-emerald-400 text-emerald-950 text-xs font-black px-2.5 py-1 rounded-md">
                                                    {selectedEnteForProfile.nba.confidence}% de Probabilidad de Éxito
                                                </span>
                                                <span className="text-xs text-indigo-100 font-medium flex items-center gap-1">
                                                    <Info className="w-3.5 h-3.5" />
                                                    Basado en un {selectedEnteForProfile.nba.reason.toLowerCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 rounded-xl"><ShieldCheck className="w-5 h-5 text-emerald-500" /></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Alta Vinculación</h4>
                                            <p className="text-xs text-slate-500">Este ente ya posee múltiples productos estratégicos.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Timeline section */}
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <LayoutList className="w-4 h-4 text-slate-400" />
                                    Línea Temporal de Productos
                                </h4>

                                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                                    {selectedEnteForProfile.timeline?.map((item: any, idx: number) => (
                                        <div key={idx} className="relative pl-6">
                                            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50"></div>
                                            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 hover:border-indigo-200 transition-colors">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-slate-800">{item.producto}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                                        {item.fechaEfecto || 'Fecha Desconocida'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium">Activo</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedEnteForProfile.timeline || selectedEnteForProfile.timeline.length === 0) && (
                                        <div className="pl-6 text-sm text-slate-500 italic">No hay historial temporal disponible para este ente.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
