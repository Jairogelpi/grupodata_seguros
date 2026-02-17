'use client';

import { useState, useEffect } from 'react';
import { Link as LinkIcon, UserCheck, Building2, AlertCircle } from 'lucide-react';

interface Asesor {
    ASESOR: string;
}

interface Ente {
    Código: string | number;
    Nombre: string;
}

export default function EnlazarPage() {
    const [asesores, setAsesores] = useState<Asesor[]>([]);
    const [entes, setEntes] = useState<Ente[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        asesor: '',
        enteCode: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [resA, resE] = await Promise.all([
                    fetch('/api/asesores'),
                    fetch('/api/entes')
                ]);
                const dataA = await resA.json();
                const dataE = await resE.json();

                if (Array.isArray(dataA)) setAsesores(dataA);
                if (Array.isArray(dataE)) setEntes(dataE);
            } catch (error) {
                console.error('Error fetching data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage(null);

        try {
            const res = await fetch('/api/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Vínculo creado correctamente' });
                setFormData({ ...formData, enteCode: '' }); // Clear only ente to allow linking more to same asesor
            } else {
                setMessage({ type: 'error', text: data.error || 'Error al vincular' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Enlazar Asesores</h1>
                <p className="text-slate-500">Asigna entes comerciales a los asesores correspondientes</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" />
                            Seleccionar Asesor
                        </label>
                        <select
                            required
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-slate-50 transition-all"
                            value={formData.asesor}
                            onChange={e => setFormData({ ...formData, asesor: e.target.value })}
                        >
                            <option value="">Elegir asesor...</option>
                            {asesores.map((a, i) => (
                                <option key={i} value={a.ASESOR}>{a.ASESOR}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            Seleccionar Ente
                        </label>
                        <select
                            required
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-slate-50 transition-all"
                            value={formData.enteCode}
                            onChange={e => setFormData({ ...formData, enteCode: e.target.value })}
                        >
                            <option value="">Elegir ente comercial...</option>
                            {entes.sort((a, b) => String(a.Nombre).localeCompare(String(b.Nombre))).map((e, i) => (
                                <option key={i} value={String(e.Código)}>{e.Nombre} - {e.Código}</option>
                            ))}
                        </select>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.type === 'error' && <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-medium">{message.text}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || loading}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? 'Vinculando...' : (
                            <>
                                <LinkIcon className="w-5 h-5" />
                                Crear Vínculo
                            </>
                        )}
                    </button>
                </form>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Información</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Al enlazar un asesor con un ente, todos los datos vinculados a ese código de ente en el listado de pólizas se atribuirán al asesor seleccionado en los informes del panel de control.
                </p>
            </div>
        </div>
    );
}
