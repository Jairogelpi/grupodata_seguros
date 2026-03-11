function normalizeKey(value: string): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

export function getCell(row: Record<string, any>, ...candidates: string[]): any {
    if (!row || typeof row !== 'object') return undefined;

    const normalizedCandidates = new Set(candidates.map(normalizeKey));

    for (const [key, value] of Object.entries(row)) {
        if (normalizedCandidates.has(normalizeKey(key))) {
            return value;
        }
    }

    return undefined;
}

export function getStringCell(row: Record<string, any>, ...candidates: string[]): string {
    const value = getCell(row, ...candidates);
    return String(value ?? '').trim();
}
