import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import {
    getPolicyAltaDate,
    getPolicyCancellationDate,
    getPolicyCancellationReason,
    getPolicyCompany,
    getPolicyEffectiveDate,
    getPolicyEnteCode,
    getPolicyEnteCommercial,
    getPolicyHolder,
    getPolicyHolderDocument,
    getPolicyMonth,
    getPolicyNumber,
    getPolicyPaymentMethod,
    getPolicyPremiumValue,
    getPolicyProduct,
    getPolicyState,
    getPolicyYear
} from '@/lib/policyRow';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');
        const anio = searchParams.get('anio');
        const mes = searchParams.get('mes');

        if (!enteName || !anio || !mes) {
            return NextResponse.json({ error: 'Faltan parámetros (ente, anio, mes)' }, { status: 400 });
        }

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Ente Code (Same logic as evolution)
        const validEnteNames = new Set<string>();
        const codeToNameMap = new Map<string, string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            validEnteNames.add(val);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            codeToNameMap.set(code, val);
        });

        const getPolizaEnteName = (p: any) => {
            const enteComercial = getPolicyEnteCommercial(p);
            if (validEnteNames.has(enteComercial)) return enteComercial;

            const codeFromEnte = getPolicyEnteCode(p);
            const codeDirect = getPolicyEnteCode(p);

            return codeToNameMap.get(codeFromEnte) || codeToNameMap.get(codeDirect) || null;
        };

        // 3. Filter Policies for this specific month/ente
        const filteredPolizas = polizas.filter(p => {
            const name = getPolizaEnteName(p);
            if (name !== enteName) return false;

            const pAnio = parseInt(getPolicyYear(p), 10);
            const pMes = parseInt(getPolicyMonth(p), 10);

            return pAnio === targetAnio && pMes === targetMes;
        }).map(p => {
            const fEfectoStr = getPolicyEffectiveDate(p) || '';
            const fAnulaStr = getPolicyCancellationDate(p) || '';
            const estado = getPolicyState(p) || '';

            let diasHastaAnula = null;

            if (fEfectoStr) {
                try {
                    // Dates in Spanish format DD/MM/YYYY
                    const [dE, mE, yE] = fEfectoStr.split('/').map(Number);
                    const dateE = new Date(yE, mE - 1, dE);

                    if (!isNaN(dateE.getTime())) {
                        let targetDate: Date;

                        if (fAnulaStr) {
                            const [dA, mA, yA] = fAnulaStr.split('/').map(Number);
                            targetDate = new Date(yA, mA - 1, dA);
                        } else if (estado.toUpperCase().includes('VIGOR')) {
                            // If still in vigor, use current date
                            targetDate = new Date();
                        } else {
                            // Other states without cancellation date don't get a "days" calculation
                            return {
                                poliza: getPolicyNumber(p) || 'N/A',
                                estado: getPolicyState(p) || 'N/A',
                                tomador: getPolicyHolder(p) || 'N/A',
                                producto: getPolicyProduct(p) || 'N/A',
                                fechaEfecto: fEfectoStr,
                                fechaAnulacion: fAnulaStr,
                                diasHastaAnula: null,
                                dni: getPolicyHolderDocument(p) || 'N/A',
                                primas: getPolicyPremiumValue(p, 'PProduccion', 'P.Produccion'),
                                cartera: getPolicyPremiumValue(p, 'PCartera', 'P.Cartera'),
                                motivoAnulacion: getPolicyCancellationReason(p),
                                compania: getPolicyCompany(p) || 'N/A',
                                duracion: String(p['Duración'] || ''),
                                formaPago: getPolicyPaymentMethod(p),
                                fAlta: getPolicyAltaDate(p)
                            };
                        }

                        if (!isNaN(targetDate.getTime())) {
                            const diffTime = targetDate.getTime() - dateE.getTime();
                            diasHastaAnula = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                        }
                    }
                } catch (e) {
                    console.error('Error calculando dias de anulación', e);
                }
            }

            return {
                poliza: getPolicyNumber(p) || 'N/A',
                estado: getPolicyState(p) || 'N/A',
                tomador: getPolicyHolder(p) || 'N/A',
                producto: getPolicyProduct(p) || 'N/A',
                fechaEfecto: fEfectoStr,
                fechaAnulacion: fAnulaStr,
                diasHastaAnula,
                dni: getPolicyHolderDocument(p) || 'N/A',
                primas: getPolicyPremiumValue(p, 'PProduccion', 'P.Produccion'),
                cartera: getPolicyPremiumValue(p, 'PCartera', 'P.Cartera'),
                motivoAnulacion: getPolicyCancellationReason(p),
                compania: getPolicyCompany(p) || 'N/A',
                duracion: String(p['Duración'] || ''),
                formaPago: getPolicyPaymentMethod(p),
                fAlta: getPolicyAltaDate(p)
            };
        });

        return NextResponse.json({
            ente: enteName,
            anio: targetAnio,
            mes: targetMes,
            polizas: filteredPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch monthly details' }, { status: 500 });
    }
}
