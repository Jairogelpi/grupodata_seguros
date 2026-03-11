/**
 * Registry: manages mutable data through database tables.
 */

import { addDbLink, getDbEntes, getDbLinks, removeDbLink, upsertDbEnte } from './dbData';

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

export async function getLinks(): Promise<LinkRecord[]> {
    return getDbLinks() as Promise<LinkRecord[]>;
}

export async function addLink(link: LinkRecord): Promise<LinkRecord[]> {
    return addDbLink(link) as Promise<LinkRecord[]>;
}

export async function removeLink(asesor: string, enteFormatted: string): Promise<void> {
    await removeDbLink(asesor, enteFormatted);
}

export async function getEntes(): Promise<EnteRecord[]> {
    return getDbEntes() as Promise<EnteRecord[]>;
}

export async function addEnte(ente: EnteRecord): Promise<EnteRecord[]> {
    return upsertDbEnte(ente) as Promise<EnteRecord[]>;
}
