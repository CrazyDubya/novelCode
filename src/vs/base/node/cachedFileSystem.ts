/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { Result } from '../common/result.js';
import { EnhancedCache } from '../common/enhancedCache.js';
import { EnhancedPerformanceMonitor } from '../common/enhancedPerformance.js';

/**
 * Cached file system operations with performance monitoring and error handling
 * Provides intelligent caching for frequently accessed configuration and data files
 */
export class CachedFileSystem {
	private static instance: CachedFileSystem;
	private readonly fileCache: EnhancedCache<string>;
	private readonly statCache: EnhancedCache<fs.Stats>;
	private readonly performanceMonitor: EnhancedPerformanceMonitor;

	constructor() {
		// File content cache with 5-minute TTL for configuration files
		this.fileCache = new EnhancedCache<string>({
			maxSize: 100,
			ttl: 5 * 60 * 1000, // 5 minutes
			name: 'fileSystem.content'
		});

		// File stats cache with 2-minute TTL for metadata operations
		this.statCache = new EnhancedCache<fs.Stats>({
			maxSize: 500,
			ttl: 2 * 60 * 1000, // 2 minutes
			name: 'fileSystem.stats'
		});

		this.performanceMonitor = EnhancedPerformanceMonitor.getInstance();
	}

	static getInstance(): CachedFileSystem {
		if (!CachedFileSystem.instance) {
			CachedFileSystem.instance = new CachedFileSystem();
		}
		return CachedFileSystem.instance;
	}

	/**
	 * Read file with intelligent caching for configuration and frequently accessed files
	 */
	async readFileWithCache(path: string, forceRefresh: boolean = false): Promise<Result<string, Error>> {
		const timer = this.performanceMonitor.startTimer('cachedFileSystem.readFile');
		
		try {
			// Check cache first unless forced refresh
			if (!forceRefresh) {
				const cached = this.fileCache.get(path);
				if (cached.isSome()) {
					this.performanceMonitor.recordMetric('cachedFileSystem.readFile.cacheHit', 1, 'count');
					return Result.ok(cached.value);
				}
			}

			// Cache miss - read from disk
			this.performanceMonitor.recordMetric('cachedFileSystem.readFile.cacheMiss', 1, 'count');
			
			const result = await Result.tryAsync(async () => {
				const content = await fs.promises.readFile(path, 'utf8');
				return content;
			});

			if (result.isOk) {
				// Cache successful reads for certain file types
				if (this.shouldCache(path)) {
					this.fileCache.set(path, result.value);
				}
			}

			return result;
		} finally {
			timer.end();
		}
	}

	/**
	 * Get file stats with caching
	 */
	async statWithCache(path: string, forceRefresh: boolean = false): Promise<Result<fs.Stats, Error>> {
		const timer = this.performanceMonitor.startTimer('cachedFileSystem.stat');
		
		try {
			// Check cache first unless forced refresh
			if (!forceRefresh) {
				const cached = this.statCache.get(path);
				if (cached.isSome()) {
					this.performanceMonitor.recordMetric('cachedFileSystem.stat.cacheHit', 1, 'count');
					return Result.ok(cached.value);
				}
			}

			// Cache miss - stat from disk
			this.performanceMonitor.recordMetric('cachedFileSystem.stat.cacheMiss', 1, 'count');
			
			const result = await Result.tryAsync(async () => {
				return await fs.promises.stat(path);
			});

			if (result.isOk) {
				this.statCache.set(path, result.value);
			}

			return result;
		} finally {
			timer.end();
		}
	}

	/**
	 * Check if file exists with caching
	 */
	async existsWithCache(path: string): Promise<boolean> {
		const statResult = await this.statWithCache(path);
		return statResult.isOk;
	}

	/**
	 * Invalidate cache for a specific path
	 */
	invalidateCache(path: string): void {
		this.fileCache.delete(path);
		this.statCache.delete(path);
	}

	/**
	 * Clear all caches
	 */
	clearCaches(): void {
		this.fileCache.clear();
		this.statCache.clear();
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats() {
		return {
			fileCache: {
				size: this.fileCache.size,
				maxSize: this.fileCache.maxSize,
				hitRate: this.fileCache.hitRate
			},
			statCache: {
				size: this.statCache.size,
				maxSize: this.statCache.maxSize,
				hitRate: this.statCache.hitRate
			}
		};
	}

	/**
	 * Determine if a file should be cached based on its path and type
	 */
	private shouldCache(path: string): boolean {
		// Cache configuration files, settings, and other frequently accessed files
		const cacheableExtensions = ['.json', '.yml', '.yaml', '.xml', '.properties', '.config'];
		const cacheablePaths = ['settings', 'config', 'package.json', 'tsconfig', '.vscode'];
		
		const lowerPath = path.toLowerCase();
		
		// Check extensions
		if (cacheableExtensions.some(ext => lowerPath.endsWith(ext))) {
			return true;
		}

		// Check path patterns
		if (cacheablePaths.some(pattern => lowerPath.includes(pattern))) {
			return true;
		}

		return false;
	}
}

/**
 * Global cached file system instance for easy access
 */
export const cachedFs = CachedFileSystem.getInstance();

/**
 * Convenience functions for common operations
 */
export namespace CachedFileSystemUtils {
	/**
	 * Read a configuration file with automatic caching
	 */
	export async function readConfigFile(path: string): Promise<Result<string, Error>> {
		return cachedFs.readFileWithCache(path);
	}

	/**
	 * Parse a JSON configuration file with caching
	 */
	export async function readJsonConfig<T = any>(path: string): Promise<Result<T, Error>> {
		const contentResult = await cachedFs.readFileWithCache(path);
		if (contentResult.isError) {
			return Result.error(contentResult.error);
		}

		return Result.try(() => JSON.parse(contentResult.value) as T);
	}

	/**
	 * Watch for configuration file changes and invalidate cache
	 */
	export function watchConfigFile(path: string, callback?: () => void): fs.FSWatcher {
		const watcher = fs.watch(path, () => {
			cachedFs.invalidateCache(path);
			callback?.();
		});

		return watcher;
	}
}