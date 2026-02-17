/**
 * Registry: Manages "mutable" data (Links, Entes)
 * Uses the hybrid storage layer for persistence.
 */

import { readData, appendData } from './storage';

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

// Entes Registry
export async function getEntes(): Promise<EnteRecord[]> {
    return readData('entes.xlsx') as Promise<EnteRecord[]>;
}

export async function addEnte(ente: EnteRecord): Promise<EnteRecord[]> {
    return appendData('entes.xlsx', ente);
}
