/**
 * Registry: Manages "mutable" data (Links, Entes)
 * Uses the hybrid storage layer for persistence.
 */

import { readData, appendData, writeData } from './storage';
import * as XLSX from 'xlsx';

export interface LinkRecord {
    ASESOR: string;
    ENTE: string;
}

export interface EnteRecord {
    Código: string;
    Nombre: string;
    Tipo: string;
    Año1?: number;
}

// Links (Asesor ↔ Ente)
export async function getLinks(): Promise<LinkRecord[]> {
    return readData('entes_registrados_asesor.xlsx') as Promise<LinkRecord[]>;
}

export async function addLink(link: LinkRecord): Promise<LinkRecord[]> {
    return appendData('entes_registrados_asesor.xlsx', link);
}

export async function removeLink(asesor: string, enteFormatted: string): Promise<void> {
    const links = await getLinks();
    const filteredLinks = links.filter(l =>
        !(String(l['ASESOR']) === asesor && String(l['ENTE']) === enteFormatted)
    );

    const ws = XLSX.utils.json_to_sheet(filteredLinks);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    await writeData('entes_registrados_asesor.xlsx', Buffer.from(excelBuffer));
}

// Entes Registry
export async function getEntes(): Promise<EnteRecord[]> {
    return readData('entes.xlsx') as Promise<EnteRecord[]>;
}

export async function addEnte(ente: EnteRecord): Promise<EnteRecord[]> {
    // The user explicitly requested that registering entes SHOULD OVERWRITE the file
    const currentData = [ente];

    // Rebuild the Excel buffer
    const ws = XLSX.utils.json_to_sheet(currentData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    await writeData('entes.xlsx', Buffer.from(excelBuffer));
    return currentData;
}
