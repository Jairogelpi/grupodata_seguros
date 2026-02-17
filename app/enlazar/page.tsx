'use client';

import { useState, useEffect } from 'react';
import { Link as LinkIcon, UserCheck, Building2, AlertCircle, Check } from 'lucide-react';
import { Combobox } from '@headlessui/react'; // This was not installed! I should use my custom component instead.

// Wait, I should stick to my custom SearchableSelect since I don't know if headlessui is installed.
import SearchableSelect from '@/components/SearchableSelect';

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

        if (!formData.asesor || !formData.enteCode) {
            setMessage({ type: 'error', text: 'Debes seleccionar un asesor y un ente' });
            return;
        }

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
                setFormData(prev => ({ ...prev, enteCode: '' })); // Clear only ente to allow rapid linking
            } else {
                setMessage({ type: 'error', text: data.error || 'Error al vincular' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setSubmitting(false);
        }
    };

    // Prepare options for Selects
    const asesorOptions = asesores
        .filter(a => a.ASESOR) // Filter out empty strings
        .map(a => ({ value: a.ASESOR, label: a.ASESOR }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const enteOptions = entes
        .filter(e => e.Código && e.Nombre)
        .map(e => ({ value: String(e.Código), label: `${e.Nombre} (${e.Código})` }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Enlazar Asesores</h1>
                <p className="text-slate-500">Asigna entes comerciales a los asesores correspondientes</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Asesor Searchable Select */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" />
                            Seleccionar Asesor
                        </label>
                        <SearchableSelect
                            options={asesorOptions}
                            value={formData.asesor}
                            onChange={(val) => setFormData(prev => ({ ...prev, asesor: val }))}
                            placeholder="Buscar asesor..."
                        />
                    </div>

                    {/* Ente Searchable Select */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            Seleccionar Ente
                        </label>
                        <SearchableSelect
                            options={enteOptions}
                            value={formData.enteCode}
                            onChange={(val) => setFormData(prev => ({ ...prev, enteCode: val }))}
                            placeholder="Buscar ente (nombre o código)..."
                        />
                    </div>

                    {/* Success/Error Message */}
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                            <span className="text-sm font-medium">{message.text}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || loading || !formData.asesor || !formData.enteCode}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
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
                    Al enlazar un asesor con un ente, todos los datos vinculados a ese código de ente en el listado de pólizas se atribuirán al asesor seleccionado en los informes del panel de control. Utiliza el buscador para encontrar rápidamente asesores o entes.
                </p>
            </div>
        </div>
    );
}
