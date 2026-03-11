const metricsResponseCache = new Map<string, any>();
const pendingMetricsResponses = new Map<string, Promise<any>>();

export function getCachedMetricsResponse(cacheKey: string): any | undefined {
    return metricsResponseCache.get(cacheKey);
}

export function setCachedMetricsResponse(cacheKey: string, payload: any): void {
    metricsResponseCache.set(cacheKey, payload);
}

export function getPendingMetricsResponse(cacheKey: string): Promise<any> | undefined {
    return pendingMetricsResponses.get(cacheKey);
}

export function setPendingMetricsResponse(cacheKey: string, payload: Promise<any>): void {
    pendingMetricsResponses.set(cacheKey, payload);
}

export function clearPendingMetricsResponse(cacheKey: string): void {
    pendingMetricsResponses.delete(cacheKey);
}

export function invalidateMetricsResponseCache(): void {
    metricsResponseCache.clear();
    pendingMetricsResponses.clear();
}
