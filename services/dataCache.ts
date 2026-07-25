/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DataCache — lightweight localStorage-based cache with TTL.
 * 
 * Rules:
 *  1. Data loads instantly from cache on first mount (no loading spinner).
 *  2. Data only refreshes if cache is older than CACHE_TTL_MS (30 minutes).
 *  3. A manual "Refresh" button forces re-fetch and updates cache.
 */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

/**
 * Get cached data for a given key.
 * Returns the cached data if it exists and is not expired, otherwise null.
 */
export function getCachedData<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(`FocusFlow_cache_${key}`);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);
        const age = Date.now() - entry.timestamp;

        if (age > CACHE_TTL_MS) {
            // Cache expired — return null so caller fetches fresh data
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
}

/**
 * Store data in the cache with the current timestamp.
 */
export function setCachedData<T>(key: string, data: T): void {
    try {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
        };
        localStorage.setItem(`FocusFlow_cache_${key}`, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable — silently fail
    }
}

/**
 * Check whether cached data exists AND is still fresh (not expired).
 */
export function isCacheFresh(key: string): boolean {
    try {
        const raw = localStorage.getItem(`FocusFlow_cache_${key}`);
        if (!raw) return false;
        const entry = JSON.parse(raw);
        return (Date.now() - entry.timestamp) < CACHE_TTL_MS;
    } catch {
        return false;
    }
}

/**
 * Clear a specific cache entry.
 */
export function clearCache(key: string): void {
    localStorage.removeItem(`FocusFlow_cache_${key}`);
}

/**
 * Clear all FocusFlow cache entries.
 */
export function clearAllCache(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('FocusFlow_cache_'));
    keys.forEach(k => localStorage.removeItem(k));
}

/**
 * Get the age of the cache entry in milliseconds, or null if no cache exists.
 */
export function getCacheAge(key: string): number | null {
    try {
        const raw = localStorage.getItem(`FocusFlow_cache_${key}`);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        return Date.now() - entry.timestamp;
    } catch {
        return null;
    }
}

/**
 * Formatted string showing how long ago the cache was last refreshed.
 */
export function getCacheAgeLabel(key: string): string {
    const age = getCacheAge(key);
    if (age === null) return '';

    const seconds = Math.floor(age / 1000);
    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
}
