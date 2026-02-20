'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    Users,
    FileText,
    Building2,
    ArrowUpDown,
    LayoutList,
    FileDown,
    Printer,
    PieChart,
    TrendingUp,
    XCircle,
    MousePointer2
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartEvent, ActiveElement } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import MultiSelect from '@/components/MultiSelect';
import * as XLSX from 'xlsx';

// Register ChartJS with DataLabels
ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

// Types
interface CompanyStats {
    company: string;
    primas: number;
    polizas: number;
    numEntes: number;
    numAsesores: number;
    ticketMedio: number;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

type SortKey = 'company' | 'primas' | 'polizas' | 'ticketMedio' | 'numEntes' | 'numAsesores';

export default function CompaniasPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CompanyStats[]>([]);
    const [filters, setFilters] = useState({
        comercial: [] as string[],
        anio: [] as string[],
        mes: [] as string[],
        estado: [] as string[],
        ente: [] as string[],
        compania: [] as string[] // Filtro interactivo BI
    });
    const [options, setOptions] = useState<FilterOptions>({
        anios: [],
        meses: [],
        estados: [],
        asesores: [],
        entes: []
    });
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'primas',
        direction: 'desc'
    });

    const [metrics, setMetrics] = useState({
        primasNP: 0,
        numPolizas: 0,
        count: 0
    });

    useEffect(() => {
        fetchMetrics();
    }, [filters.comercial, filters.anio, filters.mes, filters.estado, filters.ente]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.comercial.length) params.append('comercial', filters.comercial.join(','));
            if (filters.anio.length) params.append('anio', filters.anio.join(','));
            if (filters.mes.length) params.append('mes', filters.mes.join(','));
            if (filters.estado.length) params.append('estado', filters.estado.join(','));
            if (filters.ente.length) params.append('ente', filters.ente.join(','));

            const res = await fetch(`/api/metrics?${params.toString()}`);
            const json = await res.json();

            if (json.companiasBreakdown) setData(json.companiasBreakdown);
            if (json.filters) setOptions(json.filters);
            if (json.metrics) setMetrics(json.metrics);
        } catch (error) {
            console.error('Error fetching metrics', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key: keyof typeof filters, selected: string[]) => {
        setFilters(prev => ({ ...prev, [key]: selected }));
    };

    const toggleInteractiveSelection = (val: string) => {
        if (val === 'Otras') return;
        setFilters(prev => {
            const current = prev.compania;
            const isSelected = current.includes(val);
            return {
                ...prev,
                compania: isSelected ? current.filter(item => item !== val) : [...current, val]
            };
        });
    };

    const clearInteractiveSelection = () => {
        setFilters(prev => ({ ...prev, compania: [] }));
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // --- LÓGICA BI CLIENT-SIDE ---

    const finalTableData = useMemo(() => {
        if (filters.compania.length === 0) return data;
        return data.filter(d => filters.compania.includes(d.company));
    }, [data, filters.compania]);

    const sortedData = useMemo(() => {
        const sorted = [...data];
        sorted.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [data, sortConfig]);

    const SortIcon = ({ col }: { col: SortKey }) => {
        return (
            <span className="ml-1 inline-block">
                {sortConfig.key === col ? (
                    sortConfig.direction === 'asc' ? <ArrowUpDown className="w-4 h-4 text-primary" /> : <ArrowUpDown className="w-4 h-4 text-primary rotate-180" />
                ) : (
                    <ArrowUpDown className="w-4 h-4 text-slate-300" />
                )}
            </span>
        );
    };

    const chartDataPrimas = useMemo(() => {
        const sorted = [...data].sort((a, b) => b.primas - a.primas);
        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5);
        const otherPrimas = others.reduce((sum, d) => sum + d.primas, 0);

        const labels = top5.map(d => d.company || 'Sin Nombre');
        if (otherPrimas > 0) labels.push('Otras');

        const values = top5.map(d => d.primas);
        if (otherPrimas > 0) values.push(otherPrimas);

        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#cbd5e1'
                ],
                borderWidth: 0,
                hoverOffset: 12
            }]
        };
    }, [data]);

    const chartDataPolizas = useMemo(() => {
        const sorted = [...data].sort((a, b) => b.polizas - a.polizas);
        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5);
        const otherPolizas = others.reduce((sum, d) => sum + d.polizas, 0);

        const labels = top5.map(d => d.company || 'Sin Nombre');
        if (otherPolizas > 0) labels.push('Otras');

        const values = top5.map(d => d.polizas);
        if (otherPolizas > 0) values.push(otherPolizas);

        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#10b981', '#3b82f6', '#f43f5e', '#a855f7', '#fbbf24', '#cbd5e1'
                ],
                borderWidth: 0,
                hoverOffset: 12
            }]
        };
    }, [data]);

    const getChartOptions = (dataKey: 'primas' | 'polizas') => ({
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event: ChartEvent, elements: ActiveElement[], chart: any) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const label = chart.data.labels[index];
                toggleInteractiveSelection(label);
            }
        },
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    font: { size: 11, weight: 'bold' as any },
                    padding: 15,
                    color: '#64748b'
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const val = context.raw;
                        const sum = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const perc = ((val * 100) / sum).toFixed(1) + '%';
                        if (dataKey === 'primas') {
                            return `${context.label}: ${currencyFormatter.format(val)} (${perc})`;
                        }
                        return `${context.label}: ${numberFormatter.format(val)} pólizas (${perc})`;
                    }
                }
            },
            datalabels: {
                color: '#fff',
                font: { weight: 'bold' as any, size: 11 },
                formatter: (value: number, ctx: any) => {
                    const sum = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const perc = (value * 100 / sum);
                    return perc > 4 ? perc.toFixed(1) + '%' : '';
                },
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowBlur: 4
            }
        }
    });

    const getFilterParams = (compania: string) => {
        const params = new URLSearchParams();
        if (filters.comercial.length > 0) params.append('comercial', filters.comercial.join(','));
        if (filters.anio.length > 0) params.append('anio', filters.anio.join(','));
        if (filters.mes.length > 0) params.append('mes', filters.mes.join(','));
        if (filters.estado.length > 0) params.append('estado', filters.estado.join(','));
        if (filters.ente.length > 0) params.append('ente', filters.ente.join(','));

        params.append('compania', compania);
        return params.toString();
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(sortedData.map(d => ({
            'Compañía': d.company,
            'Primas Totales': d.primas,
            'Nº Pólizas': d.polizas,
            'Ticket Medio': d.ticketMedio,
            'Comerciales Únicos': d.numAsesores,
            'Entes Únicos': d.numEntes
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Compañías");
        XLSX.writeFile(wb, "metricas_companias.xlsx");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-primary" />
                        Métricas por Compañía
                    </h1>
                    <p className="text-slate-500 mt-1">Análisis detallado de rendimiento con filtros interactivos BI</p>
                </div>
                <div className="flex gap-2 no-print">
                    {filters.compania.length > 0 && (
                        <button
                            onClick={clearInteractiveSelection}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-xl hover:bg-red-100 transition-colors font-bold shadow-sm text-sm"
                        >
                            <XCircle className="w-4 h-4" /> Limpiar Selección
                        </button>
                    )}
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm">
                        <FileDown className="w-4 h-4" /> Exportar
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-sm">
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
                <MultiSelect label="Comercial" options={options.asesores} selected={filters.comercial} onChange={(val) => handleFilterChange('comercial', val)} />
                <MultiSelect label="Ente" options={options.entes} selected={filters.ente} onChange={(val) => handleFilterChange('ente', val)} />
                <MultiSelect label="Año" options={options.anios} selected={filters.anio} onChange={(val) => handleFilterChange('anio', val)} />
                <MultiSelect label="Mes" options={options.meses} selected={filters.mes} onChange={(val) => handleFilterChange('mes', val)} />
                <MultiSelect label="Estado" options={options.estados} selected={filters.estado} onChange={(val) => handleFilterChange('estado', val)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Building2 className="w-24 h-24 text-slate-900" />
                    </div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Compañías Activas</div>
                    <div className="text-3xl font-black text-slate-900">{finalTableData.length}</div>
                    <div className="mt-2 text-xs text-slate-400 font-medium">En selección actual</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-24 h-24 text-indigo-600" />
                    </div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Primas Totales</div>
                    <div className="text-3xl font-black text-indigo-600">
                        {currencyFormatter.format(finalTableData.reduce((sum, d) => sum + d.primas, 0))}
                    </div>
                    <div className="mt-2 text-xs text-slate-400 font-medium">Volumen de negocio</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <FileText className="w-24 h-24 text-emerald-600" />
                    </div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Número de Pólizas</div>
                    <div className="text-3xl font-black text-emerald-600">
                        {numberFormatter.format(finalTableData.reduce((sum, d) => sum + d.polizas, 0))}
                    </div>
                    <div className="mt-2 text-xs text-slate-400 font-medium underline decoration-emerald-200 underline-offset-4 decoration-2">Número de Pólizas</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-indigo-500" /> Distribución por Primas (%)
                    </h3>
                    <div className="h-[300px] flex items-center justify-center cursor-pointer">
                        {data.length > 0 ? (
                            <Doughnut data={chartDataPrimas} options={getChartOptions('primas')} />
                        ) : (
                            <div className="text-slate-400 text-sm">Sin datos para mostrar</div>
                        )}
                    </div>
                    <div className="mt-4 text-[10px] text-slate-400 font-bold flex items-center gap-1 no-print uppercase tracking-widest">
                        <MousePointer2 className="w-3 h-3" /> Haz click en un sector para filtrar
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-emerald-500" /> Distribución por Pólizas (%)
                    </h3>
                    <div className="h-[300px] flex items-center justify-center cursor-pointer">
                        {data.length > 0 ? (
                            <Doughnut data={chartDataPolizas} options={getChartOptions('polizas')} />
                        ) : (
                            <div className="text-slate-400 text-sm">Sin datos para mostrar</div>
                        )}
                    </div>
                    <div className="mt-4 text-[10px] text-slate-400 font-bold flex items-center gap-1 no-print uppercase tracking-widest">
                        <MousePointer2 className="w-3 h-3" /> Haz click en un sector para filtrar
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutList className="w-5 h-5 text-primary" />
                        Detalle por Compañía
                        {filters.compania.length > 0 && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Filtrado BI</span>}
                    </h3>
                    <span className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                        {sortedData.length} registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th onClick={() => handleSort('company')} className="p-4 font-bold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center">Compañía <SortIcon col="company" /></div>
                                </th>
                                <th onClick={() => handleSort('primas')} className="p-4 font-bold text-slate-600 text-right cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-end">Primas <SortIcon col="primas" /></div>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="p-4 font-bold text-slate-600 text-right cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-end">Pólizas <SortIcon col="polizas" /></div>
                                </th>
                                <th onClick={() => handleSort('ticketMedio')} className="p-4 font-bold text-slate-600 text-right cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-end">Ticket Medio <SortIcon col="ticketMedio" /></div>
                                </th>
                                <th onClick={() => handleSort('numAsesores')} className="p-4 font-bold text-slate-600 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-center">Comerciales <SortIcon col="numAsesores" /></div>
                                </th>
                                <th onClick={() => handleSort('numEntes')} className="p-4 font-bold text-slate-600 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center justify-center">Entes <SortIcon col="numEntes" /></div>
                                </th>
                                <th className="p-4 pr-6 font-bold text-slate-600 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedData.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron datos</td></tr>
                            ) : (
                                sortedData.map((d, i) => {
                                    const totalPrimas = metrics.primasNP || 1;
                                    const totalPolizas = metrics.numPolizas || 1;
                                    const isSelected = filters.compania.includes(d.company);
                                    return (
                                        <tr key={i} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${isSelected ? 'bg-primary/5 font-bold' : ''}`} onClick={() => toggleInteractiveSelection(d.company)}>
                                            <td className="p-4 font-medium text-slate-900">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center font-bold text-xs`}>
                                                        {d.company.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    {d.company}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="font-bold text-indigo-600">{currencyFormatter.format(d.primas)}</div>
                                                <div className="text-[10px] text-slate-400">{(d.primas * 100 / totalPrimas).toFixed(1)}% del total</div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="font-semibold text-slate-700">{numberFormatter.format(d.polizas)}</div>
                                                <div className="text-[10px] text-slate-400">{(d.polizas * 100 / totalPolizas).toFixed(1)}% del total</div>
                                            </td>
                                            <td className="p-4 text-right text-slate-600">{currencyFormatter.format(d.ticketMedio)}</td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{d.numAsesores}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">{d.numEntes}</span>
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.location.href = `/polizas/listado?${getFilterParams(d.company)}`;
                                                }} className="p-1.5 text-primary hover:text-white hover:bg-primary transition-all rounded-lg border border-slate-200 shadow-sm inline-flex">
                                                    <TrendingUp className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
