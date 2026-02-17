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
    Info,
    PieChart,
    TrendingUp
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import MultiSelect from '@/components/MultiSelect';
import * as XLSX from 'xlsx';

// Register ChartJS
ChartJS.register(ArcElement, Tooltip, Legend);

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
        ente: [] as string[]
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
    }, [filters]);

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

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

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
        // Top 5 + Others
        const top5 = [...data].sort((a, b) => b.primas - a.primas).slice(0, 5);
        const others = [...data].sort((a, b) => b.primas - a.primas).slice(5);
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
                borderWidth: 0
            }]
        };
    }, [data]);

    const chartDataPolizas = useMemo(() => {
        // Top 5 + Others
        const top5 = [...data].sort((a, b) => b.polizas - a.polizas).slice(0, 5);
        const others = [...data].sort((a, b) => b.polizas - a.polizas).slice(5);
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
                borderWidth: 0
            }]
        };
    }, [data]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    font: { size: 11 }
                }
            }
        }
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data.map(d => ({
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-primary" />
                        Métricas por Compañía
                    </h1>
                    <p className="text-slate-500 mt-1">Análisis detallado por aseguradora y su rendimiento</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm">
                        <FileDown className="w-4 h-4" /> Exportar
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm">
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MultiSelect
                    label="Comercial"
                    options={options.asesores}
                    selected={filters.comercial}
                    onChange={(val) => handleFilterChange('comercial', val)}
                />
                <MultiSelect
                    label="Ente"
                    options={options.entes}
                    selected={filters.ente}
                    onChange={(val) => handleFilterChange('ente', val)}
                />
                <MultiSelect
                    label="Año"
                    options={options.anios}
                    selected={filters.anio}
                    onChange={(val) => handleFilterChange('anio', val)}
                />
                <MultiSelect
                    label="Mes"
                    options={options.meses}
                    selected={filters.mes}
                    onChange={(val) => handleFilterChange('mes', val)}
                />
                <MultiSelect
                    label="Estado"
                    options={options.estados}
                    selected={filters.estado}
                    onChange={(val) => handleFilterChange('estado', val)}
                />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Companies */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Building2 className="w-24 h-24 text-slate-900" />
                    </div>
                    <div className="relative">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Compañías Activas</div>
                        <div className="text-3xl font-black text-slate-900">{data.length}</div>
                        <div className="mt-2 text-xs text-slate-400 font-medium">En selección actual</div>
                    </div>
                </div>

                {/* Total Primas */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-24 h-24 text-indigo-600" />
                    </div>
                    <div className="relative">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Primas Totales</div>
                        <div className="text-3xl font-black text-indigo-600">{currencyFormatter.format(metrics.primasNP)}</div>
                        <div className="mt-2 text-xs text-slate-400 font-medium">Volumen de negocio</div>
                    </div>
                </div>

                {/* Total Polizas */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <FileText className="w-24 h-24 text-emerald-600" />
                    </div>
                    <div className="relative">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Pólizas Totales</div>
                        <div className="text-3xl font-black text-emerald-600">{numberFormatter.format(metrics.numPolizas)}</div>
                        <div className="mt-2 text-xs text-slate-400 font-medium">Contratos activos</div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-indigo-500" />
                        Distribución por Primas
                    </h3>
                    <div className="h-[300px] flex items-center justify-center">
                        {data.length > 0 ? (
                            <Doughnut data={chartDataPrimas} options={chartOptions} />
                        ) : (
                            <div className="text-slate-400 text-sm">Sin datos para mostrar</div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-emerald-500" />
                        Distribución por Pólizas
                    </h3>
                    <div className="h-[300px] flex items-center justify-center">
                        {data.length > 0 ? (
                            <Doughnut data={chartDataPolizas} options={chartOptions} />
                        ) : (
                            <div className="text-slate-400 text-sm">Sin datos para mostrar</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutList className="w-5 h-5 text-primary" />
                        Detalle por Compañía
                    </h3>
                    <span className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                        {data.length} registros
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No se encontraron datos con los filtros actuales
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((d, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                    {d.company.substring(0, 2).toUpperCase()}
                                                </div>
                                                {d.company}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-indigo-600 bg-indigo-50/10">
                                            {currencyFormatter.format(d.primas)}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-slate-700">
                                            {numberFormatter.format(d.polizas)}
                                        </td>
                                        <td className="p-4 text-right text-slate-600">
                                            {currencyFormatter.format(d.ticketMedio)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {d.numAsesores}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                {d.numEntes}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
