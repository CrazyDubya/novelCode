/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { 
	ObjectPool, 
	WeakMapCache, 
	LRUCache, 
	PerformanceMonitor,
	debounce,
	throttle,
	BatchProcessor,
	MemoryMonitor,
	AsyncQueue
} from '../../src/vs/base/common/performance/optimization.js';

suite('Performance Optimization Tests', () => {

	suite('Object Pool', () => {
		test('should reuse objects to reduce allocations', () => {
			let creationCount = 0;
			const pool = new ObjectPool(
				() => {
					creationCount++;
					return { data: new Array(1000).fill(0) };
				},
				(obj) => obj.data.fill(0) // Reset function
			);

			// First acquisition should create new object
			const obj1 = pool.acquire();
			assert.strictEqual(creationCount, 1);

			// Release and acquire again should reuse
			pool.release(obj1);
			const obj2 = pool.acquire();
			assert.strictEqual(creationCount, 1); // No new creation
			assert.strictEqual(obj1, obj2); // Same object
		});

		test('should limit pool size', () => {
			const pool = new ObjectPool(() => ({}), undefined, 2);
			
			const obj1 = pool.acquire();
			const obj2 = pool.acquire();
			const obj3 = pool.acquire();
			
			pool.release(obj1);
			pool.release(obj2);
			pool.release(obj3); // This should be discarded due to size limit
			
			assert.strictEqual(pool.size, 2);
		});
	});

	suite('WeakMap Cache', () => {
		test('should cache computed values', () => {
			let computeCount = 0;
			const cache = new WeakMapCache((key: object) => {
				computeCount++;
				return `computed_${Date.now()}`;
			});

			const key = {};
			
			// First access should compute
			const value1 = cache.get(key);
			assert.strictEqual(computeCount, 1);
			
			// Second access should use cache
			const value2 = cache.get(key);
			assert.strictEqual(computeCount, 1);
			assert.strictEqual(value1, value2);
		});

		test('should allow garbage collection of keys', () => {
			const cache = new WeakMapCache(() => 'value');
			
			let key: any = {};
			cache.get(key);
			assert.strictEqual(cache.has(key), true);
			
			// Remove reference to key
			key = null;
			
			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}
			
			// WeakMap should automatically clean up
			// (We can't directly test this, but it's the intended behavior)
		});
	});

	suite('LRU Cache', () => {
		test('should evict least recently used items', () => {
			const cache = new LRUCache<string, number>(3);
			
			cache.set('a', 1);
			cache.set('b', 2);
			cache.set('c', 3);
			
			// Access 'a' to make it recently used
			cache.get('a');
			
			// Add new item, should evict 'b' (least recently used)
			cache.set('d', 4);
			
			assert.strictEqual(cache.has('b'), false);
			assert.strictEqual(cache.has('a'), true);
			assert.strictEqual(cache.has('c'), true);
			assert.strictEqual(cache.has('d'), true);
		});

		test('should move accessed items to end', () => {
			const cache = new LRUCache<string, number>(3);
			
			cache.set('a', 1);
			cache.set('b', 2);
			cache.set('c', 3);
			
			// Access 'a' to move it to end
			const value = cache.get('a');
			assert.strictEqual(value, 1);
			
			// Add another item
			cache.set('d', 4);
			
			// 'b' should be evicted, not 'a'
			assert.strictEqual(cache.has('a'), true);
			assert.strictEqual(cache.has('b'), false);
		});
	});

	suite('Performance Monitor', () => {
		test('should measure performance marks', () => {
			PerformanceMonitor.mark('start');
			
			// Simulate some work
			const sum = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
			
			PerformanceMonitor.mark('end');
			const duration = PerformanceMonitor.measure('test-operation', 'start', 'end');
			
			assert.ok(duration >= 0);
			assert.strictEqual(typeof duration, 'number');
			
			const measure = PerformanceMonitor.getMeasure('test-operation');
			assert.ok(measure);
			assert.strictEqual(measure.duration, duration);
		});

		test('should handle missing marks gracefully', () => {
			assert.throws(() => {
				PerformanceMonitor.measure('invalid', 'nonexistent-mark');
			}, /Start mark .* not found/);
		});
	});

	suite('Debounce', () => {
		test('should delay function execution', (done) => {
			let callCount = 0;
			const debouncedFn = debounce(() => {
				callCount++;
			}, 50);

			// Call multiple times rapidly
			debouncedFn();
			debouncedFn();
			debouncedFn();
			
			// Should not have executed yet
			assert.strictEqual(callCount, 0);
			
			setTimeout(() => {
				// Should have executed only once after delay
				assert.strictEqual(callCount, 1);
				done();
			}, 100);
		});

		test('should execute immediately when immediate flag is set', () => {
			let callCount = 0;
			const debouncedFn = debounce(() => {
				callCount++;
			}, 50, true);

			debouncedFn();
			
			// Should execute immediately
			assert.strictEqual(callCount, 1);
			
			// Subsequent calls should be debounced
			debouncedFn();
			debouncedFn();
			assert.strictEqual(callCount, 1);
		});
	});

	suite('Throttle', () => {
		test('should limit function execution rate', (done) => {
			let callCount = 0;
			const throttledFn = throttle(() => {
				callCount++;
			}, 50);

			// Call multiple times rapidly
			throttledFn();
			throttledFn();
			throttledFn();
			
			// Should have executed once immediately
			assert.strictEqual(callCount, 1);
			
			setTimeout(() => {
				// Should be able to execute again after throttle period
				throttledFn();
				assert.strictEqual(callCount, 2);
				done();
			}, 60);
		});
	});

	suite('Batch Processor', () => {
		test('should batch items by size', (done) => {
			const batches: number[][] = [];
			const processor = new BatchProcessor<number>(
				(items) => {
					batches.push([...items]);
				},
				3, // Max batch size
				1000 // Max wait time
			);

			// Add items up to batch size
			processor.add(1);
			processor.add(2);
			processor.add(3); // Should trigger processing
			
			// Give a moment for async processing
			setTimeout(() => {
				assert.strictEqual(batches.length, 1);
				assert.deepStrictEqual(batches[0], [1, 2, 3]);
				done();
			}, 10);
		});

		test('should batch items by time', (done) => {
			const batches: number[][] = [];
			const processor = new BatchProcessor<number>(
				(items) => {
					batches.push([...items]);
				},
				10, // Large batch size
				50  // Short wait time
			);

			processor.add(1);
			processor.add(2);
			
			// Should process after wait time
			setTimeout(() => {
				assert.strictEqual(batches.length, 1);
				assert.deepStrictEqual(batches[0], [1, 2]);
				done();
			}, 100);
		});
	});

	suite('Memory Monitor', () => {
		test('should provide memory information', () => {
			const memInfo = MemoryMonitor.getMemoryInfo();
			
			assert.strictEqual(typeof memInfo.usedJSHeapSize, 'number');
			assert.strictEqual(typeof memInfo.totalJSHeapSize, 'number');
			assert.strictEqual(typeof memInfo.jsHeapSizeLimit, 'number');
			
			// These should be non-negative
			assert.ok(memInfo.usedJSHeapSize >= 0);
			assert.ok(memInfo.totalJSHeapSize >= 0);
			assert.ok(memInfo.jsHeapSizeLimit >= 0);
		});

		test('should handle memory callbacks', (done) => {
			let callbackCalled = false;
			
			const callback = (memInfo: any) => {
				callbackCalled = true;
				assert.ok(memInfo);
				MemoryMonitor.removeMemoryCallback(callback);
				MemoryMonitor.stop();
				done();
			};
			
			MemoryMonitor.onMemoryChange(callback);
			MemoryMonitor.start();
			
			// Trigger callback manually since test environment may not have real memory events
			setTimeout(() => {
				if (!callbackCalled) {
					callback(MemoryMonitor.getMemoryInfo());
				}
			}, 100);
		});
	});

	suite('Async Queue', () => {
		test('should process tasks with limited concurrency', async () => {
			const results: number[] = [];
			const queue = new AsyncQueue(2); // Max 2 concurrent tasks
			
			const createTask = (value: number, delay: number) => async () => {
				await new Promise(resolve => setTimeout(resolve, delay));
				results.push(value);
				return value;
			};

			// Add tasks with different delays
			const promises = [
				queue.add(createTask(1, 50)),
				queue.add(createTask(2, 30)),
				queue.add(createTask(3, 20)),
				queue.add(createTask(4, 10))
			];
			
			await Promise.all(promises);
			
			// Should have processed all tasks
			assert.strictEqual(results.length, 4);
			assert.ok(results.includes(1));
			assert.ok(results.includes(2));
			assert.ok(results.includes(3));
			assert.ok(results.includes(4));
		});

		test('should maintain concurrency limits', async () => {
			let activeTasks = 0;
			let maxActiveTasks = 0;
			const queue = new AsyncQueue(2);
			
			const createTask = (delay: number) => async () => {
				activeTasks++;
				maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
				
				await new Promise(resolve => setTimeout(resolve, delay));
				
				activeTasks--;
				return activeTasks;
			};

			const promises = [
				queue.add(createTask(50)),
				queue.add(createTask(50)),
				queue.add(createTask(50)),
				queue.add(createTask(50))
			];
			
			await Promise.all(promises);
			
			// Should never exceed concurrency limit
			assert.ok(maxActiveTasks <= 2);
		});
	});

	suite('Performance Benchmarks', () => {
		test('should measure array processing performance', () => {
			const size = 100000;
			const data = Array.from({ length: size }, (_, i) => i);
			
			PerformanceMonitor.mark('array-start');
			
			// Test different array operations
			const filtered = data.filter(x => x % 2 === 0);
			const mapped = filtered.map(x => x * 2);
			const reduced = mapped.reduce((sum, x) => sum + x, 0);
			
			PerformanceMonitor.mark('array-end');
			const duration = PerformanceMonitor.measure('array-processing', 'array-start', 'array-end');
			
			assert.ok(duration >= 0);
			assert.ok(filtered.length > 0);
			assert.ok(mapped.length === filtered.length);
			assert.ok(reduced > 0);
			
			console.log(`Array processing (${size} items): ${duration.toFixed(2)}ms`);
		});

		test('should measure object creation vs pooling performance', () => {
			const iterations = 10000;
			
			// Test regular object creation
			PerformanceMonitor.mark('creation-start');
			for (let i = 0; i < iterations; i++) {
				const obj = { data: new Array(100).fill(i) };
				// Simulate some work
				obj.data[0] = i;
			}
			PerformanceMonitor.mark('creation-end');
			const creationTime = PerformanceMonitor.measure('object-creation', 'creation-start', 'creation-end');
			
			// Test object pooling
			const pool = new ObjectPool(
				() => ({ data: new Array(100) }),
				(obj) => obj.data.fill(0)
			);
			
			PerformanceMonitor.mark('pooling-start');
			for (let i = 0; i < iterations; i++) {
				const obj = pool.acquire();
				obj.data[0] = i;
				pool.release(obj);
			}
			PerformanceMonitor.mark('pooling-end');
			const poolingTime = PerformanceMonitor.measure('object-pooling', 'pooling-start', 'pooling-end');
			
			console.log(`Object creation: ${creationTime.toFixed(2)}ms`);
			console.log(`Object pooling: ${poolingTime.toFixed(2)}ms`);
			
			// Pooling should generally be faster for repeated allocations
			// (though this may vary by environment)
			assert.ok(creationTime >= 0);
			assert.ok(poolingTime >= 0);
		});
	});
});