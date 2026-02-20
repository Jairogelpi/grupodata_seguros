'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, LayoutList, FileDown, Printer, ChevronRight } from 'lucide-react';
import FileUploader from '@/components/FileUploader';
import MultiSelect from '@/components/MultiSelect';
import PrintFilterSummary from '@/components/PrintFilterSummary';
import * as XLSX from 'xlsx';

interface Ente {
    Código: string | number;
    Nombre: string;
    Tipo: string;
    Año1: string | number;
}

export default function EntesPage() {
    const [entes, setEntes] = useState<Ente[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        Código: '',
        Nombre: '',
        Tipo: '',
        Año1: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [showAllRanking, setShowAllRanking] = useState(false);

    const [filters, setFilters] = useState({
        comercial: [] as string[],
        ente: [] as string[],
        anio: [] as string[],
        mes: [] as string[],
        estado: [] as string[]
    });

    const [filterOptions, setFilterOptions] = useState<any>({
        anios: [], meses: [], estados: [], asesores: [], entes: []
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [efficiencyRanking, setEfficiencyRanking] = useState<any[]>([]);
    const [rankingLoading, setRankingLoading] = useState(false);

    const fetchEfficiencyRanking = async () => {
        setRankingLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.comercial.length > 0) params.append('comercial', filters.comercial.join(','));
            if (filters.ente.length > 0) params.append('ente', filters.ente.join(','));
            if (filters.anio.length > 0) params.append('anio', filters.anio.join(','));
            if (filters.mes.length > 0) params.append('mes', filters.mes.join(','));
            if (filters.estado.length > 0) params.append('estado', filters.estado.join(','));

            const res = await fetch(`/api/metrics?${params.toString()}`);
            const data = await res.json();
            setFilterOptions(data.filters);
            if (data.breakdown) {
                const ranked = data.breakdown
                    .filter((i: any) => i.polizas > 0)
                    .sort((a: any, b: any) => b.ticketMedio - a.ticketMedio);
                setEfficiencyRanking(ranked);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRankingLoading(false);
        }
    };

    const fetchEntes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/entes');
            const data = await res.json();
            if (Array.isArray(data)) {
                setEntes(data);
            }
        } catch (error) {
            console.error('Failed to fetch entes', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntes();
    }, []);

    useEffect(() => {
        fetchEfficiencyRanking();
    }, [filters]);

    const handleFilterChange = (key: keyof typeof filters, selected: string[]) => {
        setFilters(prev => ({ ...prev, [key]: selected }));
    };

    const handleExportExcel = () => {
        // 1. Prepare Filter Summary rows
        const filterRows = [
            ['GESTIÓN DE ENTES Y RANKING DE EFICIENCIA'],
            ['Filtros Aplicados:', new Date().toLocaleString()],
            ['Asesor:', filters.comercial.length > 0 ? filters.comercial.join(', ') : 'Todos'],
            ['Ente:', filters.ente.length > 0 ? filters.ente.join(', ') : 'Todos'],
            ['Año:', filters.anio.length > 0 ? filters.anio.join(', ') : 'Todos'],
            ['Mes:', filters.mes.length > 0 ? filters.mes.join(', ') : 'Todos'],
            ['Estado:', filters.estado.length > 0 ? filters.estado.join(', ') : 'Todos'],
            [], // Empty row
        ];

        // 2. Prepare Data (Ranking)
        const dataToExport = efficiencyRanking.map(item => ({
            'Ente Comercial': item.ente,
            'Asesor': item.asesor,
            'Primas Totales (€)': item.primas,
            'Nº Pólizas': item.polizas,
            'Ticket Medio (€)': item.ticketMedio
        }));

        // 3. Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filterRows);
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: filterRows.length });

        // Widths
        ws['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, "Ranking_Eficiencia");
        XLSX.writeFile(wb, `Entes_Ranking_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => window.print();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/entes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setFormData({ Código: '', Nombre: '', Tipo: '', Año1: '' });
                fetchEntes();
                fetchEfficiencyRanking();
            } else {
                alert('Error al guardar');
            }
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredEntes = entes.filter(ente =>
        String(ente.Nombre).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(ente.Código).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="hidden print:block mb-6">
                <img src="/logo.png" alt="Grupo Data Logo" className="h-16 w-auto" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestión de Entes</h1>
                    <p className="text-slate-500">Consulta el ranking de eficiencia y gestiona tus colaboradores</p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors shadow-sm">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                    <FileUploader target="entes" label="Importar Excel" onUploadSuccess={() => window.location.reload()} />
                </div>
            </div>

            {/* Global Filters for Analysis */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b pb-2">
                    <LayoutList className="w-5 h-5 text-primary" />
                    <h3>Filtros para Ranking de Eficiencia</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MultiSelect label="Comercial" options={filterOptions.asesores} selected={filters.comercial} onChange={(v) => handleFilterChange('comercial', v)} />
                    <MultiSelect label="Ente" options={filterOptions.entes} selected={filters.ente} onChange={(v) => handleFilterChange('ente', v)} />
                    <MultiSelect label="Año" options={filterOptions.anios} selected={filters.anio} onChange={(v) => handleFilterChange('anio', v)} />
                    <MultiSelect label="Mes" options={filterOptions.meses} selected={filters.mes} onChange={(v) => handleFilterChange('mes', v)} />
                    <MultiSelect label="Estado" options={filterOptions.estados} selected={filters.estado} onChange={(v) => handleFilterChange('estado', v)} />
                </div>
            </div>

            {/* Add Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Nuevo Ente
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            value={formData.Código}
                            onChange={e => setFormData({ ...formData, Código: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            value={formData.Nombre}
                            onChange={e => setFormData({ ...formData, Nombre: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            value={formData.Tipo}
                            onChange={e => setFormData({ ...formData, Tipo: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            value={formData.Año1}
                            onChange={e => setFormData({ ...formData, Año1: e.target.value })}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
                        >
                            {submitting ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Efficiency Ranking - NEW */}
            <div className="bg-white p-6 rounded-xl shadow-md border-2 border-primary/20 bg-gradient-to-br from-white to-primary/5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-2xl">⭐</span>
                            Ranking de "Entes Estrella" (Eficiencia)
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Ordenados por **Ticket Medio** (Primas por Póliza). Identifica quién trae las pólizas de mayor valor.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {rankingLoading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>
                        ))
                    ) : efficiencyRanking.length > 0 ? (
                        <>
                            {(showAllRanking ? efficiencyRanking : efficiencyRanking.slice(0, 3)).map((item: any, idx: number) => (
                                <div key={idx} className="relative overflow-hidden bg-white p-5 rounded-2xl border border-primary/10 shadow-sm hover:shadow-md transition-all group">
                                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors"></div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700 shadow-sm ring-1 ring-yellow-200' :
                                            idx === 1 ? 'bg-slate-100 text-slate-600 shadow-sm ring-1 ring-slate-200' :
                                                idx === 2 ? 'bg-orange-100 text-orange-700 shadow-sm ring-1 ring-orange-200' :
                                                    'bg-slate-50 text-slate-400 border border-slate-100'
                                            }`}>
                                            {idx + 1}
                                        </div>
                                        <h3 className="font-bold text-slate-800 truncate">
                                            <Link
                                                href={`/entes/evolucion?ente=${encodeURIComponent(item.ente)}`}
                                                className="text-indigo-600 hover:text-indigo-900 hover:underline decoration-indigo-200 underline-offset-4 transition-all"
                                            >
                                                {item.ente}
                                            </Link>
                                        </h3>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ticket Medio</div>
                                        <div className="text-xl font-black text-primary">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.ticketMedio)}
                                        </div>
                                        <div className="flex justify-between items-center mt-2 text-[11px] text-slate-500 border-t pt-2">
                                            <span>Total: <b className="text-slate-700">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.primas).replace(",00", "")}</b></span>
                                            <span>Pólizas: <b className="text-slate-700">{item.polizas}</b></span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!showAllRanking && efficiencyRanking.length > 3 && (
                                <div className="md:col-span-3 xl:col-span-4 flex justify-center mt-2">
                                    <button
                                        onClick={() => setShowAllRanking(true)}
                                        className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-2 bg-primary/5 px-6 py-2 rounded-full border border-primary/10 hover:bg-primary/10 transition-all"
                                    >
                                        Ver Ranking Completo ({efficiencyRanking.length} entes)
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {showAllRanking && (
                                <div className="md:col-span-3 xl:col-span-4 flex justify-center mt-4">
                                    <button
                                        onClick={() => setShowAllRanking(false)}
                                        className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                    >
                                        Mostrar menos
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="col-span-1 md:col-span-3 xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-4 border border-primary/10">
                                <Search className="w-8 h-8 text-primary/40" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Explora tu red de colaboradores</h3>
                            <p className="text-slate-500 max-w-md">Para ver el Ranking de Eficiencia, utiliza los **Filtros de Análisis** superiores para seleccionar un año, mes o grupo de asesores específico.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Only: Filter Summary */}
            <PrintFilterSummary filters={filters} />

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="font-semibold text-slate-800">Listado de Entes</h2>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar ente..."
                            className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-slate-500">{filteredEntes.length} registros</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3">Código</th>
                                <th className="px-6 py-3">Nombre</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3">Año</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEntes.map((ente, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-900">{ente.Código}</td>
                                    <td className="px-6 py-3">{ente.Nombre}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                            {ente.Tipo || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-500">{ente.Año1}</td>
                                </tr>
                            ))}
                            {filteredEntes.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                        No se encontraron datos.
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
