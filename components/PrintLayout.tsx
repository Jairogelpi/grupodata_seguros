'use client';

import React from 'react';

export default function PrintLayout() {
    return (
        <div className="hidden print:block pointer-events-none z-50">
            {/* CSS for page numbers */}
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 0;
                        size: A4;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Fixed Header/Footer */
                    .print-header {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 100px;
                        background: white;
                        z-index: 1000;
                        padding: 20px 40px;
                    }
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 50px;
                        background: white;
                        z-index: 1000;
                        padding: 10px 40px;
                    }
                    /* Main Content Scaling */
                    main {
                        margin-top: 110px; 
                        margin-bottom: 60px;
                        margin-left: 20px;
                        margin-right: 20px;
                        transform: scale(0.85); /* Scale down to fit wide tables */
                        transform-origin: top center;
                        width: 115%; /* Compensate for scale down */
                    }
                    
                    /* Hide scrollbars in print */
                    ::-webkit-scrollbar {
                        display: none;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    /* Force page breaks */
                    .break-inside-avoid {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            {/* Header Structure for Print */}
            <div className="print-header hidden print:flex justify-between items-center border-b-2 border-primary/20">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Grupo Data" className="h-12 w-auto object-contain" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">Grupo Data</h1>
                        <p className="text-xs text-slate-500 font-medium">Correduría de Seguros</p>
                    </div>
                </div>
                <div className="text-right text-[10px] text-slate-500 leading-tight">
                    <p className="font-bold text-slate-700">Grupo Data Asesoramiento y Gestión</p>
                    <p>C/ Periodista Sánchez Asensio, 3</p>
                    <p>10002 Cáceres</p>
                    <p>Tel: 927 600 000 | www.grupodata.es</p>
                </div>
            </div>

            {/* Footer Structure for Print */}
            <div className="print-footer hidden print:flex justify-between items-end border-t border-slate-200">
                <div className="text-[9px] text-slate-400">
                    <p>Documento generado el {new Date().toLocaleDateString('es-ES')} a las {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="mt-0.5">Confidencial - Propiedad de Grupo Data Seguros</p>
                </div>
                <div className="text-right text-[9px] text-slate-400">
                    <p>Página <span className="pageNumber"></span></p>
                </div>
            </div>
        </div>
    );
}
