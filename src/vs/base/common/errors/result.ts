/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Result type for better error handling without exceptions
 */
export class Result<T, E = Error> {
	private constructor(
		private readonly _value?: T,
		private readonly _error?: E
	) {}

	/**
	 * Creates a successful result
	 */
	public static ok<T>(value: T): Result<T> {
		return new Result(value);
	}

	/**
	 * Creates an error result
	 */
	public static error<E>(error: E): Result<never, E> {
		return new Result(undefined, error);
	}

	/**
	 * Creates an error result from an Error object
	 */
	public static fromError<T>(error: Error): Result<T, Error> {
		return new Result(undefined, error);
	}

	/**
	 * Wraps a function that might throw and returns a Result
	 */
	public static try<T>(fn: () => T): Result<T, Error> {
		try {
			return Result.ok(fn());
		} catch (error) {
			return Result.error(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Wraps an async function that might throw and returns a Result
	 */
	public static async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
		try {
			const value = await fn();
			return Result.ok(value);
		} catch (error) {
			return Result.error(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Checks if this is a successful result
	 */
	public isOk(): this is Result<T, never> {
		return this._error === undefined;
	}

	/**
	 * Checks if this is an error result
	 */
	public isError(): this is Result<never, E> {
		return this._error !== undefined;
	}

	/**
	 * Gets the value from a successful result
	 * @throws Error if called on an error result
	 */
	public getValue(): T {
		if (this._error !== undefined) {
			throw new Error('Attempted to get value from error result');
		}
		return this._value!;
	}

	/**
	 * Gets the error from an error result
	 * @throws Error if called on a successful result
	 */
	public getError(): E {
		if (this._error === undefined) {
			throw new Error('Attempted to get error from ok result');
		}
		return this._error;
	}

	/**
	 * Gets the value or returns a default value
	 */
	public getValueOrDefault(defaultValue: T): T {
		return this.isOk() ? this.getValue() : defaultValue;
	}

	/**
	 * Gets the value or undefined
	 */
	public getValueOrUndefined(): T | undefined {
		return this.isOk() ? this.getValue() : undefined;
	}

	/**
	 * Maps the value if this is a successful result
	 */
	public map<U>(fn: (value: T) => U): Result<U, E> {
		if (this.isOk()) {
			return Result.ok(fn(this.getValue()));
		}
		return Result.error(this.getError());
	}

	/**
	 * Maps the value if this is a successful result, allowing the mapper to return a Result
	 */
	public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
		if (this.isOk()) {
			return fn(this.getValue());
		}
		return Result.error(this.getError());
	}

	/**
	 * Maps the error if this is an error result
	 */
	public mapError<F>(fn: (error: E) => F): Result<T, F> {
		if (this.isError()) {
			return Result.error(fn(this.getError()));
		}
		return Result.ok(this.getValue());
	}

	/**
	 * Executes a function if this is a successful result
	 */
	public onOk(fn: (value: T) => void): this {
		if (this.isOk()) {
			fn(this.getValue());
		}
		return this;
	}

	/**
	 * Executes a function if this is an error result
	 */
	public onError(fn: (error: E) => void): this {
		if (this.isError()) {
			fn(this.getError());
		}
		return this;
	}

	/**
	 * Converts to a Promise, rejecting if this is an error result
	 */
	public toPromise(): Promise<T> {
		if (this.isOk()) {
			return Promise.resolve(this.getValue());
		}
		return Promise.reject(this.getError());
	}

	/**
	 * Converts from a Promise to a Result
	 */
	public static async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
		try {
			const value = await promise;
			return Result.ok(value);
		} catch (error) {
			return Result.error(error instanceof Error ? error : new Error(String(error)));
		}
	}
}

/**
 * Option type for values that may or may not exist
 */
export class Option<T> {
	private constructor(private readonly _value?: T) {}

	/**
	 * Creates an Option with a value
	 */
	public static some<T>(value: T): Option<T> {
		return new Option(value);
	}

	/**
	 * Creates an empty Option
	 */
	public static none<T>(): Option<T> {
		return new Option<T>();
	}

	/**
	 * Creates an Option from a nullable value
	 */
	public static fromNullable<T>(value: T | null | undefined): Option<T> {
		return value != null ? Option.some(value) : Option.none();
	}

	/**
	 * Checks if this Option has a value
	 */
	public isSome(): this is Option<T> {
		return this._value !== undefined;
	}

	/**
	 * Checks if this Option is empty
	 */
	public isNone(): boolean {
		return this._value === undefined;
	}

	/**
	 * Gets the value
	 * @throws Error if Option is empty
	 */
	public getValue(): T {
		if (this._value === undefined) {
			throw new Error('Attempted to get value from empty Option');
		}
		return this._value;
	}

	/**
	 * Gets the value or returns a default value
	 */
	public getValueOrDefault(defaultValue: T): T {
		return this._value !== undefined ? this._value : defaultValue;
	}

	/**
	 * Gets the value or undefined
	 */
	public getValueOrUndefined(): T | undefined {
		return this._value;
	}

	/**
	 * Maps the value if present
	 */
	public map<U>(fn: (value: T) => U): Option<U> {
		if (this.isSome()) {
			return Option.some(fn(this.getValue()));
		}
		return Option.none();
	}

	/**
	 * Maps the value if present, allowing the mapper to return an Option
	 */
	public flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
		if (this.isSome()) {
			return fn(this.getValue());
		}
		return Option.none();
	}

	/**
	 * Filters the Option based on a predicate
	 */
	public filter(predicate: (value: T) => boolean): Option<T> {
		if (this.isSome() && predicate(this.getValue())) {
			return this;
		}
		return Option.none();
	}

	/**
	 * Executes a function if the Option has a value
	 */
	public onSome(fn: (value: T) => void): this {
		if (this.isSome()) {
			fn(this.getValue());
		}
		return this;
	}

	/**
	 * Executes a function if the Option is empty
	 */
	public onNone(fn: () => void): this {
		if (this.isNone()) {
			fn();
		}
		return this;
	}

	/**
	 * Converts to an array (empty array if None, single-element array if Some)
	 */
	public toArray(): T[] {
		return this.isSome() ? [this.getValue()] : [];
	}

	/**
	 * Converts to a Result (Error if None, Ok if Some)
	 */
	public toResult(error: Error): Result<T, Error> {
		return this.isSome() ? Result.ok(this.getValue()) : Result.error(error);
	}
}

/**
 * Enhanced error types for better error handling
 */
export abstract class BaseError extends Error {
	public readonly timestamp: Date;
	public readonly context?: Record<string, any>;

	constructor(
		message: string,
		public readonly code: string,
		context?: Record<string, any>
	) {
		super(message);
		this.name = this.constructor.name;
		this.timestamp = new Date();
		this.context = context;
		
		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Converts the error to a plain object for serialization
	 */
	public toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			timestamp: this.timestamp.toISOString(),
			context: this.context,
			stack: this.stack
		};
	}
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends BaseError {
	constructor(
		message: string,
		public readonly field: string,
		public readonly value: any,
		context?: Record<string, any>
	) {
		super(message, 'VALIDATION_ERROR', { field, value, ...context });
	}
}

/**
 * Security error for security-related failures
 */
export class SecurityError extends BaseError {
	constructor(
		message: string,
		public readonly securityContext: string,
		context?: Record<string, any>
	) {
		super(message, 'SECURITY_ERROR', { securityContext, ...context });
	}
}

/**
 * Network error for network-related failures
 */
export class NetworkError extends BaseError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly url?: string,
		context?: Record<string, any>
	) {
		super(message, 'NETWORK_ERROR', { statusCode, url, ...context });
	}
}

/**
 * File system error for file operation failures
 */
export class FileSystemError extends BaseError {
	constructor(
		message: string,
		public readonly path: string,
		public readonly operation: string,
		context?: Record<string, any>
	) {
		super(message, 'FILESYSTEM_ERROR', { path, operation, ...context });
	}
}

/**
 * Configuration error for configuration-related failures
 */
export class ConfigurationError extends BaseError {
	constructor(
		message: string,
		public readonly configKey: string,
		context?: Record<string, any>
	) {
		super(message, 'CONFIGURATION_ERROR', { configKey, ...context });
	}
}