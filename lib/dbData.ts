import * as XLSX from 'xlsx';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCell, getStringCell } from './excelRow';

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yjelnqsbohuorcrpkxng.supabase.co';
const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZWxucXNib2h1b3JjcnBraG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQxNzAsImV4cCI6MjA4NzA2MDE3MH0.iTHGj5KNWpw9ADMwWRyTI1oSoVaLQxiS-s_FZNgqC78';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const readClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
);

function getAdminClient(): SupabaseClient {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for database writes');
    }

    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });
}

function parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    return text || null;
}

function parseEnteCodeFromLabel(value: string): string {
    const parts = String(value || '').split(' - ');
    return (parts.length > 1 ? parts[parts.length - 1] : value || '').trim();
}

async function selectAllRows<T>(table: string, orderColumn?: string): Promise<T[]> {
    const pageSize = 1000;
    const rows: T[] = [];
    let from = 0;

    while (true) {
        let query = readClient.from(table).select('*').range(from, from + pageSize - 1);
        if (orderColumn) {
            query = query.order(orderColumn, { ascending: true });
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        rows.push(...(data as T[]));
        if (data.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

async function insertInChunks(table: string, rows: Record<string, any>[], chunkSize = 500): Promise<void> {
    if (rows.length === 0) return;
    const admin = getAdminClient();

    for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        const { error } = await admin.from(table).insert(chunk);
        if (error) throw error;
    }
}

async function callAdminRpc(name: string): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin.rpc(name);
    if (error) throw error;
}

function workbookRowsFromBuffer(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
}

type AdvisorRow = { ASESOR: string };
type YearRow = { AÑO_PROD: string };
type MonthRow = { MES_Prod: string };
type StateRow = { ESTADO: string };
type EnteRow = { Código: string; Nombre: string; Tipo: string | null; Año1: string | null };
type LinkRow = { ASESOR: string; ENTE: string };

export async function readDatasetFromDb(filename: string): Promise<any[] | null> {
    try {
        switch (filename) {
            case 'lista_asesores.xlsx':
                return await selectAllRows<AdvisorRow>('lista_asesores', 'ASESOR');
            case 'lista_anos.xlsx':
                return await selectAllRows<YearRow>('lista_anos', 'AÑO_PROD');
            case 'lista_meses.xlsx':
                return await selectAllRows<MonthRow>('lista_meses', 'MES_Prod');
            case 'lista_estados.xlsx':
                return await selectAllRows<StateRow>('lista_estados', 'ESTADO');
            case 'entes.xlsx':
                return await selectAllRows<EnteRow>('entes', 'Código');
            case 'entes_registrados_asesor.xlsx':
                return await selectAllRows<LinkRow>('entes_registrados_asesor', 'ASESOR');
            case 'listado_polizas.xlsx':
                return await selectAllRows<Record<string, any>>('listado_polizas', 'NºPóliza');
            default:
                return null;
        }
    } catch (error: any) {
        if (
            error?.code === '42P01' ||
            error?.code === 'PGRST205' ||
            String(error?.message || '').toLowerCase().includes('relation')
        ) {
            return null;
        }

        throw error;
    }
}

export async function getDbEntes(): Promise<any[]> {
    return (await readDatasetFromDb('entes.xlsx')) || [];
}

export async function getDbLinks(): Promise<any[]> {
    return (await readDatasetFromDb('entes_registrados_asesor.xlsx')) || [];
}

export async function upsertDbEnte(ente: Record<string, any>): Promise<any[]> {
    const admin = getAdminClient();
    const payload = {
        Código: getStringCell(ente, 'Codigo', 'Código'),
        Nombre: toNullableString(getCell(ente, 'Nombre')),
        Tipo: toNullableString(getCell(ente, 'Tipo')),
        Año1: toNullableString(getCell(ente, 'Ano1', 'Año1'))
    };

    if (!payload.Código || !payload.Nombre) {
        throw new Error('Codigo y Nombre son obligatorios para guardar un ente');
    }

    const { error: deleteError } = await admin.from('entes').delete().eq('Código', payload.Código);
    if (deleteError) throw deleteError;

    const { error: insertError } = await admin.from('entes').insert([payload]);
    if (insertError) throw insertError;

    return getDbEntes();
}

async function ensureAdvisors(advisorNames: string[]): Promise<void> {
    const normalized = Array.from(new Set(advisorNames.map(name => String(name).trim()).filter(Boolean)));
    if (normalized.length === 0) return;

    const existingRows = await selectAllRows<AdvisorRow>('lista_asesores', 'ASESOR');
    const existing = new Set(existingRows.map(row => row.ASESOR));
    const missing = normalized.filter(name => !existing.has(name)).map(ASESOR => ({ ASESOR }));

    await insertInChunks('lista_asesores', missing);
}

export async function addDbLink(link: { ASESOR: string; ENTE: string }): Promise<any[]> {
    const admin = getAdminClient();
    const advisorName = String(link.ASESOR || '').trim();
    const enteLabel = String(link.ENTE || '').trim();

    if (!advisorName || !enteLabel) {
        throw new Error('ASESOR y ENTE son obligatorios');
    }

    await ensureAdvisors([advisorName]);

    const { data: existing, error: selectError } = await admin
        .from('entes_registrados_asesor')
        .select('*')
        .eq('ASESOR', advisorName)
        .eq('ENTE', enteLabel)
        .limit(1);

    if (selectError) throw selectError;

    if (!existing || existing.length === 0) {
        const { error: insertError } = await admin
            .from('entes_registrados_asesor')
            .insert([{ ASESOR: advisorName, ENTE: enteLabel }]);

        if (insertError) throw insertError;
    }

    return getDbLinks();
}

export async function removeDbLink(asesor: string, enteFormatted: string): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin
        .from('entes_registrados_asesor')
        .delete()
        .eq('ASESOR', asesor)
        .eq('ENTE', enteFormatted);

    if (error) throw error;
}

export async function overwriteEntesFromWorkbook(buffer: Buffer): Promise<{ entes: number; linksRestored: number }> {
    const rows = workbookRowsFromBuffer(buffer);
    const mappedEntes = Array.from(
        new Map(
            rows
                .map(row => {
                    const codigo = getStringCell(row, 'Codigo', 'Código');
                    return [
                        codigo,
                        {
                            Código: codigo,
                            Nombre: toNullableString(getCell(row, 'Nombre')),
                            Tipo: toNullableString(getCell(row, 'Tipo')),
                            Año1: toNullableString(getCell(row, 'Ano1', 'Año1'))
                        }
                    ] as const;
                })
                .filter(([, row]) => row.Código && row.Nombre)
        ).values()
    );

    const existingLinks = await getDbLinks();
    const entesByCode = new Map(mappedEntes.map(row => [row.Código, row]));
    const reusableLinksMap = new Map<string, { ASESOR: string; ENTE: string }>();

    for (const link of existingLinks) {
        const advisor = String(link.ASESOR).trim();
        const code = parseEnteCodeFromLabel(String(link.ENTE));
        const ente = entesByCode.get(code);

        if (!advisor || !ente?.Nombre || !ente.Código) {
            continue;
        }

        reusableLinksMap.set(`${advisor}::${code}`, {
            ASESOR: advisor,
            ENTE: `${ente.Nombre} - ${ente.Código}`
        });
    }

    const reusableLinks = Array.from(reusableLinksMap.values());

    await callAdminRpc('truncate_entes_data');
    await insertInChunks('entes', mappedEntes);
    await ensureAdvisors(reusableLinks.map(link => link.ASESOR));
    await insertInChunks('entes_registrados_asesor', reusableLinks);

    return {
        entes: mappedEntes.length,
        linksRestored: reusableLinks.length
    };
}

export async function overwritePoliciesFromWorkbook(
    buffer: Buffer
): Promise<{ policies: number; years: number; months: number; states: number }> {
    const rows = workbookRowsFromBuffer(buffer);
    const policies = rows
        .map(row => ({
            Código: toNullableString(getCell(row, 'Codigo', 'Código')),
            'NºPóliza': toNullableString(getCell(row, 'NPoliza', 'NºPóliza')),
            'Abrev.Cía': toNullableString(getCell(row, 'AbrevCia', 'Abrev.Cía')),
            Duración: toNullableString(getCell(row, 'Duracion', 'Duración')),
            'Forma Pago': toNullableString(getCell(row, 'FormaPago', 'Forma Pago')),
            Estado: toNullableString(getCell(row, 'Estado')),
            Tomador: toNullableString(getCell(row, 'Tomador')),
            Producto: toNullableString(getCell(row, 'Producto')),
            'F.Efecto': toNullableString(getCell(row, 'FEfecto', 'F.Efecto')),
            'F.Anulación': toNullableString(getCell(row, 'FAnulacion', 'F.Anulación')),
            'NIF/CIF Tomador': toNullableString(getCell(row, 'NifCifTomador', 'NIF/CIF Tomador')),
            'Ente Comercial': toNullableString(getCell(row, 'EnteComercial', 'Ente Comercial')),
            'P.Produccion': parseNumber(getCell(row, 'PProduccion', 'P.Produccion')),
            'P.Cartera': parseNumber(getCell(row, 'PCartera', 'P.Cartera')),
            'Mot.Anulación': toNullableString(getCell(row, 'MotAnulacion', 'Mot.Anulación')),
            'F. Alta': toNullableString(getCell(row, 'FAlta', 'F. Alta')),
            'ENTE COMERCIAL2': toNullableString(getCell(row, 'EnteComercial2', 'ENTE COMERCIAL2')),
            AÑO_PROD: toNullableString(getCell(row, 'AnoProd', 'AÑO_PROD')),
            MES_Prod: toNullableString(getCell(row, 'MesProd', 'MES_Prod')),
            Código3: toNullableString(getCell(row, 'Codigo3', 'Código3'))
        }))
        .filter(row => row['NºPóliza']);

    const years = Array.from(
        new Set(policies.map(row => row.AÑO_PROD).filter((value): value is string => Boolean(value)))
    )
        .sort()
        .map(AÑO_PROD => ({ AÑO_PROD }));

    const months = Array.from(
        new Set(policies.map(row => row.MES_Prod).filter((value): value is string => Boolean(value)))
    )
        .sort()
        .map(MES_Prod => ({ MES_Prod }));

    const states = Array.from(
        new Set(policies.map(row => row.Estado).filter((value): value is string => Boolean(value)))
    )
        .sort()
        .map(ESTADO => ({ ESTADO }));

    await callAdminRpc('truncate_policies_data');
    await insertInChunks('lista_anos', years);
    await insertInChunks('lista_meses', months);
    await insertInChunks('lista_estados', states);
    await insertInChunks('listado_polizas', policies);

    return {
        policies: policies.length,
        years: years.length,
        months: months.length,
        states: states.length
    };
}
