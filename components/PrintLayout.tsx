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
                       /* Hide browser default header/footer */
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Hide Navigation explicitly */
                    nav, header {
                        display: none !important;
                    }

                    /* Fixed Corporate Header/Footer */
                    .print-header {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 120px; /* Slight increase */
                        background: white;
                        z-index: 9999; /* Max z-index */
                        padding: 30px 40px 10px 40px;
                        display: flex !important;
                    }
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 50px;
                        background: white;
                        z-index: 9999;
                        padding: 10px 40px;
                        display: flex !important;
                    }
                    
                    /* Main Content Scaling */
                    main {
                        margin-top: 20px !important; /* Small margin relative to spacer */
                        margin-bottom: 80px !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        
                        transform: scale(0.75); /* Reduced scale to fit more content */
                        transform-origin: top center;
                        width: 133.3% !important; /* 100 / 0.75 = 133.3% */
                        
                        margin-left: auto !important;
                        margin-right: auto !important;
                        padding-left: 30px !important;
                        padding-right: 30px !important;
                        
                        overflow: visible !important;
                        display: block !important;
                        width: 133.3% !important;
                    }
                    
                    /* Table Condensation for Print */
                    .print-table-condensed {
                        font-size: 8px !important;
                        width: 100% !important;
                    }
                    .print-table-condensed th, 
                    .print-table-condensed td {
                        padding: 4px 6px !important;
                        white-space: normal !important; /* Allow wrapping */
                    }
                    .print-wrap {
                        white-space: normal !important;
                        word-break: break-word !important;
                    }
                    
                    /* Cleanups */
                    ::-webkit-scrollbar { display: none; }
                    .no-print { display: none !important; }
                    
                    /* Ensure tables don't scroll but show full width */
                    .overflow-x-auto, .overflow-hidden {
                        overflow: visible !important;
                    }
                    
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

            {/* SPACER FOR CONTENT - Pushes main content down in the flow */}
            <div className="hidden print:block w-full" style={{ height: '220px' }}></div>

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
