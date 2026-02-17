"use client";

import { useEffect, useState, useMemo } from 'react';
import { Hourglass, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Printer, BarChart2, TrendingUp, Info, Clock, Award, Rocket } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import * as XLSX from 'xlsx';

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface TenureBreakdownItem {
    label: string;
    primas: number;
    polizas: number;
    numEntes: number;
    avgPrimas: number;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

export default function CicloVidaPage() {
    const [breakdown, setBreakdown] = useState<TenureBreakdownItem[]>([]);
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

    const [selectedTenure, setSelectedTenure] = useState<string | null>(null);

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
            setBreakdown(data.tenureBreakdown || []);
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
        setSelectedTenure(null);
    };

    const handleExportExcel = () => {
        const dataToExport = breakdown.map(item => ({
            'Antigüedad': item.label,
            'Nº Entes': item.numEntes,
            'Total Primas (€)': item.primas,
            'Nº Pólizas': item.polizas,
            'Rentabilidad Media/Ente (€)': item.avgPrimas
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ciclo_Vida");
        XLSX.writeFile(wb, `Ciclo_Vida_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    // KPI Calculations for Tenure Maturity
    const metrics = useMemo(() => {
        const newEntes = breakdown.find(b => b.label.includes('Año 0'))?.avgPrimas || 0;
        const seniorEntes = breakdown.find(b => b.label.includes('Año 3+'))?.avgPrimas || 0;
        const maturityMultipler = newEntes > 0 ? (seniorEntes / newEntes).toFixed(1) : "N/A";

        return {
            newEntesAvg: newEntes,
            seniorEntesAvg: seniorEntes,
            maturityMultipler
        };
    }, [breakdown]);

    const MaturityChart = ({ data }: { data: TenureBreakdownItem[] }) => {
        const maxAvg = Math.max(...data.map(d => d.avgPrimas), 1);

        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Curva de Maduración Comercial (Primas Media por Ente)
                </h4>
                <div className="flex items-end justify-between h-64 gap-4 px-4">
                    {data.map((item, idx) => {
                        const height = (item.avgPrimas / maxAvg) * 100;
                        const isSelected = selectedTenure === item.label;
                        return (
                            <div
                                key={idx}
                                className="flex-1 flex flex-col items-center group cursor-pointer"
                                onClick={() => setSelectedTenure(isSelected ? null : item.label)}
                            >
                                <div className="w-full relative flex flex-col items-center">
                                    <div className={`absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-md font-bold z-10 whitespace-nowrap`}>
                                        {currencyFormatter.format(item.avgPrimas)}
                                    </div>
                                    <div
                                        className={`w-full max-w-[80px] rounded-t-xl transition-all duration-1000 ease-out border-b-4 border-primary/20 ${isSelected ? 'bg-primary ring-4 ring-primary/10' : 'bg-primary/60 group-hover:bg-primary/80'
                                            }`}
                                        style={{ height: `${height}%` }}
                                    ></div>
                                </div>
                                <div className={`mt-4 text-[11px] font-bold text-center ${isSelected ? 'text-primary' : 'text-slate-500'}`}>
                                    {item.label}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium">
                                    {item.numEntes} Entes
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Printable Logo */}
            <div className="hidden print:block mb-6">
                <img src="/logo.png" alt="Grupo Data Logo" className="h-16 w-auto" />
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Ciclo de Vida del Ente</h1>
                    <p className="mt-2 text-slate-600">Análisis de rentabilidad y evolución según la antigüedad de la Agencia / Ente</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors shadow-sm">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Maturity Curve KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Rocket className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Producción Inicial</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                        {currencyFormatter.format(metrics.newEntesAvg)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">AÑO 0 (NUEVOS)</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center">
                            <Award className="w-5 h-5 text-yellow-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Producción Senior</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                        {currencyFormatter.format(metrics.seniorEntesAvg)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">AÑO 3 O MÁS</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-br from-white to-primary/5 border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Factor de Crecimiento</span>
                    </div>
                    <div className="text-3xl font-black text-primary">
                        x{metrics.maturityMultipler}
                    </div>
                    <div className="mt-1 text-[10px] text-primary/60 font-bold uppercase tracking-widest">MULTIPLIER DE RENTABILIDAD</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3>Afinar Análisis de Maduración</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Asesor" options={filterOptions.asesores} selected={filters.comercial} onChange={(v) => handleFilterChange('comercial', v)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(v) => handleFilterChange('ente', v)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(v) => handleFilterChange('anio', v)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(v) => handleFilterChange('mes', v)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(v) => handleFilterChange('estado', v)} />
                </div>
            </div>

            {/* Maturity Chart */}
            {!loading && <MaturityChart data={breakdown} />}

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                        <Clock className="w-5 h-5 text-primary" />
                        Desglose de Cartera por Antigüedad
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Segmento</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Nº Entes</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Nº Pólizas</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Total Primas (€)</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-primary uppercase">Rentabilidad Media (€)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                [...Array(4)].map((_, i) => <tr key={i}><td colSpan={5} className="px-6 py-4 animate-pulse bg-slate-50/50 h-12"></td></tr>)
                            ) : breakdown.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${selectedTenure === item.label ? 'bg-primary/5 font-bold' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.label}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{item.numEntes}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{numberFormatter.format(item.polizas)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-mono">{currencyFormatter.format(item.primas).replace(",00", "")}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-black font-mono bg-primary/5">
                                        {currencyFormatter.format(item.avgPrimas)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 no-print">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Nota sobre la maduración:</p>
                    <p>El **Factor de Crecimiento** indica cuántas veces más rentable es un **Ente "Senior"** frente a uno recién incorporado. Un factor bajo puede indicar que los nuevos están entrando con mucha fuerza, mientras que un factor alto demuestra que la consolidación del Ente multiplica significativamente el negocio a largo plazo.</p>
                </div>
            </div>
        </div>
    );
}
