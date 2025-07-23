/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Result type for safer error handling without exceptions
 */
export abstract class Result<T, E = Error> {
	abstract readonly isOk: boolean;
	abstract readonly isError: boolean;

	/**
	 * Create a successful result
	 */
	static ok<T, E = Error>(value: T): Result<T, E> {
		return new Ok(value);
	}

	/**
	 * Create an error result
	 */
	static error<T, E = Error>(error: E): Result<T, E> {
		return new Err(error);
	}

	/**
	 * Try to execute a function and wrap result/error
	 */
	static try<T>(fn: () => T): Result<T, Error> {
		try {
			return Result.ok(fn());
		} catch (error) {
			return Result.error(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Try to execute an async function and wrap result/error
	 */
	static async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
		try {
			const value = await fn();
			return Result.ok(value);
		} catch (error) {
			return Result.error(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Get the value if Ok, throw if Error
	 */
	abstract unwrap(): T;

	/**
	 * Get the value if Ok, return default if Error
	 */
	abstract unwrapOr(defaultValue: T): T;

	/**
	 * Get the error if Error, throw if Ok
	 */
	abstract unwrapError(): E;

	/**
	 * Map the Ok value to a new value
	 */
	abstract map<U>(fn: (value: T) => U): Result<U, E>;

	/**
	 * Map the Error value to a new error
	 */
	abstract mapError<F>(fn: (error: E) => F): Result<T, F>;

	/**
	 * Chain operations that return Results
	 */
	abstract flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;

	/**
	 * Execute a function if Ok, do nothing if Error
	 */
	abstract ifOk(fn: (value: T) => void): Result<T, E>;

	/**
	 * Execute a function if Error, do nothing if Ok
	 */
	abstract ifError(fn: (error: E) => void): Result<T, E>;
}

class Ok<T, E> extends Result<T, E> {
	readonly isOk = true;
	readonly isError = false;

	constructor(private readonly value: T) {
		super();
	}

	unwrap(): T {
		return this.value;
	}

	unwrapOr(_defaultValue: T): T {
		return this.value;
	}

	unwrapError(): E {
		throw new Error('Called unwrapError on Ok value');
	}

	map<U>(fn: (value: T) => U): Result<U, E> {
		return Result.ok(fn(this.value));
	}

	mapError<F>(_fn: (error: E) => F): Result<T, F> {
		return Result.ok(this.value);
	}

	flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
		return fn(this.value);
	}

	ifOk(fn: (value: T) => void): Result<T, E> {
		fn(this.value);
		return this;
	}

	ifError(_fn: (error: E) => void): Result<T, E> {
		return this;
	}
}

class Err<T, E> extends Result<T, E> {
	readonly isOk = false;
	readonly isError = true;

	constructor(private readonly error: E) {
		super();
	}

	unwrap(): T {
		throw new Error(`Called unwrap on Error: ${this.error}`);
	}

	unwrapOr(defaultValue: T): T {
		return defaultValue;
	}

	unwrapError(): E {
		return this.error;
	}

	map<U>(_fn: (value: T) => U): Result<U, E> {
		return Result.error(this.error);
	}

	mapError<F>(fn: (error: E) => F): Result<T, F> {
		return Result.error(fn(this.error));
	}

	flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
		return Result.error(this.error);
	}

	ifOk(_fn: (value: T) => void): Result<T, E> {
		return this;
	}

	ifError(fn: (error: E) => void): Result<T, E> {
		fn(this.error);
		return this;
	}
}

/**
 * Option type for safer null/undefined handling
 */
export abstract class Option<T> {
	abstract readonly isSome: boolean;
	abstract readonly isNone: boolean;

	/**
	 * Create a Some option
	 */
	static some<T>(value: T): Option<T> {
		return new Some(value);
	}

	/**
	 * Create a None option
	 */
	static none<T>(): Option<T> {
		return new None<T>();
	}

	/**
	 * Create option from nullable value
	 */
	static from<T>(value: T | null | undefined): Option<T> {
		return value != null ? Option.some(value) : Option.none();
	}

	/**
	 * Get the value if Some, throw if None
	 */
	abstract unwrap(): T;

	/**
	 * Get the value if Some, return default if None
	 */
	abstract unwrapOr(defaultValue: T): T;

	/**
	 * Map the Some value to a new value
	 */
	abstract map<U>(fn: (value: T) => U): Option<U>;

	/**
	 * Chain operations that return Options
	 */
	abstract flatMap<U>(fn: (value: T) => Option<U>): Option<U>;

	/**
	 * Filter the value
	 */
	abstract filter(predicate: (value: T) => boolean): Option<T>;

	/**
	 * Execute a function if Some, do nothing if None
	 */
	abstract ifSome(fn: (value: T) => void): Option<T>;

	/**
	 * Execute a function if None, do nothing if Some
	 */
	abstract ifNone(fn: () => void): Option<T>;

	/**
	 * Convert to Result
	 */
	abstract okOr<E>(error: E): Result<T, E>;
}

class Some<T> extends Option<T> {
	readonly isSome = true;
	readonly isNone = false;

	constructor(private readonly value: T) {
		super();
	}

	unwrap(): T {
		return this.value;
	}

	unwrapOr(_defaultValue: T): T {
		return this.value;
	}

	map<U>(fn: (value: T) => U): Option<U> {
		return Option.some(fn(this.value));
	}

	flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
		return fn(this.value);
	}

	filter(predicate: (value: T) => boolean): Option<T> {
		return predicate(this.value) ? this : Option.none();
	}

	ifSome(fn: (value: T) => void): Option<T> {
		fn(this.value);
		return this;
	}

	ifNone(_fn: () => void): Option<T> {
		return this;
	}

	okOr<E>(_error: E): Result<T, E> {
		return Result.ok(this.value);
	}
}

class None<T> extends Option<T> {
	readonly isSome = false;
	readonly isNone = true;

	unwrap(): T {
		throw new Error('Called unwrap on None');
	}

	unwrapOr(defaultValue: T): T {
		return defaultValue;
	}

	map<U>(_fn: (value: T) => U): Option<U> {
		return Option.none();
	}

	flatMap<U>(_fn: (value: T) => Option<U>): Option<U> {
		return Option.none();
	}

	filter(_predicate: (value: T) => boolean): Option<T> {
		return this;
	}

	ifSome(_fn: (value: T) => void): Option<T> {
		return this;
	}

	ifNone(fn: () => void): Option<T> {
		fn();
		return this;
	}

	okOr<E>(error: E): Result<T, E> {
		return Result.error(error);
	}
}

/**
 * Error types for better error categorization
 */
export abstract class BaseError extends Error {
	abstract readonly type: string;
	abstract readonly severity: ErrorSeverity;

	constructor(message: string, public readonly context?: Record<string, any>) {
		super(message);
		this.name = this.constructor.name;
	}
}

export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export class ValidationError extends BaseError {
	readonly type = 'VALIDATION_ERROR';
	readonly severity = ErrorSeverity.MEDIUM;

	constructor(message: string, public readonly field?: string, context?: Record<string, any>) {
		super(message, context);
	}
}

export class SecurityError extends BaseError {
	readonly type = 'SECURITY_ERROR';
	readonly severity = ErrorSeverity.HIGH;

	constructor(message: string, context?: Record<string, any>) {
		super(message, context);
	}
}

export class NetworkError extends BaseError {
	readonly type = 'NETWORK_ERROR';
	readonly severity = ErrorSeverity.MEDIUM;

	constructor(message: string, public readonly statusCode?: number, context?: Record<string, any>) {
		super(message, context);
	}
}

export class FileSystemError extends BaseError {
	readonly type = 'FILESYSTEM_ERROR';
	readonly severity = ErrorSeverity.MEDIUM;

	constructor(message: string, public readonly path?: string, context?: Record<string, any>) {
		super(message, context);
	}
}

export class ConfigurationError extends BaseError {
	readonly type = 'CONFIGURATION_ERROR';
	readonly severity = ErrorSeverity.MEDIUM;

	constructor(message: string, public readonly setting?: string, context?: Record<string, any>) {
		super(message, context);
	}
}

/**
 * Central error handler for the application
 */
export class ErrorHandler {
	private static instance: ErrorHandler;
	private errorListeners: ((error: BaseError) => void)[] = [];

	static getInstance(): ErrorHandler {
		if (!ErrorHandler.instance) {
			ErrorHandler.instance = new ErrorHandler();
		}
		return ErrorHandler.instance;
	}

	/**
	 * Register an error listener
	 */
	onError(listener: (error: BaseError) => void): void {
		this.errorListeners.push(listener);
	}

	/**
	 * Handle an error
	 */
	handleError(error: Error | BaseError, context?: Record<string, any>): void {
		let baseError: BaseError;

		if (error instanceof BaseError) {
			baseError = error;
		} else {
			// Convert regular Error to BaseError
			baseError = new (class extends BaseError {
				readonly type = 'UNKNOWN_ERROR';
				readonly severity = ErrorSeverity.MEDIUM;
			})(error.message, context);
		}

		// Notify listeners
		this.errorListeners.forEach(listener => {
			try {
				listener(baseError);
			} catch (listenerError) {
				console.error('Error in error listener:', listenerError);
			}
		});

		// Log based on severity
		this.logError(baseError);
	}

	private logError(error: BaseError): void {
		const logMessage = `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`;
		const logContext = {
			type: error.type,
			severity: error.severity,
			context: error.context,
			stack: error.stack
		};

		switch (error.severity) {
			case ErrorSeverity.CRITICAL:
				console.error(logMessage, logContext);
				break;
			case ErrorSeverity.HIGH:
				console.error(logMessage, logContext);
				break;
			case ErrorSeverity.MEDIUM:
				console.warn(logMessage, logContext);
				break;
			case ErrorSeverity.LOW:
				console.info(logMessage, logContext);
				break;
		}
	}
}

/**
 * Utility functions for error handling
 */
export namespace ErrorUtils {
	
	/**
	 * Wrap a function to handle errors with Result type
	 */
	export function wrap<T, Args extends any[]>(
		fn: (...args: Args) => T
	): (...args: Args) => Result<T, Error> {
		return (...args: Args) => Result.try(() => fn(...args));
	}

	/**
	 * Wrap an async function to handle errors with Result type
	 */
	export function wrapAsync<T, Args extends any[]>(
		fn: (...args: Args) => Promise<T>
	): (...args: Args) => Promise<Result<T, Error>> {
		return async (...args: Args) => Result.tryAsync(() => fn(...args));
	}

	/**
	 * Create a retry wrapper for functions
	 */
	export function withRetry<T>(
		fn: () => Result<T, Error>,
		maxRetries: number = 3,
		delay: number = 1000
	): Promise<Result<T, Error>> {
		return new Promise((resolve) => {
			let attempt = 0;

			const tryFn = () => {
				const result = fn();
				if (result.isOk || attempt >= maxRetries) {
					resolve(result);
				} else {
					attempt++;
					setTimeout(tryFn, delay * attempt);
				}
			};

			tryFn();
		});
	}

	/**
	 * Combine multiple Results into one
	 */
	export function combine<T>(results: Result<T, Error>[]): Result<T[], Error> {
		const values: T[] = [];
		
		for (const result of results) {
			if (result.isError) {
				return result.mapError(e => e);
			}
			values.push(result.unwrap());
		}
		
		return Result.ok(values);
	}
}