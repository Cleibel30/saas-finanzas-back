import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable()
export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaults = { ttl: 60_000 };

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl = this.defaults.ttl,
  ): Promise<T> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing && existing.expiry > now) {
      return existing.data as T;
    }
    const data = await factory();
    this.store.set(key, { data, expiry: now + ttl });
    return data;
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  invalidatePattern(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}
