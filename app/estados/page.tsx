"use client";

import { useEffect, useState, useMemo } from 'react';
import { Activity, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface EstadoBreakdownItem {
    estado: string;
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

type SortKey = 'estado' | 'primas' | 'polizas';

export default function EstadosPage() {
    const [breakdown, setBreakdown] = useState<EstadoBreakdownItem[]>([]);
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

    // Interactive selection
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'polizas',
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
            setBreakdown(data.estadosBreakdown || []);
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
        if (key === 'estado') setSelectedStatus(null);
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
        if (key === 'estado') {
            return direction === 'asc' ? a.estado.localeCompare(b.estado) : b.estado.localeCompare(a.estado);
        }
        return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
    };

    // KPI Calculations
    const kpis = useMemo(() => {
        const totalPolizas = breakdown.reduce((sum, d) => sum + d.polizas, 0);

        const vigor = breakdown.find(d => d.estado.toUpperCase().includes('VIGOR'))?.polizas || 0;
        const anuladas = breakdown.find(d => d.estado.toUpperCase().includes('ANULADA'))?.polizas || 0;
        const suspension = breakdown.find(d => d.estado.toUpperCase().includes('SUSPENS'))?.polizas || 0;

        return {
            totalPolizas,
            vigor,
            anuladas,
            suspension,
            vigorRate: totalPolizas > 0 ? (vigor / totalPolizas) * 100 : 0,
            cancellationRate: totalPolizas > 0 ? (anuladas / totalPolizas) * 100 : 0,
            suspensionRate: totalPolizas > 0 ? (suspension / totalPolizas) * 100 : 0,
        };
    }, [breakdown]);

    const handleExportExcel = () => {
        // 1. Prepare Filter Summary rows
        const filterRows = [
            ['REPORTE DE ESTADOS DE PÓLIZAS'],
            ['Filtros Aplicados:', new Date().toLocaleString()],
            ['Asesor:', filters.comercial.length > 0 ? filters.comercial.join(', ') : 'Todos'],
            ['Ente:', filters.ente.length > 0 ? filters.ente.join(', ') : 'Todos'],
            ['Año:', filters.anio.length > 0 ? filters.anio.join(', ') : 'Todos'],
            ['Mes:', filters.mes.length > 0 ? filters.mes.join(', ') : 'Todos'],
            ['Estado:', filters.estado.length > 0 ? filters.estado.join(', ') : 'Todos'],
            [], // Empty row
        ];

        // 2. Prepare Data
        const dataToExport = sortedData.map(item => ({
            'Estado de Póliza': item.estado,
            'Nº Pólizas': item.polizas,
            'Primas Totales (€)': item.primas
        }));

        // 3. Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filterRows);
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: filterRows.length });

        // Widths
        ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, "Estados");
        XLSX.writeFile(wb, `Estados_GrupoData_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const BarChart = ({ data, dataKey, label, color = "bg-primary" }: { data: any[], dataKey: string, label: string, color?: string }) => {
        const maxVal = Math.max(...data.map(d => d[dataKey]), 1);

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    {label}
                </h4>
                <div className="space-y-4">
                    {data.map((item, idx) => {
                        const isSelected = selectedStatus === item.estado;
                        const isAnySelected = selectedStatus !== null;

                        return (
                            <div
                                key={idx}
                                className={`space-y-1 cursor-pointer transition-all ${isAnySelected && !isSelected ? 'opacity-30 grayscale-[0.5]' : ''}`}
                                onClick={() => setSelectedStatus(isSelected ? null : item.estado)}
                            >
                                <div className="flex justify-between text-xs font-medium">
                                    <span className={`truncate max-w-[200px] ${isSelected ? 'text-primary font-bold' : 'text-slate-700'}`}>{item.estado}</span>
                                    <span className="text-slate-900 font-bold">
                                        {dataKey === 'primas'
                                            ? currencyFormatter.format(item[dataKey]).replace(",00", "")
                                            : numberFormatter.format(item[dataKey])}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`${isSelected ? 'bg-primary' : color} h-full rounded-full transition-all duration-1000 ease-out`}
                                        style={{ width: `${(item[dataKey] / maxVal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                    {data.length === 0 && <div className="text-center py-10 text-slate-400 italic text-sm">No hay datos suficientes</div>}
                </div>
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
                    <h1 className="text-3xl font-bold text-slate-900">Segmentación por Estado</h1>
                    <p className="mt-2 text-slate-600">Análisis de retención y ciclo de vida de las pólizas</p>
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
                </div>
            </div>

            {/* Main KPIs: En Vigor, Anulada, Suspensión de Garantías */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                        <ShieldCheck className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">En Vigor</div>
                    <div className="text-4xl font-extrabold text-slate-900">{numberFormatter.format(kpis.vigor)}</div>
                    <div className="mt-2 text-lg font-bold text-green-600">{kpis.vigorRate.toFixed(1)}%</div>
                    <div className="mt-1 text-[10px] text-slate-400 font-medium">DEL TOTAL DE PÓLIZAS</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                        <ShieldAlert className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Anuladas</div>
                    <div className="text-4xl font-extrabold text-slate-900">{numberFormatter.format(kpis.anuladas)}</div>
                    <div className="mt-2 text-lg font-bold text-red-600">{kpis.cancellationRate.toFixed(1)}%</div>
                    <div className="mt-1 text-[10px] text-slate-400 font-medium">DEL TOTAL DE PÓLIZAS</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Susp. Garantías</div>
                    <div className="text-4xl font-extrabold text-slate-900">{numberFormatter.format(kpis.suspension)}</div>
                    <div className="mt-2 text-lg font-bold text-amber-600">{kpis.suspensionRate.toFixed(1)}%</div>
                    <div className="mt-1 text-[10px] text-slate-400 font-medium">DEL TOTAL DE PÓLIZAS</div>
                </div>
            </div>

            {/* Print Only: Filter Summary */}
            <PrintFilterSummary filters={filters} />

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print filters-container">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3>Filtros de Análisis</h3>
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
            </div>

            {/* Charts Section */}
            {!loading && breakdown.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <BarChart
                        data={breakdown.sort((a, b) => b.polizas - a.polizas)}
                        dataKey="polizas"
                        label="Volumen de Pólizas por Estado"
                        color="bg-primary"
                    />
                    <BarChart
                        data={breakdown.sort((a, b) => b.primas - a.primas)}
                        dataKey="primas"
                        label="Distribución de Primas por Estado (€)"
                        color="bg-primary/60"
                    />
                </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-slate-800">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Desglose Detallado por Estado
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th onClick={() => handleSort('estado')} className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center">Estado <SortIcon col="estado" /></span>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center justify-end">Nº Pólizas <SortIcon col="polizas" /></span>
                                </th>
                                <th onClick={() => handleSort('primas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center justify-end">Primas Totales (€) <SortIcon col="primas" /></span>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider">
                                    % Peso
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-48 animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto animate-pulse"></div></td>
                                    </tr>
                                ))
                            ) : sortedData.length > 0 ? (
                                (() => {
                                    const totalPolizas = breakdown.reduce((sum, d) => sum + d.polizas, 0);
                                    return sortedData.map((item, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${selectedStatus === item.estado ? 'bg-primary/5 font-bold' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 uppercase">
                                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.estado.toLowerCase().includes('vigor') ? 'bg-green-500' :
                                                    item.estado.toLowerCase().includes('anulada') ? 'bg-red-500' : 'bg-slate-300'
                                                    }`}></span>
                                                {item.estado}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{numberFormatter.format(item.polizas)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold font-mono">{currencyFormatter.format(item.primas)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right font-medium bg-slate-50/50">
                                                {((item.polizas / (totalPolizas || 1)) * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ));
                                })()
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                                        <Info className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                        No hay datos de estados para los filtros seleccionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
