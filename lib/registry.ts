import { readExcel, appendToExcel, getFilePath } from './excel';
import fs from 'fs';
import path from 'path';

// This abstraction handles the "Registry" data (Links and Entes)
// In Development: Reads/Writes to local Excel files.
// In Production (Vercel): Reads/Writes to Vercel Postgres (Infrastructure to be added).

const IS_DEV = process.env.NODE_ENV === 'development';

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

// 1. Linking Asesores
export async function getLinks(): Promise<LinkRecord[]> {
    // TODO: In production, fetch from Postgres
    return readExcel('entes_registrados_asesor.xlsx') as LinkRecord[];
}

export async function addLink(link: LinkRecord): Promise<LinkRecord[]> {
    // In dev, we still want to write to the Excel file
    if (IS_DEV) {
        return appendToExcel('entes_registrados_asesor.xlsx', link);
    }

    // TODO: In production, write to Postgres
    console.log("[Registry] Production write to DB simulated for Link:", link);
    return getLinks();
}

// 2. Entes Registry
export async function getEntes(): Promise<EnteRecord[]> {
    // TODO: In production, fetch from Postgres
    return readExcel('entes.xlsx') as EnteRecord[];
}

export async function addEnte(ente: EnteRecord): Promise<EnteRecord[]> {
    if (IS_DEV) {
        return appendToExcel('entes.xlsx', ente);
    }

    // TODO: In production, write to Postgres
    console.log("[Registry] Production write to DB simulated for Ente:", ente);
    return getEntes();
}

// 3. Export Registry (For user to sync back to local @data)
export async function exportRegistryToExcel() {
    // This will generate a temporary buffer or file for the user to download
    // ensuring they can "sync" the DB changes back to their local Excel files.
}
