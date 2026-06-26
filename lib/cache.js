/**
 * Простий in-memory кеш з TTL.
 * Дані живуть поки працює сервер Next.js.
 */

const cache = new Map();

/**
 * @param {string} key
 * @param {() => Promise<any>} fetcher - функція що повертає дані
 * @param {number} ttlSeconds - час життя кешу в секундах
 */
export async function withCache(key, fetcher, ttlSeconds = 300) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, {
    data,
    expiresAt: now + ttlSeconds * 1000,
  });
  return data;
}

export function invalidateCache(keyPrefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}

export function getCacheStats() {
  const now = Date.now();
  let active = 0;
  for (const v of cache.values()) {
    if (now < v.expiresAt) active++;
  }
  return { total: cache.size, active };
}
