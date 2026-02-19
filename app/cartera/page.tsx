"use client";

import { useEffect, useState, useMemo } from 'react';
import { PieChart as PieIcon, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, Package, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { getRamo } from '@/lib/ramos';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

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
}

type SortKey = 'producto' | 'primas' | 'polizas' | 'ramo' | 'ticketMedio';

export default function CarteraPage() {
    const [productosBreakdown, setProductosBreakdown] = useState<ProductBreakdownItem[]>([]);
    const [ramosBreakdown, setRamosBreakdown] = useState<RamoBreakdownItem[]>([]);
    const [cancellationReasons, setCancellationReasons] = useState<{ reason: string; count: number }[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        anios: [],
        meses: [],
        estados: [],
        asesores: [],
        entes: []
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
            setCancellationReasons(data.cancellationReasons || []);
            setMetrics(data.metrics);
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
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Salud de la Cartera</h1>
                        <p className="text-sm text-slate-500 font-medium tracking-wide">Análisis de composición y distribución de riesgos</p>
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

            {/* Top Cancellation Reasons Widget */}
            {cancellationReasons.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Top Motivos de Anulación
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {cancellationReasons.slice(0, 5).map((reason, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">#{idx + 1}</span>
                                <span className="text-sm font-bold text-slate-800 truncate" title={reason.reason}>{reason.reason || 'Sin Motivo'}</span>
                                <span className="text-xs text-slate-500 font-medium mt-1">{reason.count} anulaciones</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Distribution Chart & Inline Table */}
            <div className="bg-white p-8 print:p-6 rounded-2xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <PieIcon className="w-5 h-5 text-purple-500" />
                        </div>
                        Mix de Productos por Ramo
                    </h2>
                    <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-100 no-print">
                        <button
                            onClick={() => setMixDepth('ramo')}
                            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${mixDepth === 'ramo' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Ramos
                        </button>
                        <button
                            onClick={() => setMixDepth('producto')}
                            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${mixDepth === 'producto' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Productos
                        </button>
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
                                    <th className="p-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pólizas</th>
                                    <th className="p-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peso</th>
                                    <th className="p-3 pr-6 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider no-print">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {activeMixData.sort((a, b) => b.primas - a.primas).slice(0, 10).map((p, i) => {
                                    const totalPrimas = activeMixData.reduce((s, x) => s + x.primas, 0);
                                    const pct = totalPrimas > 0 ? ((p.primas / totalPrimas) * 100).toFixed(1) : '0';
                                    const isSelected = mixDepth === 'ramo' ? filters.ramo.includes(p.name) : filters.producto.includes(p.name);
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => toggleFilter(mixDepth, p.name)}
                                            className={`transition-colors cursor-pointer group/row ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="p-3 font-semibold text-slate-700 flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                <span className="truncate max-w-[120px] md:max-w-none uppercase tracking-tight text-xs">{p.name}</span>
                                            </td>
                                            <td className="p-3 text-right font-extrabold text-primary font-mono text-xs">{currencyFormatter.format(p.primas)}</td>
                                            <td className="p-3 text-right font-mono text-slate-500 text-xs">{numberFormatter.format(p.polizas)}</td>
                                            <td className="p-3 text-right font-bold text-slate-400 text-xs">{pct}%</td>
                                            <td className="p-3 pr-6 text-right no-print">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent row click
                                                        const url = `/polizas/listado?${getFilterParams(p.name)}`;
                                                        window.location.href = url;
                                                    }}
                                                    className="p-1.5 text-primary hover:text-white hover:bg-primary transition-all rounded-lg border border-slate-200 group-hover/row:border-primary/50 shadow-sm"
                                                    title="Ver listado de pólizas"
                                                >
                                                    <TrendingUp className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-800">
                    <h3 className="text-lg font-extrabold flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Package className="w-5 h-5" />
                        </div>
                        Desglose Detallado por Producto
                    </h3>

                    {/* Table Filters */}
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <div className="w-full md:w-48">
                            <MultiSelect
                                label="Filtrar Ramo"
                                options={Array.from(new Set(productosBreakdown.map(p => p.ramo || 'Otros').filter(Boolean))).sort()}
                                selected={filters.ramo}
                                onChange={(val) => handleFilterChange('ramo', val)}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <MultiSelect
                                label="Filtrar Producto"
                                options={Array.from(new Set(productosBreakdown.map(p => p.producto).filter(Boolean))).sort()}
                                selected={filters.producto}
                                onChange={(val) => handleFilterChange('producto', val)}
                            />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/30">
                            <tr>
                                <th onClick={() => handleSort('ramo')} className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-primary transition-colors">
                                    <span className="flex items-center">Ramo <SortIcon col="ramo" /></span>
                                </th>
                                <th onClick={() => handleSort('producto')} className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-primary transition-colors">
                                    <span className="flex items-center">Producto <SortIcon col="producto" /></span>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-primary transition-colors">
                                    <span className="flex items-center justify-end">Pólizas <SortIcon col="polizas" /></span>
                                </th>
                                <th onClick={() => handleSort('primas')} className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-primary transition-colors">
                                    <span className="flex items-center justify-end">Primas (€) <SortIcon col="primas" /></span>
                                </th>
                                <th onClick={() => handleSort('ticketMedio')} className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-primary transition-colors">
                                    <span className="flex items-center justify-end">Prima Media (€) <SortIcon col="ticketMedio" /></span>
                                </th>
                                <th className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">Peso</th>
                                <th className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] no-print">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {sortedData.map((item, idx) => {
                                const totalPrimas = productosBreakdown.reduce((sum, d) => sum + d.primas, 0);
                                const pct = totalPrimas > 0 ? ((item.primas / totalPrimas) * 100).toFixed(1) : '0';
                                const isSelected = filters.producto.includes(item.producto);
                                return (
                                    <tr
                                        key={idx}
                                        onClick={() => toggleFilter('producto', item.producto)}
                                        className={`transition-colors cursor-pointer group/row ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="px-8 py-5 whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">{item.ramo}</td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-slate-800">{item.producto}</td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500 text-right font-mono">{numberFormatter.format(item.polizas)}</td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm text-primary text-right font-black font-mono tracking-tight">{currencyFormatter.format(item.primas)}</td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm text-indigo-600 text-right font-bold font-mono bg-indigo-50/30">{currencyFormatter.format(item.ticketMedio || 0)}</td>
                                        <td className="px-8 py-5 whitespace-nowrap text-[11px] text-slate-400 text-right font-bold bg-slate-50/20">
                                            {pct}%
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap text-right no-print">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const url = `/polizas/listado?${getFilterParams(item.producto)}`;
                                                    window.location.href = url;
                                                }}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-primary transition-all rounded-lg border border-transparent hover:border-primary shadow-sm"
                                                title="Ver listado de pólizas"
                                            >
                                                <TrendingUp className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
