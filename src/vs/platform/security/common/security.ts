/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const ISecurityService = createDecorator<ISecurityService>('securityService');

/**
 * Security severity levels for audit events
 */
export enum SecuritySeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

/**
 * Security audit event interface
 */
export interface ISecurityEvent {
	readonly timestamp: Date;
	readonly severity: SecuritySeverity;
	readonly eventType: string;
	readonly userId?: string;
	readonly resource: string;
	readonly action: string;
	readonly success: boolean;
	readonly metadata?: Record<string, any>;
	readonly ipAddress?: string;
	readonly userAgent?: string;
}

/**
 * Input validation result
 */
export interface IValidationResult {
	readonly isValid: boolean;
	readonly errors: string[];
	readonly sanitizedValue?: any;
}

/**
 * Security service for handling authentication, authorization, and audit logging
 */
export interface ISecurityService {

	readonly _serviceBrand: undefined;

	/**
	 * Validates and sanitizes user input to prevent injection attacks
	 * @param input - The input to validate
	 * @param type - The expected input type (html, url, path, etc.)
	 * @returns Validation result with sanitized value if valid
	 */
	validateInput(input: string, type: 'html' | 'url' | 'path' | 'filename' | 'json'): IValidationResult;

	/**
	 * Sanitizes HTML content to prevent XSS attacks
	 * @param html - HTML content to sanitize
	 * @returns Sanitized HTML content
	 */
	sanitizeHTML(html: string): string;

	/**
	 * Validates file paths to prevent directory traversal attacks
	 * @param path - File path to validate
	 * @param allowedBasePaths - Array of allowed base paths
	 * @returns True if path is safe
	 */
	validateFilePath(path: string, allowedBasePaths: string[]): boolean;

	/**
	 * Generates a cryptographically secure random token
	 * @param length - Length of the token in bytes (default: 32)
	 * @returns Hex-encoded secure token
	 */
	generateSecureToken(length?: number): string;

	/**
	 * Performs constant-time string comparison to prevent timing attacks
	 * @param a - First string to compare
	 * @param b - Second string to compare
	 * @returns True if strings are equal
	 */
	constantTimeEquals(a: string, b: string): boolean;

	/**
	 * Logs a security event for audit purposes
	 * @param event - Security event to log
	 */
	logSecurityEvent(event: ISecurityEvent): Promise<void>;

	/**
	 * Retrieves security events for audit review
	 * @param filter - Optional filter criteria
	 * @returns Array of matching security events
	 */
	getSecurityEvents(filter?: SecurityEventFilter): Promise<ISecurityEvent[]>;

	/**
	 * Checks if a user has permission to perform an action on a resource
	 * @param userId - User identifier
	 * @param action - Action to perform
	 * @param resource - Resource to act upon
	 * @returns True if user has permission
	 */
	hasPermission(userId: string, action: string, resource: string): Promise<boolean>;

	/**
	 * Validates a Content Security Policy directive
	 * @param directive - CSP directive to validate
	 * @returns True if directive is valid and secure
	 */
	validateCSPDirective(directive: string): boolean;

	/**
	 * Checks if a URL is safe to load (whitelist-based)
	 * @param url - URL to validate
	 * @returns True if URL is safe
	 */
	isSafeURL(url: string): boolean;
}

/**
 * Filter criteria for security event queries
 */
export interface SecurityEventFilter {
	readonly startDate?: Date;
	readonly endDate?: Date;
	readonly severity?: SecuritySeverity;
	readonly eventType?: string;
	readonly userId?: string;
	readonly success?: boolean;
}

/**
 * Security configuration options
 */
export interface ISecurityConfiguration {
	readonly enableAuditLogging: boolean;
	readonly maxAuditLogSize: number;
	readonly auditLogRetentionDays: number;
	readonly enableCSPValidation: boolean;
	readonly enableURLWhitelist: boolean;
	readonly trustedDomains: string[];
	readonly blockedDomains: string[];
	readonly maxFileUploadSize: number;
	readonly allowedFileExtensions: string[];
}