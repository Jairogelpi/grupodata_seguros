'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    TrendingUp,
    FileText,
    Calendar,
    FileDown,
    Printer,
    LayoutList,
    TrendingDown,
    BarChart3
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
});

const numberFormatter = new Intl.NumberFormat('es-ES');

interface EvolutionData {
    anio: number;
    mes: number;
    primas: number;
    polizas: number;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function EvolutionContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ente = searchParams.get('ente');

    const [data, setData] = useState<EvolutionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');

    // Filter states
    const [startPeriod, setStartPeriod] = useState({ year: 0, month: 1 });
    const [endPeriod, setEndPeriod] = useState({ year: 0, month: 12 });

    const [availableYears, setAvailableYears] = useState<number[]>([]);

    useEffect(() => {
        if (ente) {
            fetchEvolution();
        }
    }, [ente]);

    const fetchEvolution = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/entes/evolucion?ente=${encodeURIComponent(ente!)}`);
            const json = await res.json();
            if (json.evolution) {
                setData(json.evolution);
                const years = Array.from(new Set(json.evolution.map((d: any) => d.anio))) as number[];
                setAvailableYears(years.sort((a, b) => a - b));

                if (years.length > 0) {
                    setStartPeriod({ year: years[0], month: 1 });
                    setEndPeriod({ year: years[years.length - 1], month: 12 });
                }
            }
        } catch (error) {
            console.error('Error fetching evolution', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const startVal = startPeriod.year * 100 + startPeriod.month;
            const endVal = endPeriod.year * 100 + endPeriod.month;
            const currentVal = d.anio * 100 + d.mes;
            return currentVal >= startVal && currentVal <= endVal;
        });
    }, [data, startPeriod, endPeriod]);

    const chartData = useMemo(() => {
        const labels = filteredData.map(d => `${MONTHS[d.mes - 1]} ${d.anio}`);
        return {
            labels,
            datasets: [
                {
                    label: 'Primas (€)',
                    data: filteredData.map(d => d.primas),
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    fill: chartType === 'line',
                    yAxisID: 'y',
                    tension: 0.1
                },
                {
                    label: 'Nº Pólizas',
                    data: filteredData.map(d => d.polizas),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    fill: chartType === 'line',
                    yAxisID: 'y1',
                    tension: 0.1
                }
            ]
        };
    }, [filteredData, chartType]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' as const },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
            onClick: (event: any, elements: any) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const item = filteredData[index];
                    router.push(`/entes/evolucion/mes?ente=${encodeURIComponent(ente!)}&anio=${item.anio}&mes=${item.mes}`);
                }
            }
        },
        cursor: 'pointer',
        scales: {
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                title: { display: true, text: 'Primas (€)' }
            },
            y1: {
                type: 'linear' as const,
                display: true,
                position: 'right' as const,
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Nº Pólizas' }
            }
        }
    };

    const handleExportExcel = () => {
        const title = [['EVOLUCIÓN MENSUAL'], [`Ente: ${ente}`], [`Periodo: ${MONTHS[startPeriod.month - 1]} ${startPeriod.year} a ${MONTHS[endPeriod.month - 1]} ${endPeriod.year}`], []];
        const rows = filteredData.map(d => ({
            'Año': d.anio,
            'Mes': MONTHS[d.mes - 1],
            'Primas (€)': d.primas,
            'Nº Pólizas': d.polizas
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(title);
        XLSX.utils.sheet_add_json(ws, rows, { origin: title.length });
        XLSX.utils.book_append_sheet(wb, ws, "Evolucion");
        XLSX.writeFile(wb, `Evolucion_${ente?.replace(/ /g, '_')}.xlsx`);
    };

    if (!ente) return <div className="p-8 text-center">No se ha seleccionado ningún ente</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" /> Volver
                </button>
                <div className="flex gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-medium">
                        <FileDown className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm text-sm font-medium">
                        <Printer className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{ente}</h1>
                        <p className="text-slate-500 font-medium">Análisis de evolución histórica mensual</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 no-print">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Desde
                        </h3>
                        <div className="flex gap-2">
                            <select
                                value={startPeriod.month}
                                onChange={(e) => setStartPeriod(p => ({ ...p, month: parseInt(e.target.value) }))}
                                className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <select
                                value={startPeriod.year}
                                onChange={(e) => setStartPeriod(p => ({ ...p, year: parseInt(e.target.value) }))}
                                className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Hasta
                        </h3>
                        <div className="flex gap-2">
                            <select
                                value={endPeriod.month}
                                onChange={(e) => setEndPeriod(p => ({ ...p, month: parseInt(e.target.value) }))}
                                className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <select
                                value={endPeriod.year}
                                onChange={(e) => setEndPeriod(p => ({ ...p, year: parseInt(e.target.value) }))}
                                className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            Variación de Producción y Pólizas
                        </h2>
                        <div className="flex bg-slate-100 p-1 rounded-lg no-print">
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'line' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Línea
                            </button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Barras
                            </button>
                        </div>
                    </div>

                    <div className="h-[400px] w-full">
                        {loading ? (
                            <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 font-medium">
                                Cargando histórico...
                            </div>
                        ) : filteredData.length > 0 ? (
                            chartType === 'line' ? <Line data={chartData} options={chartOptions} /> : <Bar data={chartData} options={chartOptions} />
                        ) : (
                            <div className="h-full w-full bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                No hay datos para el periodo seleccionado
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <LayoutList className="w-5 h-5 text-slate-400" />
                    <h3 className="text-lg font-bold text-slate-800">Desglose Mensual</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">Periodo</th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right">Primas (€)</th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right">Nº Pólizas</th>
                                <th className="p-4 font-bold text-slate-500 uppercase tracking-widest text-xs text-right">Ticket Medio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...filteredData].reverse().map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 font-medium">
                                        <button
                                            onClick={() => router.push(`/entes/evolucion/mes?ente=${encodeURIComponent(ente!)}&anio=${d.anio}&mes=${d.mes}`)}
                                            className="text-indigo-600 hover:text-indigo-900 hover:underline underline-offset-4 font-bold"
                                        >
                                            {MONTHS[d.mes - 1]} {d.anio}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-700">{currencyFormatter.format(d.primas)}</td>
                                    <td className="p-4 text-right font-semibold text-slate-700">{numberFormatter.format(d.polizas)}</td>
                                    <td className="p-4 text-right text-slate-500">{currencyFormatter.format(d.polizas > 0 ? d.primas / d.polizas : 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function EvolutionPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-slate-400 font-medium">Cargando Panel de Evolución...</div>}>
            <EvolutionContent />
        </Suspense>
    );
}
