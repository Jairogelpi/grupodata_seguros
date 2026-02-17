import React from 'react';

export default function PrintLayout() {
    return (
        <div className="hidden print:block fixed inset-0 pointer-events-none z-50 flex flex-col justify-between p-8">
            {/* Header */}
            <div className="w-full border-b-2 border-primary/20 pb-4 mb-8 flex justify-between items-center bg-white">
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

            {/* Content Placeholder (Invisible, just for spacing if needed, but here we use fixed positioning for header/footer) */}

            {/* Footer */}
            <div className="w-full border-t border-slate-200 pt-2 mt-auto bg-white">
                <div className="flex justify-between items-end text-[9px] text-slate-400">
                    <div>
                        <p>Documento generado el {new Date().toLocaleDateString('es-ES')} a las {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="mt-0.5">Confidencial - Propiedad de Grupo Data Seguros</p>
                    </div>
                    <div className="text-right">
                        <p>Página <span className="pageNumber"></span></p>
                    </div>
                </div>
            </div>

            {/* CSS for page numbers */}
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm;
                        size: A4;
                    }
                    /* Hide browser default header/footer */
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Ensure fixed elements repeat on every page */
                    .print-header {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 80px;
                    }
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 40px;
                    }
                    /* Add padding to body content so it doesn't overlap fixed header/footer */
                    main {
                        padding-top: 80px; 
                        padding-bottom: 40px;
                    }
                }
            `}</style>
        </div>
    );
}
