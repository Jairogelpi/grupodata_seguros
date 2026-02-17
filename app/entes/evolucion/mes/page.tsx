'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    FileText,
    FileDown,
    Printer,
    Search,
    Filter,
    Table as TableIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface PolicyDetail {
    poliza: string;
    fechaEfecto: string;
    producto: string;
    ramo: string;
    compania: string;
    primas: number;
    estado: string;
    tomador: string;
    dni: string;
}

function MonthlyDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ente = searchParams.get('ente');
    const anio = searchParams.get('anio');
    const mes = searchParams.get('mes');

    const [polizas, setPolizas] = useState<PolicyDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (ente && anio && mes) {
            fetchDetails();
        }
    }, [ente, anio, mes]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/entes/detalles?ente=${encodeURIComponent(ente!)}&anio=${anio}&mes=${mes}`);
            const json = await res.json();
            if (json.polizas) {
                setPolizas(json.polizas);
            }
        } catch (error) {
            console.error('Error fetching details', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPolizas = polizas.filter(p =>
        p.poliza.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tomador.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.compania.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExportExcel = () => {
        const title = [
            ['DETALLE DE PÓLIZAS'],
            [`Ente: ${ente}`],
            [`Periodo: ${MONTHS[parseInt(mes!) - 1]} ${anio}`],
            [`Total Pólizas: ${polizas.length}`],
            [`Total Primas: ${currencyFormatter.format(polizas.reduce((sum, p) => sum + p.primas, 0))}`],
            []
        ];

        const rows = polizas.map(p => ({
            'Póliza': p.poliza,
            'Tomador': p.tomador,
            'NIF': p.dni,
            'Fecha Efecto': p.fechaEfecto,
            'Producto': p.producto,
            'Ramo': p.ramo,
            'Compañía': p.compania,
            'Estado': p.estado,
            'Primas (€)': p.primas
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(title);
        XLSX.utils.sheet_add_json(ws, rows, { origin: title.length });

        // Column widths
        ws['!cols'] = [
            { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
            { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Detalle_Mensual");
        XLSX.writeFile(wb, `Detalle_${ente?.replace(/ /g, '_')}_${anio}_${mes}.xlsx`);
    };

    if (!ente || !anio || !mes) return <div className="p-8 text-center text-slate-500">Parámetros insuficientes</div>;

    const totalPrimas = filteredPolizas.reduce((sum, p) => sum + p.primas, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Volver a Evolución
                </button>
                <div className="flex gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-bold">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm text-sm font-bold">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Title Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <TableIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{ente}</h1>
                            <p className="text-slate-500 font-bold flex items-center gap-2">
                                <span className="text-indigo-600 underline decoration-indigo-200">{MONTHS[parseInt(mes) - 1]} {anio}</span>
                                <span className="text-slate-300">|</span>
                                <span>Detalle de Pólizas</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-8 px-8 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-1">Total Primas</div>
                            <div className="text-2xl font-black text-indigo-600">{currencyFormatter.format(totalPrimas)}</div>
                        </div>
                        <div className="border-l border-slate-200 hidden md:block" />
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-1">Nº Pólizas</div>
                            <div className="text-2xl font-black text-slate-900">{filteredPolizas.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por póliza, tomador o producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-lg border border-slate-100">
                        <Filter className="w-3.5 h-3.5 text-indigo-500" />
                        {filteredPolizas.length} registros encontrados
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Póliza</th>
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Tomador / NIF</th>
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">F. Efecto</th>
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Producto / Compañía</th>
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-right">Primas (€)</th>
                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="p-4"><div className="h-8 bg-slate-100 rounded-lg w-full" /></td>
                                    </tr>
                                ))
                            ) : filteredPolizas.length > 0 ? (
                                filteredPolizas.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4 font-bold text-slate-900">{p.poliza}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700">{p.tomador}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{p.dni}</div>
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium">{p.fechaEfecto}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700">{p.producto}</div>
                                            <div className="text-[10px] text-indigo-500 font-black uppercase tracking-wider">{p.compania}</div>
                                        </td>
                                        <td className="p-4 text-right font-black text-indigo-600">{currencyFormatter.format(p.primas)}</td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.estado.includes('Vigor') ? 'bg-green-100 text-green-700' :
                                                    p.estado.includes('Anulada') ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {p.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center">
                                        <div className="text-slate-400 font-medium">No se encontraron pólizas para este criterio</div>
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

export default function MonthlyDetailsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-slate-400 font-medium">Cargando Detalle Mensual...</div>}>
            <MonthlyDetailsContent />
        </Suspense>
    );
}
