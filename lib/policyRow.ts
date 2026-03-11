import { getCell, getStringCell } from './excelRow';

export function getPolicyNumber(row: Record<string, any>): string {
    return getStringCell(row, 'NPoliza', 'NºPóliza', 'Poliza');
}

export function getPolicyState(row: Record<string, any>): string {
    return String(getCell(row, 'Estado') || '').trim();
}

export function getPolicyHolder(row: Record<string, any>): string {
    return getStringCell(row, 'Tomador');
}

export function getPolicyHolderDocument(row: Record<string, any>): string {
    return getStringCell(row, 'NifCifTomador', 'NIF/CIF Tomador');
}

export function getPolicyProduct(row: Record<string, any>): string {
    return getStringCell(row, 'Producto');
}

export function getPolicyCompany(row: Record<string, any>): string {
    return getStringCell(row, 'AbrevCia', 'Abrev.Cía', 'Compania', 'Compañía');
}

export function getPolicyEnteCommercial(row: Record<string, any>): string {
    return getStringCell(row, 'EnteComercial', 'Ente Comercial');
}

export function getPolicyYear(row: Record<string, any>): string {
    return getStringCell(row, 'AnoProd', 'AÑO_PROD');
}

export function getPolicyMonth(row: Record<string, any>): string {
    return getStringCell(row, 'MesProd', 'MES_Prod');
}

export function getPolicySourceCode(row: Record<string, any>): string {
    return getStringCell(row, 'Codigo', 'Código');
}

export function getPolicyEnteCode3(row: Record<string, any>): string {
    return getStringCell(row, 'Codigo3', 'Código3');
}

export function getPolicyPremiumValue(row: Record<string, any>, ...keys: string[]): number {
    const raw = String(getCell(row, ...keys) || '').trim();
    if (!raw) return 0;

    const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
}

export function getPolicyEffectiveDate(row: Record<string, any>): string {
    return getStringCell(row, 'FEfecto', 'F.Efecto');
}

export function getPolicyCancellationDate(row: Record<string, any>): string {
    return getStringCell(row, 'FAnulacion', 'F.Anulación', 'FBaja', 'F.Baja');
}

export function getPolicyAltaDate(row: Record<string, any>): string {
    return getStringCell(row, 'FAlta', 'F. Alta');
}

export function getPolicyCancellationReason(row: Record<string, any>): string {
    return getStringCell(row, 'MotAnulacion', 'Mot.Anulación');
}

export function getPolicyPaymentMethod(row: Record<string, any>): string {
    return getStringCell(row, 'FormaPago', 'Forma Pago', 'Forma de Pago');
}

export function getPolicyEnteCode(row: Record<string, any>): string {
    const code3 = getPolicyEnteCode3(row);
    if (code3) return code3;

    const enteCommercial = getPolicyEnteCommercial(row);
    const parts = enteCommercial.split(' - ');
    const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteCommercial.trim();
    if (codeFromEnte) return codeFromEnte;

    return getPolicySourceCode(row);
}
