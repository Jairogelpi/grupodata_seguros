"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, FileDown, Printer, FileText, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// Formatter for currency
const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

interface Poliza {
    poliza: string;
    estado: string;
    tomador: string;
    producto: string;
    fechaEfecto: string;
    fechaAnulacion: string;
    diasVida: number;
    dni: string;
    primas: number;
    cartera: number;
    compania: string;
    ente: string;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function PolizasContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const ente = searchParams.get('ente');
    const asesor = searchParams.get('asesor');
    const estado = searchParams.get('estado');
    const startYear = searchParams.get('startYear');
    const startMonth = searchParams.get('startMonth');
    const endYear = searchParams.get('endYear');
    const endMonth = searchParams.get('endMonth');
    const ramo = searchParams.get('ramo');
    const producto = searchParams.get('producto');
    const anio = searchParams.get('anio');
    const mes = searchParams.get('mes');

    const [polizas, setPolizas] = useState<Poliza[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Poliza; direction: 'asc' | 'desc' }>({
        key: 'primas',
        direction: 'desc'
    });

    useEffect(() => {
        fetchPolizas();
    }, [ente, asesor, estado, startYear, startMonth, endYear, endMonth, ramo, producto, anio, mes]);

    const fetchPolizas = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (ente) params.append('ente', ente);
            if (asesor) params.append('asesor', asesor);
            if (estado) params.append('estado', estado);
            if (startYear) params.append('startYear', startYear);
            if (startMonth) params.append('startMonth', startMonth);
            if (endYear) params.append('endYear', endYear);
            if (endMonth) params.append('endMonth', endMonth);
            if (ramo) params.append('ramo', ramo);
            if (producto) params.append('producto', producto);
            if (anio) params.append('anio', anio);
            if (mes) params.append('mes', mes);

            const res = await fetch(`/api/polizas/listado?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch polizas');
            const data = await res.json();
            setPolizas(data.polizas || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof Poliza) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        const filtered = polizas.filter(p => {
            const searchStr = `${p.poliza} ${p.tomador} ${p.dni} ${p.producto} ${p.ente}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });

        return [...filtered].sort((a, b) => {
            const { key, direction } = sortConfig;
            let valA = a[key];
            let valB = b[key];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }

            return 0;
        });
    }, [polizas, searchTerm, sortConfig]);

    const SortIcon = ({ col }: { col: keyof Poliza }) => {
        if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
    };

    const handleExportExcel = () => {
        const filterStr = [];
        if (ente) filterStr.push(`ENTE: ${ente.toUpperCase()}`);
        if (asesor) filterStr.push(`ASESOR: ${asesor.toUpperCase()}`);
        if (estado) filterStr.push(`ESTADO: ${estado}`);
        if (startYear && startMonth) filterStr.push(`DESDE: ${MONTHS[parseInt(startMonth) - 1].toUpperCase()} ${startYear}`);
        if (endYear && endMonth) filterStr.push(`HASTA: ${MONTHS[parseInt(endMonth) - 1].toUpperCase()} ${endYear}`);

        const filterSummary = filterStr.join(' | ');

        const titleRows = [
            ['GRUPO DATA SYSTEM'],
            ['LISTADO DETALLADO DE PÓLIZAS'],
            [filterSummary],
            ['FECHA RECURSO:', new Date().toLocaleString()],
            []
        ];

        const dataRows = sortedData.map(p => ({
            'PÓLIZA': p.poliza,
            'ESTADO': p.estado,
            'TOMADOR': p.tomador,
            'DNI/CIF': p.dni,
            'COMPAÑÍA': p.compania,
            'PRODUCTO': p.producto,
            'F. EFECTO': p.fechaEfecto,
            'F. ANULACIÓN': p.fechaAnulacion,
            'DÍAS VIDA': p.diasVida,
            'PRIMAS (€)': p.primas,
            'CARTERA (€)': p.cartera,
            'ENTE COMERCIAL': p.ente
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(titleRows);
        XLSX.utils.sheet_add_json(ws, dataRows, { origin: titleRows.length });

        // --- STYLING & STRUCTURE ---

        // Merges for titles
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // GRUPO DATA SYSTEM
            { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, // LISTADO DETALLADO DE PÓLIZAS
            { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } }, // FILTERS
        ];

        // Auto-filter for the data table
        const headerRowIndex = titleRows.length; // Headers are on this row
        const lastColChar = 'L'; // 12 columns (A-L)
        const lastRowIndex = titleRows.length + dataRows.length;
        ws['!autofilter'] = { ref: `A${headerRowIndex + 1}:${lastColChar}${lastRowIndex + 1}` };

        // Auto-width
        ws['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 },
            { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 35 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Pólizas");
        XLSX.writeFile(wb, `Listado_Polizas_${ente || asesor || 'General'}.xlsx`);
    };

    const getTitle = () => {
        let title = "Listado de Pólizas";
        if (estado === 'VIGOR') title = "Cartera Activa (En Vigor)";
        if (estado === 'SUSPENSION') title = "Pólizas en Suspensión";
        if (estado === 'ANULADA') title = "Pólizas Anuladas";
        return title;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{getTitle()}</h1>
                        <p className="text-slate-500 text-sm font-medium">
                            {ente || asesor}
                            {ramo && ` • Ramo: ${ramo}`}
                            {producto && ` • Producto: ${producto}`}
                            {anio && mes && ` • Periodo: ${MONTHS[parseInt(mes) - 1]} ${anio}`}
                            {startYear && startMonth && !anio && ` • ${MONTHS[parseInt(startMonth) - 1]} ${startYear} a ${MONTHS[parseInt(endMonth!) - 1]} ${endYear}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {(ente || asesor || estado || startYear || ramo || producto || anio) && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                router.push(`/polizas/listado`);
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all shadow-sm text-sm font-medium text-red-600"
                        >
                            <X className="w-4 h-4" /> Limpiar Filtros
                        </button>
                    )}
                    <button
                        onClick={handleExportExcel}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-medium"
                    >
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-600">
                        <LayoutList className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">
                            Mostrando {sortedData.length} pólizas
                        </span>
                    </div>
                    <div className="relative w-full md:w-96 no-print">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por póliza, tomador, DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th onClick={() => handleSort('poliza')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100">
                                    Póliza <SortIcon col="poliza" />
                                </th>
                                <th onClick={() => handleSort('tomador')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100">
                                    Tomador / DNI <SortIcon col="tomador" />
                                </th>
                                <th onClick={() => handleSort('producto')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100">
                                    Producto / Compañía <SortIcon col="producto" />
                                </th>
                                <th onClick={() => handleSort('fechaEfecto')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100">
                                    F. Efecto <SortIcon col="fechaEfecto" />
                                </th>
                                <th onClick={() => handleSort('diasVida')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100">
                                    Vida (Días) <SortIcon col="diasVida" />
                                </th>
                                <th onClick={() => handleSort('primas')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right cursor-pointer hover:bg-slate-100">
                                    Primas <SortIcon col="primas" />
                                </th>
                                <th onClick={() => handleSort('estado')} className="p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-center cursor-pointer hover:bg-slate-100">
                                    Estado <SortIcon col="estado" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="p-4"><div className="h-4 bg-slate-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : sortedData.length > 0 ? (
                                sortedData.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-900">{p.poliza}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-800 uppercase text-xs">{p.tomador}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{p.dni}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700 text-xs truncate max-w-[250px]">{p.producto}</div>
                                            <div className="text-[10px] text-indigo-600 font-bold mt-0.5">{p.compania}</div>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 font-mono">{p.fechaEfecto}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700 text-xs">{p.diasVida} días</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-primary">{currencyFormatter.format(p.primas)}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Prod.</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${p.estado.toUpperCase().includes('VIGOR') ? 'bg-emerald-100 text-emerald-700' :
                                                p.estado.toUpperCase().includes('SUSPENSI') ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {p.estado}
                                            </span>
                                            {p.fechaAnulacion && <div className="text-[9px] text-red-400 mt-1">{p.fechaAnulacion}</div>}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                        No se han encontrado pólizas que coincidan con el criterio.
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

export default function PolizasPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-slate-400">Cargando listado...</div>}>
            <PolizasContent />
        </Suspense>
    );
}
