/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Enhanced caching utilities for improved performance
 * This extends the basic cache module with more advanced caching strategies
 */

export interface IEnhancedCacheEntry<T> {
	readonly value: T;
	readonly timestamp: number;
	readonly ttl?: number;
	readonly accessCount: number;
	readonly lastAccessed: number;
}

export interface IEnhancedCacheOptions {
	readonly maxSize?: number;
	readonly defaultTtl?: number;
	readonly cleanupInterval?: number;
	readonly enableMetrics?: boolean;
}

export interface IEnhancedCacheMetrics {
	readonly hits: number;
	readonly misses: number;
	readonly hitRate: number;
	readonly size: number;
	readonly maxSize: number;
	readonly evictions: number;
}

/**
 * Enhanced LRU (Least Recently Used) Cache implementation with TTL support
 */
export class EnhancedLRUCache<K, V> {
	private cache = new Map<K, IEnhancedCacheEntry<V>>();
	private readonly maxSize: number;
	private readonly defaultTtl: number;
	private readonly cleanupInterval: number;
	private cleanupTimer?: NodeJS.Timeout;
	
	// Metrics
	private hits = 0;
	private misses = 0;
	private evictions = 0;
	
	constructor(options: IEnhancedCacheOptions = {}) {
		this.maxSize = options.maxSize || 1000;
		this.defaultTtl = options.defaultTtl || 300000; // 5 minutes
		this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
		
		if (options.enableMetrics !== false) {
			this.startCleanupTimer();
		}
	}

	/**
	 * Get a value from the cache
	 */
	get(key: K): V | undefined {
		const entry = this.cache.get(key);
		
		if (!entry) {
			this.misses++;
			return undefined;
		}

		// Check if entry has expired
		const now = Date.now();
		if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
			this.cache.delete(key);
			this.misses++;
			return undefined;
		}

		// Update access information
		const updatedEntry: IEnhancedCacheEntry<V> = {
			...entry,
			accessCount: entry.accessCount + 1,
			lastAccessed: now
		};
		
		// Move to end (most recently used)
		this.cache.delete(key);
		this.cache.set(key, updatedEntry);
		
		this.hits++;
		return entry.value;
	}

	/**
	 * Set a value in the cache
	 */
	set(key: K, value: V, ttl?: number): void {
		const now = Date.now();
		
		// If key already exists, remove it first
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}
		// If at capacity, remove least recently used
		else if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
			this.evictions++;
		}

		const entry: IEnhancedCacheEntry<V> = {
			value,
			timestamp: now,
			ttl: ttl || this.defaultTtl,
			accessCount: 0,
			lastAccessed: now
		};

		this.cache.set(key, entry);
	}

	/**
	 * Check if a key exists in the cache
	 */
	has(key: K): boolean {
		return this.get(key) !== undefined;
	}

	/**
	 * Delete a key from the cache
	 */
	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all entries from the cache
	 */
	clear(): void {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
		this.evictions = 0;
	}

	/**
	 * Get cache metrics
	 */
	getMetrics(): IEnhancedCacheMetrics {
		const total = this.hits + this.misses;
		return {
			hits: this.hits,
			misses: this.misses,
			hitRate: total > 0 ? this.hits / total : 0,
			size: this.cache.size,
			maxSize: this.maxSize,
			evictions: this.evictions
		};
	}

	/**
	 * Clean up expired entries
	 */
	cleanup(): number {
		const now = Date.now();
		let cleaned = 0;
		
		for (const [key, entry] of this.cache) {
			if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
				this.cache.delete(key);
				cleaned++;
			}
		}
		
		return cleaned;
	}

	/**
	 * Dispose of the cache and stop cleanup timer
	 */
	dispose(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}
		this.clear();
	}

	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.cleanupInterval);
	}
}

/**
 * Function memoization cache with automatic key generation
 */
export class MemoCache {
	private static cache = new EnhancedLRUCache<string, any>({ maxSize: 5000 });

	/**
	 * Memoize a function with automatic caching
	 */
	static memoize<TArgs extends any[], TReturn>(
		fn: (...args: TArgs) => TReturn,
		keyGenerator?: (...args: TArgs) => string,
		ttl?: number
	): (...args: TArgs) => TReturn {
		return (...args: TArgs): TReturn => {
			const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
			
			const cached = this.cache.get(key);
			if (cached !== undefined) {
				return cached;
			}

			const result = fn(...args);
			this.cache.set(key, result, ttl);
			return result;
		};
	}

	/**
	 * Memoize an async function
	 */
	static memoizeAsync<TArgs extends any[], TReturn>(
		fn: (...args: TArgs) => Promise<TReturn>,
		keyGenerator?: (...args: TArgs) => string,
		ttl?: number
	): (...args: TArgs) => Promise<TReturn> {
		const pendingCache = new Map<string, Promise<TReturn>>();

		return async (...args: TArgs): Promise<TReturn> => {
			const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
			
			// Check cache first
			const cached = this.cache.get(key);
			if (cached !== undefined) {
				return cached;
			}

			// Check if already pending
			const pending = pendingCache.get(key);
			if (pending) {
				return pending;
			}

			// Execute and cache
			const promise = fn(...args).then(result => {
				this.cache.set(key, result, ttl);
				pendingCache.delete(key);
				return result;
			}).catch(error => {
				pendingCache.delete(key);
				throw error;
			});

			pendingCache.set(key, promise);
			return promise;
		};
	}

	/**
	 * Clear the memoization cache
	 */
	static clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache metrics
	 */
	static getMetrics(): IEnhancedCacheMetrics {
		return this.cache.getMetrics();
	}
}

/**
 * Cache decorator for class methods
 */
export function enhancedCached(ttl?: number, keyGenerator?: (...args: any[]) => string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const cache = new EnhancedLRUCache<string, any>({ maxSize: 1000, defaultTtl: ttl });

		descriptor.value = function (...args: any[]) {
			const key = keyGenerator ? 
				keyGenerator(...args) : 
				`${this.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
			
			const cached = cache.get(key);
			if (cached !== undefined) {
				return cached;
			}

			const result = originalMethod.apply(this, args);
			
			// Handle async methods
			if (result && typeof result.then === 'function') {
				return result.then((resolvedResult: any) => {
					cache.set(key, resolvedResult, ttl);
					return resolvedResult;
				});
			} else {
				cache.set(key, result, ttl);
				return result;
			}
		};

		return descriptor;
	};
}

// Global enhanced cache instances for common use cases
export const enhancedGlobalCache = {
	/**
	 * General purpose cache
	 */
	general: new EnhancedLRUCache<string, any>({ maxSize: 1000, defaultTtl: 300000 }),
	
	/**
	 * File system cache
	 */
	fileSystem: new EnhancedLRUCache<string, any>({ maxSize: 500, defaultTtl: 600000 }),
	
	/**
	 * Network request cache
	 */
	network: new EnhancedLRUCache<string, any>({ maxSize: 200, defaultTtl: 120000 }),
	
	/**
	 * Configuration cache
	 */
	config: new EnhancedLRUCache<string, any>({ maxSize: 100, defaultTtl: 1800000 })
};