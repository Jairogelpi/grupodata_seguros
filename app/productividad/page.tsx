"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, MousePointer2, XCircle } from 'lucide-react';
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

interface AsesorBreakdownItem {
    asesor: string;
    numEntes: number;
    totalPrimas: number;
    numPolizas: number;
    avgPrimas: number;
}

interface EnteBreakdownItem {
    ente: string;
    primas: number;
    polizas: number;
    asesor: string;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

type SortKey = 'asesor' | 'numEntes' | 'totalPrimas' | 'avgPrimas' | 'ente' | 'primas' | 'polizas';

export default function ProductividadPage() {
    const router = useRouter();
    const [asesorBreakdown, setAsesorBreakdown] = useState<AsesorBreakdownItem[]>([]);
    const [enteBreakdown, setEnteBreakdown] = useState<EnteBreakdownItem[]>([]);
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

    // Interactive selections (Power BI style)
    const [interactiveAsesor, setInteractiveAsesor] = useState<string | null>(null);
    const [interactiveEnte, setInteractiveEnte] = useState<string | null>(null);

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'totalPrimas',
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
            setAsesorBreakdown(data.asesoresBreakdown || []);
            setEnteBreakdown(data.breakdown || []);
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
        // Clear interactive filters if manual filter changes significantly? 
        // Actually Power BI keeps them if possible, but let's clear sub-selections for clarity
        if (key === 'comercial') setInteractiveAsesor(null);
        if (key === 'ente') setInteractiveEnte(null);
    };

    // Filtered data based on interactive selection
    const filteredEnteData = useMemo(() => {
        let data = [...enteBreakdown];
        if (interactiveAsesor) {
            data = data.filter(item => item.asesor === interactiveAsesor);
        }
        if (interactiveEnte) {
            data = data.filter(item => item.ente === interactiveEnte);
        }
        return data;
    }, [enteBreakdown, interactiveAsesor, interactiveEnte]);

    const filteredAsesorData = useMemo(() => {
        let data = [...asesorBreakdown];
        if (interactiveAsesor) {
            data = data.filter(item => item.asesor === interactiveAsesor);
        }
        return data;
    }, [asesorBreakdown, interactiveAsesor]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAsesorData = [...filteredAsesorData].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (key === 'asesor') {
            return direction === 'asc' ? a.asesor.localeCompare(b.asesor) : b.asesor.localeCompare(a.asesor);
        }
        // @ts-ignore
        return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

    const sortedEnteData = [...filteredEnteData].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (key === 'ente') {
            return direction === 'asc' ? a.ente.localeCompare(b.ente) : b.ente.localeCompare(a.ente);
        }
        if (key === 'primas' || key === 'polizas') {
            return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
        }
        return 0;
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
    };

    const handleExportExcel = () => {
        // 1. Prepare Filter Summary rows
        const filterRows = [
            ['REPORTE DE PRODUCTIVIDAD'],
            ['Filtros Aplicados:', new Date().toLocaleString()],
            ['Asesor:', filters.comercial.length > 0 ? filters.comercial.join(', ') : 'Todos'],
            ['Ente:', filters.ente.length > 0 ? filters.ente.join(', ') : 'Todos'],
            ['Año:', filters.anio.length > 0 ? filters.anio.join(', ') : 'Todos'],
            ['Mes:', filters.mes.length > 0 ? filters.mes.join(', ') : 'Todos'],
            ['Estado:', filters.estado.length > 0 ? filters.estado.join(', ') : 'Todos'],
            [], // Empty row for spacing
        ];

        // 2. Prepare Data Table
        const dataToExport = sortedAsesorData.map(item => ({
            'Asesor': item.asesor,
            'Número de Entes': item.numEntes,
            'Nº Pólizas': item.numPolizas,
            'Producción Total (€)': item.totalPrimas,
            'Media por Ente (€)': item.avgPrimas
        }));

        // 3. Create Workbook and Worksheet
        const wb = XLSX.utils.book_new();
        // Create worksheet from filter rows first
        const ws = XLSX.utils.aoa_to_sheet(filterRows);

        // Add the JSON data starting after the filter rows
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: filterRows.length });

        // 4. Style (Optional: just column widths for better view)
        ws['!cols'] = [
            { wch: 30 }, // Asesor
            { wch: 15 }, // Nº Entes
            { wch: 15 }, // Nº Pólizas
            { wch: 20 }, // Total
            { wch: 20 }  // Media
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Productividad");
        XLSX.writeFile(wb, `Productividad_Interactiva_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const clearInteractive = () => {
        setInteractiveAsesor(null);
        setInteractiveEnte(null);
    };

    // Simple Interactive Bar Chart Component
    const BarChart = ({
        data,
        dataKey,
        label,
        color = "bg-primary",
        nameKey,
        selection,
        onSelect
    }: {
        data: any[],
        dataKey: string,
        label: string,
        color?: string,
        nameKey: string,
        selection: string | null,
        onSelect: (val: string | null) => void
    }) => {
        const maxVal = Math.max(...data.map(d => d[dataKey]), 1);

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col break-inside-avoid">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-primary" />
                        {label}
                    </h4>
                    {selection && (
                        <button onClick={() => onSelect(null)} className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold no-print">
                            <XCircle className="w-3 h-3" /> BORRAR SELECCIÓN
                        </button>
                    )}
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                    {data.slice(0, 15).map((item, idx) => {
                        const isSelected = selection === item[nameKey];
                        const isAnySelected = selection !== null;

                        return (
                            <div
                                key={idx}
                                className={`space-y-1 cursor-pointer group transition-all p-1 rounded-md ${isSelected ? 'bg-primary/5 ring-1 ring-primary/20 scale-[1.02]' : isAnySelected ? 'opacity-40 grayscale-[0.5]' : 'hover:bg-slate-50'
                                    }`}
                                onClick={() => onSelect(isSelected ? null : item[nameKey])}
                            >
                                <div className="flex justify-between text-[11px] font-medium">
                                    <span className={`truncate max-w-[180px] ${isSelected ? 'text-primary font-bold' : 'text-slate-700'}`}>
                                        {item[nameKey]}
                                    </span>
                                    <span className={`font-bold ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                                        {dataKey === 'totalPrimas' || dataKey === 'primas' || dataKey === 'avgPrimas'
                                            ? currencyFormatter.format(item[dataKey]).replace(",00", "")
                                            : item[dataKey]}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`${isSelected ? 'bg-primary' : color} h-full rounded-full transition-all duration-700 ease-out`}
                                        style={{ width: `${(item[dataKey] / maxVal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                    {data.length === 0 && <div className="text-center py-10 text-slate-400 italic text-sm">No hay datos suficientes</div>}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-[10px] text-slate-400 font-medium no-print">
                    <MousePointer2 className="w-3 h-3" />
                    HAZ CLIC EN UNA BARRA PARA FILTRAR
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Printable Logo (hidden on screen) */}


            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Análisis Interactivo de Productividad</h1>
                    <p className="mt-2 text-slate-600">Interactúa con los gráficos para profundizar en el rendimiento de Asesores y Entes</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    {(interactiveAsesor || interactiveEnte) && (
                        <button
                            onClick={clearInteractive}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg hover:bg-red-100 transition-colors font-bold shadow-sm text-sm"
                        >
                            <XCircle className="w-4 h-4" />
                            Limpiar Selección
                        </button>
                    )}
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

            {/* Interactive Charts Section */}
            {!loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <BarChart
                        data={[...asesorBreakdown].sort((a, b) => b.totalPrimas - a.totalPrimas)}
                        dataKey="totalPrimas"
                        nameKey="asesor"
                        label="Producción Total por Asesor"
                        color="bg-primary/60"
                        selection={interactiveAsesor}
                        onSelect={setInteractiveAsesor}
                    />
                    <BarChart
                        // Show all entes if no asesor selected, or filtered entes if selected
                        data={[...filteredEnteData].sort((a, b) => b.primas - a.primas)}
                        dataKey="primas"
                        nameKey="ente"
                        label={interactiveAsesor ? `Entes vinculados a: ${interactiveAsesor}` : "Top Entes por Producción"}
                        color="bg-slate-400 group-hover:bg-primary/80"
                        selection={interactiveEnte}
                        onSelect={setInteractiveEnte}
                    />
                </div>
            )}

            {/* Details Section (Power BI style split) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Asesor Table */}
                <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-slate-800">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Rendimiento de Asesores
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-white border-b-2 border-primary/5">
                                <tr>
                                    <th onClick={() => handleSort('asesor')} className="px-6 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                                        Asesor <SortIcon col="asesor" />
                                    </th>
                                    <th onClick={() => handleSort('numEntes')} className="px-6 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                                        Nº Entes <SortIcon col="numEntes" />
                                    </th>
                                    <th onClick={() => handleSort('totalPrimas')} className="px-6 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                                        Total (€) <SortIcon col="totalPrimas" />
                                    </th>
                                    <th onClick={() => handleSort('avgPrimas')} className="px-6 py-3 text-right text-[11px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                                        Media/Ente <SortIcon col="avgPrimas" />
                                    </th>
                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest no-print">
                                        Acción
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-4 text-center animate-pulse text-slate-400">Cargando datos...</td></tr>
                                ) : sortedAsesorData.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-primary/5 transition-colors cursor-pointer ${interactiveAsesor === item.asesor ? 'bg-primary/10 ring-inset ring-1 ring-primary/20' : ''}`}
                                        onClick={() => setInteractiveAsesor(interactiveAsesor === item.asesor ? null : item.asesor)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.asesor}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{item.numEntes}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold font-mono">{currencyFormatter.format(item.totalPrimas)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right font-mono">{currencyFormatter.format(item.avgPrimas)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center no-print">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/comerciales/evolucion?asesor=${encodeURIComponent(item.asesor)}`);
                                                }}
                                                className="p-2 hover:bg-white rounded-lg text-primary transition-all hover:shadow-md border border-transparent hover:border-slate-100"
                                                title="Ver Evolución Asesor"
                                            >
                                                <TrendingUp className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Ente Detail Side Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:overflow-visible break-inside-avoid">
                    <div className="px-4 py-4 border-b border-slate-200 bg-slate-50 text-slate-800">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            Productividad por Ente
                        </h3>
                    </div>
                    <div className="h-[500px] overflow-y-auto custom-scrollbar print:h-auto print:overflow-visible">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-white border-b-2 border-primary/5 sticky top-0 print:static">
                                <tr>
                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ente</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-primary uppercase tracking-wider">Ticket M.</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primas</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {sortedEnteData.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-slate-50 cursor-pointer ${interactiveEnte === item.ente ? 'bg-primary/5 font-bold' : ''}`}
                                        onClick={() => router.push(`/entes/evolucion?ente=${encodeURIComponent(item.ente)}`)}
                                    >
                                        <td className="px-4 py-3 text-[11px] text-slate-700 leading-tight">
                                            <div className="hover:text-primary transition-colors hover:underline">
                                                {item.ente}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-normal uppercase">{item.asesor}</div>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-primary text-right font-bold font-mono">
                                            {/* @ts-ignore */}
                                            {currencyFormatter.format(item.ticketMedio || 0).replace(",00", "")}
                                        </td>
                                        <td className="px-4 py-3 text-[9px] text-slate-400 text-right font-mono">
                                            {currencyFormatter.format(item.primas).replace(",00", "")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
