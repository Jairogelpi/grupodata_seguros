"use client";

import { useEffect, useState } from 'react';
import { PieChart, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, Package } from 'lucide-react';
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

interface ProductBreakdownItem {
    producto: string;
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

type SortKey = 'producto' | 'primas' | 'polizas';

export default function CarteraPage() {
    const [breakdown, setBreakdown] = useState<ProductBreakdownItem[]>([]);
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
            setBreakdown(data.productosBreakdown || []);
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
        if (key === 'producto') {
            return direction === 'asc' ? a.producto.localeCompare(b.producto) : b.producto.localeCompare(a.producto);
        }
        return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
    };

    const handleExportExcel = () => {
        // 1. Prepare Filter Summary rows
        const filterRows = [
            ['REPORTE DE CARTERA POR PRODUCTO'],
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
            'Producto/Ramo': item.producto,
            'Nº Pólizas': item.polizas,
            'Primas Totales (€)': item.primas
        }));

        // 3. Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filterRows);
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: filterRows.length });

        // Widths
        ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, "Cartera");
        XLSX.writeFile(wb, `Cartera_GrupoData_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const BarChart = ({ data, dataKey, label, color = "bg-primary" }: { data: any[], dataKey: string, label: string, color?: string }) => {
        const total = data.reduce((sum, d) => sum + d[dataKey], 0);
        const maxVal = Math.max(...data.map(d => d[dataKey]), 1);

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    {label}
                </h4>
                <div className="space-y-4">
                    {data.slice(0, 10).map((item, idx) => {
                        const percentage = ((item[dataKey] / total) * 100).toFixed(1);
                        return (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-700 truncate max-w-[200px]">{item.producto}</span>
                                    <span className="text-slate-900 font-bold">
                                        {dataKey === 'primas'
                                            ? currencyFormatter.format(item[dataKey]).replace(",00", "")
                                            : item[dataKey]}
                                        <span className="ml-1 text-slate-400 font-normal">({percentage}%)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`${color} h-full rounded-full transition-all duration-1000 ease-out`}
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
                    <h1 className="text-3xl font-bold text-slate-900">Salud de la Cartera</h1>
                    <p className="mt-2 text-slate-600">Distribución de producción por Ramo y Producto</p>
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
                        data={breakdown.sort((a, b) => b.primas - a.primas)}
                        dataKey="primas"
                        label="Distribución por Volumen de Primas (€)"
                        color="bg-primary"
                    />
                    <BarChart
                        data={breakdown.sort((a, b) => b.polizas - a.polizas)}
                        dataKey="polizas"
                        label="Distribución por Número de Pólizas"
                        color="bg-primary/60"
                    />
                </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-slate-800">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Desglose por Producto
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th onClick={() => handleSort('producto')} className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center">Producto / Ramo <SortIcon col="producto" /></span>
                                </th>
                                <th onClick={() => handleSort('polizas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center justify-end">Nº Pólizas <SortIcon col="polizas" /></span>
                                </th>
                                <th onClick={() => handleSort('primas')} className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider cursor-pointer select-none">
                                    <span className="flex items-center justify-end">Total Primas (€) <SortIcon col="primas" /></span>
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
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-slate-100 rounded w-64 animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto animate-pulse"></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto animate-pulse"></div></td>
                                    </tr>
                                ))
                            ) : sortedData.length > 0 ? (
                                (() => {
                                    const totalPrimas = sortedData.reduce((sum, d) => sum + d.primas, 0);
                                    return sortedData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.producto}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{numberFormatter.format(item.polizas)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold font-mono">{currencyFormatter.format(item.primas)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right font-medium bg-slate-50/50">
                                                {((item.primas / (totalPrimas || 1)) * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ));
                                })()
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                                        <Info className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                        No hay datos de productos para los filtros seleccionados
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
