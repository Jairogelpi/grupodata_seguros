"use client";

import { AlertTriangle, BarChart3 } from 'lucide-react';

export default function PredictivePage() {
    return (
        <div className="max-w-3xl space-y-6">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                        <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">
                            Módulo IA desactivado
                        </h1>
                        <p className="text-sm font-medium leading-6 text-slate-700">
                            Se ha retirado temporalmente porque las métricas predictivas y de venta cruzada
                            no tenían fiabilidad suficiente para enseñarlas como recomendación operativa.
                        </p>
                        <p className="text-sm font-medium leading-6 text-slate-600">
                            Se mantienen las vistas descriptivas del panel y de cartera. Cuando rehagamos estos
                            modelos con validación real, volverán a activarse.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-3 text-slate-900">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold">Qué sigue disponible</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm font-medium text-slate-600">
                    <li>Desglose real de primas, pólizas, estados, compañías, ramos y productos.</li>
                    <li>Concentración de cartera y distribución por ramos.</li>
                    <li>Evolución y detalle por ente, comercial y póliza.</li>
                </ul>
            </div>
        </div>
    );
}
