"use client";

import React from 'react';

interface PrintFilterSummaryProps {
    filters: {
        comercial: string[];
        ente: string[];
        anio: string[];
        mes: string[];
        estado: string[];
    };
}

export default function PrintFilterSummary({ filters }: PrintFilterSummaryProps) {
    const hasFilters = Object.values(filters).some(f => f.length > 0);

    if (!hasFilters) {
        return (
            <div className="hidden print:block mb-6 text-sm text-slate-500 border-b pb-2 italic">
                <span className="font-bold text-slate-800 mr-2">Filtros aplicados:</span>
                Ninguno (Todos los datos)
            </div>
        );
    }

    const formatFilter = (label: string, values: string[]) => {
        if (values.length === 0) return null;
        return (
            <span key={label} className="mr-4">
                <span className="font-bold text-slate-800">{label}:</span> {values.join(', ')}
            </span>
        );
    };

    return (
        <div className="hidden print:block mb-6 text-[11px] text-slate-600 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap gap-y-1">
                <span className="font-bold text-primary mr-2 uppercase tracking-wider">Filtros Aplicados:</span>
                {formatFilter('Asesor', filters.comercial)}
                {formatFilter('Ente', filters.ente)}
                {formatFilter('Año', filters.anio)}
                {formatFilter('Mes', filters.mes)}
                {formatFilter('Estado', filters.estado)}
            </div>
        </div>
    );
}
