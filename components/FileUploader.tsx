"use client";

import { useState, useRef } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploaderProps {
    target: 'polizas' | 'entes';
    label: string;
    onUploadStart?: () => void;
    onUploadSuccess?: () => void;
}

export default function FileUploader({ target, label, onUploadStart, onUploadSuccess }: FileUploaderProps) {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (onUploadStart) onUploadStart();
        setStatus('uploading');
        setMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const endpoint = target === 'polizas' ? '/api/upload/polizas' : '/api/upload/entes';
            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage(data.message || 'Archivo actualizado');
                if (onUploadSuccess) onUploadSuccess();
                // Reset after 3 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }, 3000);
            } else {
                setStatus('error');
                setMessage(data.error || 'Error en la subida');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('Error de conexión');
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="inline-block relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
            />

            <button
                type="button"
                onClick={handleClick}
                disabled={status === 'uploading'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                    ${status === 'uploading' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                        status === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
                                'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900'}
                `}
            >
                {status === 'uploading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === 'success' ? (
                    <Check className="w-4 h-4" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-4 h-4" />
                ) : (
                    <Upload className="w-4 h-4" />
                )}

                {status === 'idle' && label}
                {status === 'uploading' && 'Subiendo...'}
                {status === 'success' && '¡Actualizado!'}
                {status === 'error' && 'Error'}
            </button>

            {/* Tooltip-like error message if needed, or just below */}
            {status === 'error' && message && (
                <div className="absolute top-full mt-2 left-0 z-50 w-64 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-600 shadow-lg">
                    {message}
                </div>
            )}
        </div>
    );
}
