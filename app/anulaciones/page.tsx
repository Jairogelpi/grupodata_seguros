"use client";

import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, FileText, LayoutList, BarChart2, TrendingDown, Info, Clock, AlertCircle, Ban, UserX } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import * as XLSX from 'xlsx';

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

// Formatter for numbers
const numberFormatter = new Intl.NumberFormat('es-ES');

interface CancellationReason {
    reason: string;
    count: number;
}

interface EnteBreakdownItem {
    ente: string;
    primas: number;
    polizas: number;
    asesor: string;
    anulaciones: number;
}

interface FilterOptions {
    anios: string[];
    meses: string[];
    estados: string[];
    asesores: string[];
    entes: string[];
}

export default function AnulacionesPage() {
    const [breakdown, setBreakdown] = useState<EnteBreakdownItem[]>([]);
    const [reasons, setReasons] = useState<CancellationReason[]>([]);
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
            setBreakdown(data.breakdown || []);
            setReasons(data.cancellationReasons || []);
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

    const topEntesByAnulaciones = useMemo(() => {
        return [...breakdown]
            .filter(b => b.anulaciones > 0)
            .sort((a, b) => b.anulaciones - a.anulaciones)
            .slice(0, 10);
    }, [breakdown]);

    const totalAnulaciones = useMemo(() => {
        return reasons.reduce((sum, r) => sum + r.count, 0);
    }, [reasons]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Análisis de Anulaciones</h1>
                    <p className="mt-2 text-slate-600">Control de bajas, motivos frecuentes y detección de fugas por Ente</p>
                </div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                            <Ban className="w-5 h-5 text-red-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Anulaciones</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                        {numberFormatter.format(totalAnulaciones)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">PÓLIZAS DADAS DE BAJA</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo Principal</span>
                    </div>
                    <div className="text-xl font-black text-slate-900 truncate">
                        {reasons[0]?.reason || "N/A"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">RAZÓN MÁS FRECUENTE</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                            <UserX className="w-5 h-5 text-slate-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ente Crítico</span>
                    </div>
                    <div className="text-xl font-black text-slate-900 truncate">
                        {topEntesByAnulaciones[0]?.ente || "N/A"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">MAYOR NÚMERO DE BAJAS</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3>Filtros de Análisis</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Asesor" options={filterOptions.asesores} selected={filters.comercial} onChange={(v) => handleFilterChange('comercial', v)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(v) => handleFilterChange('ente', v)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(v) => handleFilterChange('anio', v)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(v) => handleFilterChange('mes', v)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(v) => handleFilterChange('estado', v)} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Reasons Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Motivos de Anulación
                    </h3>
                    <div className="space-y-4">
                        {reasons.slice(0, 8).map((r, i) => {
                            const percent = (r.count / totalAnulaciones) * 100;
                            return (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-700 truncate max-w-[250px]">{r.reason}</span>
                                        <span className="text-slate-500">{r.count} ({percent.toFixed(1)}%)</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 rounded-full"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {reasons.length === 0 && <div className="text-center py-8 text-slate-400">No hay datos de anulaciones</div>}
                    </div>
                </div>

                {/* Top Entes with Cancellations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                        Top 10 Entes por Anulaciones
                    </h3>
                    <div className="space-y-4">
                        {topEntesByAnulaciones.map((e, i) => {
                            const maxAnulaciones = topEntesByAnulaciones[0].anulaciones;
                            const percent = (e.anulaciones / maxAnulaciones) * 100;
                            return (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-700 truncate max-w-[250px]">{e.ente}</span>
                                        <span className="text-slate-500">{e.anulaciones} bajas</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {topEntesByAnulaciones.length === 0 && <div className="text-center py-8 text-slate-400">No hay datos de bajas</div>}
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 no-print">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Nota sobre las anulaciones:</p>
                    <p>Este informe extrae los datos de las pólizas que tienen informada una **Fecha de Anulación**. El análisis permite detectar si ciertos Entes tienen una tasa de bajas inusualmente alta, lo que podría indicar problemas en la calidad de la captación o falta de seguimiento del cliente.</p>
                </div>
            </div>
        </div>
    );
}
