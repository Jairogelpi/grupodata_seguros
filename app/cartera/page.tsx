"use client";

import { useEffect, useState } from 'react';
import { PieChart as PieIcon, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, Package, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';
import { Pie } from 'react-chartjs-2';
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

type SortKey = 'producto' | 'primas' | 'polizas' | 'ramo';

export default function CarteraPage() {
    const [productosBreakdown, setProductosBreakdown] = useState<ProductBreakdownItem[]>([]);
    const [ramosBreakdown, setRamosBreakdown] = useState<RamoBreakdownItem[]>([]);
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
        estado: [] as string[]
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
        return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
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

    // Insights Logic
    const getInsights = () => {
        if (ramosBreakdown.length === 0) return [];
        const insights = [];
        const totalPrimas = ramosBreakdown.reduce((sum, r) => sum + r.primas, 0);
        const sortedRamos = [...ramosBreakdown].sort((a, b) => b.primas - a.primas);

        // 1. Dominant Ramo
        if (sortedRamos[0]) {
            const pct = (sortedRamos[0].primas / totalPrimas * 100).toFixed(1);
            insights.push({
                type: 'info',
                title: `Dominancia de ${sortedRamos[0].ramo}`,
                text: `El ramo ${sortedRamos[0].ramo} representa el ${pct}% de la cartera total.`,
                icon: <ShieldCheck className="w-5 h-5 text-blue-500" />
            });
        }

        // 2. Ticket Medio Opportunity
        const prodOrderByTicket = [...productosBreakdown].filter(p => p.polizas > 5).sort((a, b) => (a.primas / a.polizas) - (b.primas / b.polizas));
        if (prodOrderByTicket[0]) {
            insights.push({
                type: 'warning',
                title: 'Optimización de Ticket Medio',
                text: `${prodOrderByTicket[0].producto} tiene un volumen alto de pólizas pero un ticket medio bajo (${currencyFormatter.format(prodOrderByTicket[0].primas / prodOrderByTicket[0].polizas)}).`,
                icon: <Zap className="w-5 h-5 text-amber-500" />
            });
        }

        // 3. Diversificación
        if (ramosBreakdown.length < 3) {
            insights.push({
                type: 'danger',
                title: 'Riesgo de Concentración',
                text: 'La cartera está muy concentrada en pocos ramos. Considera diversificar para reducir el riesgo.',
                icon: <AlertCircle className="w-5 h-5 text-red-500" />
            });
        }

        return insights;
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Salud de la Cartera</h1>
                    <p className="mt-2 text-slate-600">Distribución de producción por Ramo y Producto</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium shadow-sm">
                        <FileDown className="w-4 h-4 text-green-600" />
                        Excel
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm">
                        <Printer className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            <PrintFilterSummary filters={filters} />

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Comercial" options={filterOptions.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
                </div>
            </div>

            {/* Capa Superior: Ramo Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ramosBreakdown.sort((a, b) => b.primas - a.primas).map((ramo, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-primary/30 transition-all">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{ramo.ramo}</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">{currencyFormatter.format(ramo.primas).replace(",00", "")}</p>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[11px] text-slate-500">{ramo.polizas} pólizas</span>
                            <span className="text-[11px] font-bold text-primary bg-primary/5 px-1.5 rounded">
                                {((ramo.primas / (ramosBreakdown.reduce((s, r) => s + r.primas, 0) || 1)) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Product Pie */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-primary" />
                        Peso por Producto (Primas)
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                        {!loading && productosBreakdown.length > 0 ? (
                            <Pie
                                data={generatePieData(productosBreakdown, 'producto', 'primas')}
                                options={{
                                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                                    maintainAspectRatio: false
                                }}
                            />
                        ) : (
                            <div className="text-slate-300 italic text-sm">Cargando gráfico...</div>
                        )}
                    </div>
                </div>

                {/* Ramo Pie */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-primary" />
                        Peso por Ramo (Primas)
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                        {!loading && ramosBreakdown.length > 0 ? (
                            <Pie
                                data={generatePieData(ramosBreakdown, 'ramo', 'primas')}
                                options={{
                                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                                    maintainAspectRatio: false
                                }}
                            />
                        ) : (
                            <div className="text-slate-300 italic text-sm">Cargando gráfico...</div>
                        )}
                    </div>
                </div>

                {/* Insights Panel */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        Insights Inteligentes
                    </h3>
                    <div className="space-y-4">
                        {getInsights().map((insight, idx) => (
                            <div key={idx} className="flex gap-3 bg-white p-3 rounded-lg shadow-sm border-l-4 border-l-primary">
                                <div className="mt-0.5">{insight.icon}</div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{insight.title}</p>
                                    <p className="text-[11px] text-slate-600 mt-1">{insight.text}</p>
                                </div>
                            </div>
                        ))}
                        {getInsights().length === 0 && (
                            <div className="text-center py-10">
                                <Info className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-xs text-slate-400">Analizando datos para generar insights...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-slate-800">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Desglose Detallado
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th onClick={() => handleSort('ramo')} className="px-6 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-widest cursor-pointer">
                                    <span className="flex items-center">Ramo <SortIcon col="ramo" /></span>
                                </th>
                                <th onClick={() => handleSort('producto')} className="px-6 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-widest cursor-pointer">
                                    <span className="flex items-center">Producto <SortIcon col="producto" /></span>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="px-6 py-3 text-right text-[11px] font-bold text-primary uppercase tracking-widest cursor-pointer">
                                    <span className="flex items-center justify-end">Pólizas <SortIcon col="polizas" /></span>
                                </th>
                                <th onClick={() => handleSort('primas')} className="px-6 py-3 text-right text-[11px] font-bold text-primary uppercase tracking-widest cursor-pointer">
                                    <span className="flex items-center justify-end">Primas (€) <SortIcon col="primas" /></span>
                                </th>
                                <th className="px-6 py-3 text-right text-[11px] font-bold text-primary uppercase tracking-widest">Peso</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedData.map((item, idx) => {
                                const totalPrimas = productosBreakdown.reduce((sum, d) => sum + d.primas, 0);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-wider">{item.ramo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.producto}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{numberFormatter.format(item.polizas)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold font-mono">{currencyFormatter.format(item.primas)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 text-right bg-slate-50/30">
                                            {((item.primas / (totalPrimas || 1)) * 100).toFixed(1)}%
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
