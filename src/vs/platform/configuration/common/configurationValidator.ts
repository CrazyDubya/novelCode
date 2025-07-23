/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Result, ValidationError } from '../../../base/common/errors/result.js';

/**
 * Configuration validation utilities for enhanced security and type safety
 */

export interface ConfigurationSchema {
	readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	readonly required?: boolean;
	readonly default?: any;
	readonly min?: number;
	readonly max?: number;
	readonly pattern?: RegExp;
	readonly items?: ConfigurationSchema;
	readonly properties?: Record<string, ConfigurationSchema>;
	readonly enum?: readonly any[];
	readonly description?: string;
}

export interface ConfigurationValidationResult {
	readonly isValid: boolean;
	readonly value?: any;
	readonly errors: string[];
}

/**
 * Configuration validator with comprehensive validation rules
 */
export class ConfigurationValidator {
	
	/**
	 * Validate a configuration value against a schema
	 */
	static validate(value: any, schema: ConfigurationSchema, path: string = ''): ConfigurationValidationResult {
		const errors: string[] = [];
		let validatedValue = value;

		// Handle undefined/null values
		if (value === undefined || value === null) {
			if (schema.required) {
				errors.push(`${path || 'value'} is required`);
				return { isValid: false, errors };
			}
			if (schema.default !== undefined) {
				validatedValue = schema.default;
			}
			return { isValid: true, value: validatedValue, errors: [] };
		}

		// Type validation
		const typeValidation = this.validateType(value, schema.type, path);
		if (!typeValidation.isValid) {
			errors.push(...typeValidation.errors);
			return { isValid: false, errors };
		}

		// Specific validations based on type
		switch (schema.type) {
			case 'string':
				const stringValidation = this.validateString(value, schema, path);
				errors.push(...stringValidation.errors);
				if (stringValidation.value !== undefined) {
					validatedValue = stringValidation.value;
				}
				break;

			case 'number':
				const numberValidation = this.validateNumber(value, schema, path);
				errors.push(...numberValidation.errors);
				break;

			case 'array':
				const arrayValidation = this.validateArray(value, schema, path);
				errors.push(...arrayValidation.errors);
				if (arrayValidation.value !== undefined) {
					validatedValue = arrayValidation.value;
				}
				break;

			case 'object':
				const objectValidation = this.validateObject(value, schema, path);
				errors.push(...objectValidation.errors);
				if (objectValidation.value !== undefined) {
					validatedValue = objectValidation.value;
				}
				break;
		}

		// Enum validation
		if (schema.enum && !schema.enum.includes(value)) {
			errors.push(`${path || 'value'} must be one of: ${schema.enum.join(', ')}`);
		}

		return {
			isValid: errors.length === 0,
			value: validatedValue,
			errors
		};
	}

	private static validateType(value: any, expectedType: string, path: string): ConfigurationValidationResult {
		const actualType = Array.isArray(value) ? 'array' : typeof value;
		
		if (actualType !== expectedType) {
			return {
				isValid: false,
				errors: [`${path || 'value'} must be of type ${expectedType}, got ${actualType}`]
			};
		}

		return { isValid: true, errors: [] };
	}

	private static validateString(value: string, schema: ConfigurationSchema, path: string): ConfigurationValidationResult {
		const errors: string[] = [];
		let validatedValue = value;

		// Length validation
		if (schema.min !== undefined && value.length < schema.min) {
			errors.push(`${path || 'value'} must be at least ${schema.min} characters long`);
		}
		if (schema.max !== undefined && value.length > schema.max) {
			errors.push(`${path || 'value'} must be at most ${schema.max} characters long`);
		}

		// Pattern validation
		if (schema.pattern && !schema.pattern.test(value)) {
			errors.push(`${path || 'value'} does not match required pattern`);
		}

		// Sanitization for security
		if (value.includes('<script>') || value.includes('javascript:')) {
			validatedValue = value.replace(/<script[^>]*>.*?<\/script>/gi, '')
				.replace(/javascript:/gi, '');
		}

		return { isValid: errors.length === 0, value: validatedValue, errors };
	}

	private static validateNumber(value: number, schema: ConfigurationSchema, path: string): ConfigurationValidationResult {
		const errors: string[] = [];

		// Range validation
		if (schema.min !== undefined && value < schema.min) {
			errors.push(`${path || 'value'} must be at least ${schema.min}`);
		}
		if (schema.max !== undefined && value > schema.max) {
			errors.push(`${path || 'value'} must be at most ${schema.max}`);
		}

		// Check for NaN and Infinity
		if (!Number.isFinite(value)) {
			errors.push(`${path || 'value'} must be a finite number`);
		}

		return { isValid: errors.length === 0, errors };
	}

	private static validateArray(value: any[], schema: ConfigurationSchema, path: string): ConfigurationValidationResult {
		const errors: string[] = [];
		const validatedValue: any[] = [];

		// Length validation
		if (schema.min !== undefined && value.length < schema.min) {
			errors.push(`${path || 'value'} must have at least ${schema.min} items`);
		}
		if (schema.max !== undefined && value.length > schema.max) {
			errors.push(`${path || 'value'} must have at most ${schema.max} items`);
		}

		// Validate each item if schema is provided
		if (schema.items) {
			value.forEach((item, index) => {
				const itemPath = `${path}[${index}]`;
				const itemValidation = this.validate(item, schema.items!, itemPath);
				errors.push(...itemValidation.errors);
				validatedValue.push(itemValidation.value);
			});
		} else {
			validatedValue.push(...value);
		}

		return { isValid: errors.length === 0, value: validatedValue, errors };
	}

	private static validateObject(value: object, schema: ConfigurationSchema, path: string): ConfigurationValidationResult {
		const errors: string[] = [];
		const validatedValue: any = { ...value };

		if (schema.properties) {
			// Validate each property
			for (const [propName, propSchema] of Object.entries(schema.properties)) {
				const propPath = path ? `${path}.${propName}` : propName;
				const propValue = (value as any)[propName];
				
				const propValidation = this.validate(propValue, propSchema, propPath);
				errors.push(...propValidation.errors);
				
				if (propValidation.isValid && propValidation.value !== undefined) {
					validatedValue[propName] = propValidation.value;
				}
			}
		}

		return { isValid: errors.length === 0, value: validatedValue, errors };
	}
}

/**
 * Security-focused configuration schemas
 */
export const SecurityConfigurationSchemas = {
	/**
	 * Security service configuration schema
	 */
	security: {
		type: 'object' as const,
		properties: {
			enableAuditLogging: {
				type: 'boolean' as const,
				default: true,
				description: 'Enable security event audit logging'
			},
			maxAuditLogSize: {
				type: 'number' as const,
				min: 100,
				max: 100000,
				default: 10000,
				description: 'Maximum number of audit log entries to keep in memory'
			},
			auditLogRetentionDays: {
				type: 'number' as const,
				min: 1,
				max: 365,
				default: 30,
				description: 'Number of days to retain audit logs'
			},
			enableCSPValidation: {
				type: 'boolean' as const,
				default: true,
				description: 'Enable Content Security Policy validation'
			},
			enableURLWhitelist: {
				type: 'boolean' as const,
				default: true,
				description: 'Enable URL whitelist validation'
			},
			trustedDomains: {
				type: 'array' as const,
				items: {
					type: 'string' as const,
					pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
				},
				default: ['code.visualstudio.com', 'marketplace.visualstudio.com', 'github.com', 'microsoft.com'],
				description: 'List of trusted domains for URL validation'
			},
			blockedDomains: {
				type: 'array' as const,
				items: {
					type: 'string' as const,
					pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
				},
				default: [],
				description: 'List of explicitly blocked domains'
			},
			maxFileUploadSize: {
				type: 'number' as const,
				min: 1024, // 1KB minimum
				max: 100 * 1024 * 1024, // 100MB maximum
				default: 10 * 1024 * 1024, // 10MB default
				description: 'Maximum file upload size in bytes'
			},
			allowedFileExtensions: {
				type: 'array' as const,
				items: {
					type: 'string' as const,
					pattern: /^\.[a-zA-Z0-9]+$/
				},
				default: ['.js', '.ts', '.json', '.md', '.txt', '.html', '.css'],
				description: 'List of allowed file extensions'
			}
		}
	},

	/**
	 * Performance configuration schema
	 */
	performance: {
		type: 'object' as const,
		properties: {
			enableObjectPooling: {
				type: 'boolean' as const,
				default: true,
				description: 'Enable object pooling for performance optimization'
			},
			maxPoolSize: {
				type: 'number' as const,
				min: 10,
				max: 10000,
				default: 100,
				description: 'Maximum size for object pools'
			},
			enableMemoryMonitoring: {
				type: 'boolean' as const,
				default: true,
				description: 'Enable memory usage monitoring'
			},
			memoryCheckInterval: {
				type: 'number' as const,
				min: 1000, // 1 second minimum
				max: 300000, // 5 minutes maximum
				default: 30000, // 30 seconds default
				description: 'Memory check interval in milliseconds'
			},
			maxCacheSize: {
				type: 'number' as const,
				min: 100,
				max: 100000,
				default: 1000,
				description: 'Maximum size for LRU caches'
			}
		}
	}
};

/**
 * Configuration validation service with Result pattern integration
 */
export class ConfigurationValidationService {
	
	/**
	 * Validate configuration using Result pattern for better error handling
	 */
	static validateWithResult<T>(
		value: any, 
		schema: ConfigurationSchema, 
		path?: string
	): Result<T, ValidationError> {
		const validation = ConfigurationValidator.validate(value, schema, path);
		
		if (validation.isValid) {
			return Result.ok(validation.value as T);
		} else {
			const error = new ValidationError(
				`Configuration validation failed: ${validation.errors.join(', ')}`,
				path || 'config',
				value
			);
			return Result.error(error);
		}
	}

	/**
	 * Validate security configuration
	 */
	static validateSecurityConfig(config: any): Result<any, ValidationError> {
		return this.validateWithResult(config, SecurityConfigurationSchemas.security, 'security');
	}

	/**
	 * Validate performance configuration
	 */
	static validatePerformanceConfig(config: any): Result<any, ValidationError> {
		return this.validateWithResult(config, SecurityConfigurationSchemas.performance, 'performance');
	}
}