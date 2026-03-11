"use client";

type CacheEntry = {
    data?: any;
    expiresAt: number;
    promise?: Promise<any>;
};

const clientApiCache = new Map<string, CacheEntry>();

function isFresh(entry?: CacheEntry): boolean {
    return Boolean(entry?.data !== undefined && entry.expiresAt > Date.now());
}

export function peekCachedJson(url: string): any | null {
    const entry = clientApiCache.get(url);
    return isFresh(entry) ? entry!.data : null;
}

export async function fetchCachedJson(
    url: string,
    options: { ttlMs?: number; forceRefresh?: boolean } = {}
): Promise<any> {
    const { ttlMs = 300_000, forceRefresh = false } = options;
    const existing = clientApiCache.get(url);

    if (!forceRefresh && isFresh(existing)) {
        return existing!.data;
    }

    if (!forceRefresh && existing?.promise) {
        return existing.promise;
    }

    const promise = fetch(url).then(async response => {
        const json = await response.json();
        if (!response.ok) {
            throw new Error(json?.error || json?.message || `Request failed: ${response.status}`);
        }

        clientApiCache.set(url, {
            data: json,
            expiresAt: Date.now() + ttlMs
        });

        return json;
    }).catch(error => {
        clientApiCache.delete(url);
        throw error;
    });

    clientApiCache.set(url, {
        data: existing?.data,
        expiresAt: existing?.expiresAt || 0,
        promise
    });

    return promise;
}

export function invalidateClientApiCache(
    matcher?: string | RegExp | ((url: string) => boolean)
): void {
    if (!matcher) {
        clientApiCache.clear();
        return;
    }

    for (const key of clientApiCache.keys()) {
        const matches =
            typeof matcher === 'string' ? key.startsWith(matcher) :
                matcher instanceof RegExp ? matcher.test(key) :
                    matcher(key);

        if (matches) {
            clientApiCache.delete(key);
        }
    }
}
