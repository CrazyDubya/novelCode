/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Enhanced performance monitoring utilities for measuring and tracking application performance
 * This extends the basic performance module with more advanced monitoring capabilities
 */

export interface IPerformanceMetric {
	readonly name: string;
	readonly value: number;
	readonly unit: string;
	readonly timestamp: number;
	readonly metadata?: Record<string, any>;
}

export interface IPerformanceTimer {
	readonly name: string;
	readonly startTime: number;
	end(): number;
}

export interface IPerformanceThreshold {
	readonly warning: number;
	readonly critical: number;
}

/**
 * Enhanced performance monitoring service for tracking metrics and timers
 */
export class EnhancedPerformanceMonitor {
	private static instance: EnhancedPerformanceMonitor;
	private metrics: Map<string, IPerformanceMetric[]> = new Map();
	private thresholds: Map<string, IPerformanceThreshold> = new Map();
	private listeners: ((metric: IPerformanceMetric) => void)[] = [];
	private readonly maxMetricsPerType = 1000;

	static getInstance(): EnhancedPerformanceMonitor {
		if (!EnhancedPerformanceMonitor.instance) {
			EnhancedPerformanceMonitor.instance = new EnhancedPerformanceMonitor();
		}
		return EnhancedPerformanceMonitor.instance;
	}

	/**
	 * Start a performance timer
	 */
	startTimer(name: string): IPerformanceTimer {
		const startTime = performance.now();
		
		return {
			name,
			startTime,
			end: () => {
				const duration = performance.now() - startTime;
				this.recordMetric(name, duration, 'ms');
				return duration;
			}
		};
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(name: string, value: number, unit: string = 'ms', metadata?: Record<string, any>): void {
		const metric: IPerformanceMetric = {
			name,
			value,
			unit,
			timestamp: Date.now(),
			metadata
		};

		// Store metric
		const existingMetrics = this.metrics.get(name) || [];
		existingMetrics.push(metric);

		// Limit storage to prevent memory issues
		if (existingMetrics.length > this.maxMetricsPerType) {
			existingMetrics.shift();
		}

		this.metrics.set(name, existingMetrics);

		// Check thresholds
		this.checkThreshold(metric);

		// Notify listeners
		this.listeners.forEach(listener => {
			try {
				listener(metric);
			} catch (error) {
				console.error('Error in performance metric listener:', error);
			}
		});
	}

	/**
	 * Set performance thresholds for alerts
	 */
	setThreshold(name: string, warning: number, critical: number): void {
		this.thresholds.set(name, { warning, critical });
	}

	/**
	 * Get metrics for a specific name
	 */
	getMetrics(name: string): IPerformanceMetric[] {
		return [...(this.metrics.get(name) || [])];
	}

	/**
	 * Get all metric names
	 */
	getMetricNames(): string[] {
		return Array.from(this.metrics.keys());
	}

	/**
	 * Get average value for a metric
	 */
	getAverage(name: string, timeWindow?: number): number {
		const metrics = this.getMetricsInWindow(name, timeWindow);
		if (metrics.length === 0) return 0;

		const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
		return sum / metrics.length;
	}

	/**
	 * Get percentile value for a metric
	 */
	getPercentile(name: string, percentile: number, timeWindow?: number): number {
		const metrics = this.getMetricsInWindow(name, timeWindow);
		if (metrics.length === 0) return 0;

		const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * sorted.length) - 1;
		return sorted[Math.max(0, index)];
	}

	/**
	 * Register a listener for performance metrics
	 */
	onMetric(listener: (metric: IPerformanceMetric) => void): void {
		this.listeners.push(listener);
	}

	/**
	 * Get performance summary
	 */
	getSummary(timeWindow?: number): Record<string, {
		count: number;
		average: number;
		min: number;
		max: number;
		p50: number;
		p95: number;
		p99: number;
	}> {
		const summary: Record<string, any> = {};

		for (const name of this.getMetricNames()) {
			const metrics = this.getMetricsInWindow(name, timeWindow);
			if (metrics.length === 0) continue;

			const values = metrics.map(m => m.value);
			summary[name] = {
				count: metrics.length,
				average: this.getAverage(name, timeWindow),
				min: Math.min(...values),
				max: Math.max(...values),
				p50: this.getPercentile(name, 50, timeWindow),
				p95: this.getPercentile(name, 95, timeWindow),
				p99: this.getPercentile(name, 99, timeWindow)
			};
		}

		return summary;
	}

	private getMetricsInWindow(name: string, timeWindow?: number): IPerformanceMetric[] {
		const metrics = this.metrics.get(name) || [];
		if (!timeWindow) return metrics;

		const cutoff = Date.now() - timeWindow;
		return metrics.filter(metric => metric.timestamp >= cutoff);
	}

	private checkThreshold(metric: IPerformanceMetric): void {
		const threshold = this.thresholds.get(metric.name);
		if (!threshold) return;

		if (metric.value >= threshold.critical) {
			console.error(`CRITICAL: Performance metric ${metric.name} exceeded critical threshold: ${metric.value}${metric.unit} >= ${threshold.critical}${metric.unit}`);
		} else if (metric.value >= threshold.warning) {
			console.warn(`WARNING: Performance metric ${metric.name} exceeded warning threshold: ${metric.value}${metric.unit} >= ${threshold.warning}${metric.unit}`);
		}
	}
}

/**
 * Performance decorators for easy method timing
 */
export function measurePerformance(metricName?: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const name = metricName || `${target.constructor.name}.${propertyKey}`;

		descriptor.value = function (...args: any[]) {
			const timer = EnhancedPerformanceMonitor.getInstance().startTimer(name);
			try {
				const result = originalMethod.apply(this, args);
				
				// Handle async methods
				if (result && typeof result.then === 'function') {
					return result.finally(() => timer.end());
				} else {
					timer.end();
					return result;
				}
			} catch (error) {
				timer.end();
				throw error;
			}
		};

		return descriptor;
	};
}

/**
 * Bundle size monitoring for web applications
 */
export class BundleMonitor {
	private static loadTimes: Map<string, number> = new Map();

	/**
	 * Record bundle load time
	 */
	static recordBundleLoad(bundleName: string, startTime: number): void {
		const loadTime = performance.now() - startTime;
		this.loadTimes.set(bundleName, loadTime);
		
		EnhancedPerformanceMonitor.getInstance().recordMetric(
			`bundle.load.${bundleName}`,
			loadTime,
			'ms'
		);
	}

	/**
	 * Get all bundle load times
	 */
	static getBundleLoadTimes(): Record<string, number> {
		return Object.fromEntries(this.loadTimes);
	}

	/**
	 * Monitor dynamic imports
	 */
	static wrapDynamicImport<T>(importPromise: Promise<T>, bundleName: string): Promise<T> {
		const startTime = performance.now();
		
		return importPromise.then(module => {
			this.recordBundleLoad(bundleName, startTime);
			return module;
		}).catch(error => {
			EnhancedPerformanceMonitor.getInstance().recordMetric(
				`bundle.error.${bundleName}`,
				performance.now() - startTime,
				'ms',
				{ error: error.message }
			);
			throw error;
		});
	}
}

// Global performance utilities
export const enhancedPerf = {
	monitor: EnhancedPerformanceMonitor.getInstance(),
	bundle: BundleMonitor,
	
	/**
	 * Quick timer utility
	 */
	time: (name: string) => EnhancedPerformanceMonitor.getInstance().startTimer(name),
	
	/**
	 * Record a metric quickly
	 */
	record: (name: string, value: number, unit?: string) => 
		EnhancedPerformanceMonitor.getInstance().recordMetric(name, value, unit)
};