"use client";

import { useEffect, useState } from 'react';
import { Users, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import FileUploader from '@/components/FileUploader';
import * as XLSX from 'xlsx';

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface Metrics {
    primasNP: number;
    numPolizas: number;
    count: number;
    primasTrend: number;
    polizasTrend: number;
}

interface BreakdownItem {
    ente: string;
    primas: number;
    polizas: number;
    trendPrimas: number;
    trendPolizas: number;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

type SortKey = 'ente' | 'primas' | 'polizas' | 'trendPrimas' | 'trendPolizas';

export default function Dashboard() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
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
            setMetrics(data.metrics);
            setFilterOptions(data.filters);
            setBreakdown(data.breakdown || []);
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

    const sortedData = [...breakdown].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (key === 'ente') {
            return direction === 'asc' ? a.ente.localeCompare(b.ente) : b.ente.localeCompare(a.ente);
        }
        return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
    };

    const handleExportExcel = () => {
        const dataToExport = sortedData.map(item => ({
            'Ente Comercial': item.ente,
            'Primas NP (€)': item.primas,
            'Tendencia Primas (%)': item.trendPrimas.toFixed(2),
            'Nº Pólizas': item.polizas,
            'Tendencia Pólizas (%)': item.trendPolizas.toFixed(2)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Desglose");
        XLSX.writeFile(wb, `Metricas_GrupoData_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const TrendBadge = ({ value }: { value: number }) => {
        if (!value && value !== 0) return null;
        const isPositive = value > 0;
        const isZero = value === 0;

        return (
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${isZero ? 'bg-slate-100 text-slate-600' : isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {isZero ? null : isPositive ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(value).toFixed(1)}%
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Printable Logo (hidden on screen) */}
            <div className="hidden print:block mb-6">
                <img src="/logo.png" alt="Grupo Data Logo" className="h-16 w-auto" />
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Panel de Control</h1>
                    <p className="mt-2 text-slate-600">Métricas de producción de Grupo Data</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium shadow-sm"
                    >
                        <FileDown className="w-4 h-4 text-green-600" />
                        Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        PDF
                    </button>
                    <FileUploader target="polizas" label="Subir Pólizas" onUploadSuccess={() => window.location.reload()} />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print filters-container">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3>Filtros Globales</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect
                        label="Comercial"
                        options={filterOptions.asesores}
                        selected={filters.comercial}
                        onChange={(val) => handleFilterChange('comercial', val)}
                    />
                    <MultiSelect
                        label="Ente"
                        options={filterOptions.entes}
                        selected={filters.ente}
                        onChange={(val) => handleFilterChange('ente', val)}
                    />
                    <MultiSelect
                        label="Año"
                        options={filterOptions.anios}
                        selected={filters.anio}
                        onChange={(val) => handleFilterChange('anio', val)}
                    />
                    <MultiSelect
                        label="Mes"
                        options={filterOptions.meses}
                        selected={filters.mes}
                        onChange={(val) => handleFilterChange('mes', val)}
                    />
                    <MultiSelect
                        label="Estado"
                        options={filterOptions.estados}
                        selected={filters.estado}
                        onChange={(val) => handleFilterChange('estado', val)}
                    />
                </div>
                {(filters.anio.length !== 1 || filters.mes.length !== 1) && (
                    <p className="mt-4 text-xs text-slate-400 italic">
                        Selecciona exactamente un Año y un Mes para ver el análisis de tendencia MoM.
                    </p>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primas NP Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-24 h-24 text-primary" />
                    </div>
                    <div className="flex justify-between items-start">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Primas NP</h3>
                        {!loading && metrics && (filters.anio.length === 1 && filters.mes.length === 1) && (
                            <TrendBadge value={metrics.primasTrend} />
                        )}
                    </div>
                    <div className="mt-2 flex items-baseline">
                        {loading ? (
                            <div className="h-10 w-32 bg-slate-200 animate-pulse rounded"></div>
                        ) : (
                            <span className="text-4xl font-extrabold text-primary">
                                {metrics ? currencyFormatter.format(metrics.primasNP) : '0,00 €'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Nº Polizas Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="w-24 h-24 text-slate-600" />
                    </div>
                    <div className="flex justify-between items-start">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Nº Pólizas</h3>
                        {!loading && metrics && (filters.anio.length === 1 && filters.mes.length === 1) && (
                            <TrendBadge value={metrics.polizasTrend} />
                        )}
                    </div>
                    <div className="mt-2 flex items-baseline">
                        {loading ? (
                            <div className="h-10 w-16 bg-slate-200 animate-pulse rounded"></div>
                        ) : (
                            <span className="text-4xl font-extrabold text-slate-900">
                                {metrics ? numberFormatter.format(metrics.numPolizas) : '0'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-800">Desglose por Ente Comercial</h3>
                    {(filters.anio.length === 1 && filters.mes.length === 1) && (
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Tendencia vs Mes Anterior</span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th onClick={() => handleSort('ente')} className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider cursor-pointer group select-none">
                                    <span className="flex items-center">Ente Comercial <SortIcon col="ente" /></span>
                                </th>
                                <th onClick={() => handleSort('primas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer group select-none">
                                    <span className="flex items-center justify-end">Primas NP (€) <SortIcon col="primas" /></span>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer group select-none">
                                    <span className="flex items-center justify-end">Nº Pólizas <SortIcon col="polizas" /></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-48 animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto animate-pulse"></div></td>
                                    </tr>
                                ))
                            ) : sortedData.length > 0 ? (
                                sortedData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.ente}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono">{currencyFormatter.format(item.primas)}</span>
                                                {(filters.anio.length === 1 && filters.mes.length === 1) && <TrendBadge value={item.trendPrimas} />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono">{numberFormatter.format(item.polizas)}</span>
                                                {(filters.anio.length === 1 && filters.mes.length === 1) && <TrendBadge value={item.trendPolizas} />}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">
                                        No hay datos para mostrar con los filtros seleccionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && sortedData.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-right">
                        Mostrando {sortedData.length} registros
                    </div>
                )}
            </div>

        </div>
    );
}
