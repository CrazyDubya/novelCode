/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Performance monitoring and optimization utilities
 */

/**
 * Object pool for reusing expensive objects to reduce garbage collection
 */
export class ObjectPool<T> {
	private readonly pool: T[] = [];
	private readonly createFn: () => T;
	private readonly resetFn?: (obj: T) => void;
	private readonly maxSize: number;

	constructor(createFn: () => T, resetFn?: (obj: T) => void, maxSize: number = 100) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.maxSize = maxSize;
	}

	acquire(): T {
		const obj = this.pool.pop();
		if (obj) {
			return obj;
		}
		return this.createFn();
	}

	release(obj: T): void {
		if (this.pool.length < this.maxSize) {
			if (this.resetFn) {
				this.resetFn(obj);
			}
			this.pool.push(obj);
		}
	}

	clear(): void {
		this.pool.length = 0;
	}

	get size(): number {
		return this.pool.length;
	}
}

/**
 * Memory-efficient cache with automatic cleanup
 */
export class WeakMapCache<K extends object, V> {
	private readonly cache = new WeakMap<K, V>();
	private readonly computeFn: (key: K) => V;

	constructor(computeFn: (key: K) => V) {
		this.computeFn = computeFn;
	}

	get(key: K): V {
		let value = this.cache.get(key);
		if (value === undefined) {
			value = this.computeFn(key);
			this.cache.set(key, value);
		}
		return value;
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}
}

/**
 * LRU Cache implementation for better memory management
 */
export class LRUCache<K, V> {
	private readonly maxSize: number;
	private readonly cache = new Map<K, V>();

	constructor(maxSize: number = 1000) {
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove least recently used (first item)
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}
		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
	private static readonly marks = new Map<string, number>();
	private static readonly measures = new Map<string, { duration: number; timestamp: number }>();

	static mark(name: string): void {
		this.marks.set(name, performance.now());
	}

	static measure(name: string, startMark: string, endMark?: string): number {
		const startTime = this.marks.get(startMark);
		if (startTime === undefined) {
			throw new Error(`Start mark '${startMark}' not found`);
		}

		const endTime = endMark ? this.marks.get(endMark) : performance.now();
		if (endTime === undefined) {
			throw new Error(`End mark '${endMark}' not found`);
		}

		const duration = endTime - startTime;
		this.measures.set(name, { duration, timestamp: Date.now() });
		return duration;
	}

	static getMeasure(name: string): { duration: number; timestamp: number } | undefined {
		return this.measures.get(name);
	}

	static getAllMeasures(): Map<string, { duration: number; timestamp: number }> {
		return new Map(this.measures);
	}

	static clearMarks(): void {
		this.marks.clear();
	}

	static clearMeasures(): void {
		this.measures.clear();
	}

	static clearAll(): void {
		this.clearMarks();
		this.clearMeasures();
	}
}

/**
 * Debounce utility for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate?: boolean
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | number | undefined;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = undefined;
			if (!immediate) func(...args);
		};

		const callNow = immediate && !timeout;
		clearTimeout(timeout as any);
		timeout = setTimeout(later, wait);

		if (callNow) func(...args);
	};
}

/**
 * Throttle utility for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;

	return function executedFunction(...args: Parameters<T>) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * Batch processing utility for better performance
 */
export class BatchProcessor<T> {
	private readonly items: T[] = [];
	private readonly processFn: (items: T[]) => void | Promise<void>;
	private readonly maxBatchSize: number;
	private readonly maxWaitTime: number;
	private timeout: NodeJS.Timeout | number | undefined;

	constructor(
		processFn: (items: T[]) => void | Promise<void>,
		maxBatchSize: number = 100,
		maxWaitTime: number = 100
	) {
		this.processFn = processFn;
		this.maxBatchSize = maxBatchSize;
		this.maxWaitTime = maxWaitTime;
	}

	add(item: T): void {
		this.items.push(item);

		if (this.items.length >= this.maxBatchSize) {
			this.flush();
		} else if (this.items.length === 1) {
			// Start timer on first item
			this.timeout = setTimeout(() => this.flush(), this.maxWaitTime);
		}
	}

	flush(): void {
		if (this.timeout) {
			clearTimeout(this.timeout as any);
			this.timeout = undefined;
		}

		if (this.items.length === 0) {
			return;
		}

		const itemsToProcess = this.items.splice(0);
		this.processFn(itemsToProcess);
	}

	get pendingCount(): number {
		return this.items.length;
	}
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
	private static readonly memoryCheckInterval = 30000; // 30 seconds
	private static interval: NodeJS.Timeout | number | undefined;
	private static readonly callbacks: ((info: MemoryInfo) => void)[] = [];

	static start(): void {
		if (this.interval) {
			return; // Already started
		}

		this.interval = setInterval(() => {
			const memInfo = this.getMemoryInfo();
			this.callbacks.forEach(callback => {
				try {
					callback(memInfo);
				} catch (error) {
					console.error('Memory monitor callback error:', error);
				}
			});
		}, this.memoryCheckInterval);
	}

	static stop(): void {
		if (this.interval) {
			clearInterval(this.interval as any);
			this.interval = undefined;
		}
	}

	static getMemoryInfo(): MemoryInfo {
		if (typeof performance !== 'undefined' && 'memory' in performance) {
			return (performance as any).memory;
		}

		// Fallback for environments without performance.memory
		return {
			usedJSHeapSize: 0,
			totalJSHeapSize: 0,
			jsHeapSizeLimit: 0
		};
	}

	static onMemoryChange(callback: (info: MemoryInfo) => void): void {
		this.callbacks.push(callback);
	}

	static removeMemoryCallback(callback: (info: MemoryInfo) => void): void {
		const index = this.callbacks.indexOf(callback);
		if (index >= 0) {
			this.callbacks.splice(index, 1);
		}
	}
}

export interface MemoryInfo {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

/**
 * Async queue for managing concurrent operations
 */
export class AsyncQueue {
	private readonly queue: (() => Promise<any>)[] = [];
	private readonly concurrency: number;
	private running = 0;

	constructor(concurrency: number = 1) {
		this.concurrency = concurrency;
	}

	async add<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const wrappedTask = async () => {
				try {
					const result = await task();
					resolve(result);
				} catch (error) {
					reject(error);
				}
			};

			this.queue.push(wrappedTask);
			this.process();
		});
	}

	private async process(): Promise<void> {
		if (this.running >= this.concurrency || this.queue.length === 0) {
			return;
		}

		this.running++;
		const task = this.queue.shift()!;

		try {
			await task();
		} finally {
			this.running--;
			this.process(); // Process next task
		}
	}

	get pending(): number {
		return this.queue.length;
	}

	get activeCount(): number {
		return this.running;
	}
}