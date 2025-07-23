/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISecurityService, ISecurityEvent, SecuritySeverity, IValidationResult, SecurityEventFilter, ISecurityConfiguration } from './security.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { ILogService } from '../../log/common/log.js';
import * as crypto from 'crypto';
import * as path from 'path';

export class SecurityService implements ISecurityService {

	readonly _serviceBrand: undefined;

	private readonly auditEvents: ISecurityEvent[] = [];
	private readonly config: ISecurityConfiguration;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService
	) {
		this.config = this.loadSecurityConfiguration();
	}

	validateInput(input: string, type: 'html' | 'url' | 'path' | 'filename' | 'json'): IValidationResult {
		const errors: string[] = [];
		let sanitizedValue: any = input;

		// Basic length validation
		if (input.length > 10000) {
			errors.push('Input exceeds maximum length');
		}

		switch (type) {
			case 'html':
				sanitizedValue = this.sanitizeHTML(input);
				break;
			case 'url':
				if (!this.isSafeURL(input)) {
					errors.push('URL is not in the allowed list');
				}
				break;
			case 'path':
				if (!this.validateFilePath(input, ['/allowed'])) {
					errors.push('Path contains invalid characters or traversal attempts');
				}
				break;
			case 'filename':
				if (!this.isValidFilename(input)) {
					errors.push('Filename contains invalid characters');
				}
				break;
			case 'json':
				try {
					sanitizedValue = JSON.parse(input);
				} catch {
					errors.push('Invalid JSON format');
				}
				break;
		}

		const result: IValidationResult = {
			isValid: errors.length === 0,
			errors,
			sanitizedValue: errors.length === 0 ? sanitizedValue : undefined
		};

		if (!result.isValid) {
			this.logSecurityEvent({
				timestamp: new Date(),
				severity: SecuritySeverity.MEDIUM,
				eventType: 'INPUT_VALIDATION_FAILURE',
				resource: type,
				action: 'validate',
				success: false,
				metadata: { inputType: type, errors }
			});
		}

		return result;
	}

	sanitizeHTML(html: string): string {
		// Basic HTML sanitization - remove script tags, event handlers, etc.
		let sanitized = html
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
			.replace(/javascript:/gi, '')
			.replace(/vbscript:/gi, '')
			.replace(/on\w+\s*=/gi, '');

		// Remove data URLs that could contain scripts
		sanitized = sanitized.replace(/data:text\/html[^"']*/gi, '');

		return sanitized;
	}

	validateFilePath(filePath: string, allowedBasePaths: string[]): boolean {
		try {
			const normalizedPath = path.normalize(filePath);
			
			// Check for path traversal attempts
			if (normalizedPath.includes('..')) {
				this.logSecurityEvent({
					timestamp: new Date(),
					severity: SecuritySeverity.HIGH,
					eventType: 'PATH_TRAVERSAL_ATTEMPT',
					resource: filePath,
					action: 'access',
					success: false,
					metadata: { normalizedPath }
				});
				return false;
			}

			// Check if path starts with an allowed base path
			const isAllowed = allowedBasePaths.some(basePath => {
				const normalizedBase = path.normalize(basePath);
				return normalizedPath.startsWith(normalizedBase);
			});

			if (!isAllowed) {
				this.logSecurityEvent({
					timestamp: new Date(),
					severity: SecuritySeverity.MEDIUM,
					eventType: 'UNAUTHORIZED_PATH_ACCESS',
					resource: filePath,
					action: 'access',
					success: false,
					metadata: { allowedBasePaths }
				});
			}

			return isAllowed;
		} catch (error) {
			this.logService.error('Path validation error:', error);
			return false;
		}
	}

	generateSecureToken(length: number = 32): string {
		try {
			return crypto.randomBytes(length).toString('hex');
		} catch (error) {
			this.logService.error('Failed to generate secure token:', error);
			// Fallback to less secure but functional method
			return Array.from(crypto.getRandomValues(new Uint8Array(length)))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');
		}
	}

	constantTimeEquals(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		try {
			return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
		} catch {
			// Fallback for non-Node environments
			let result = 0;
			for (let i = 0; i < a.length; i++) {
				result |= a.charCodeAt(i) ^ b.charCodeAt(i);
			}
			return result === 0;
		}
	}

	async logSecurityEvent(event: ISecurityEvent): Promise<void> {
		if (!this.config.enableAuditLogging) {
			return;
		}

		// Add timestamp if not provided
		const eventWithTimestamp = {
			...event,
			timestamp: event.timestamp || new Date()
		};

		// Store in memory (in production this would go to a persistent store)
		this.auditEvents.push(eventWithTimestamp);

		// Trim old events to prevent memory buildup
		if (this.auditEvents.length > this.config.maxAuditLogSize) {
			this.auditEvents.splice(0, this.auditEvents.length - this.config.maxAuditLogSize);
		}

		// Log critical events immediately
		if (event.severity === SecuritySeverity.CRITICAL || event.severity === SecuritySeverity.HIGH) {
			this.logService.warn(`Security Event [${event.severity}]: ${event.eventType} - ${event.action} on ${event.resource}`, event.metadata);
		}
	}

	async getSecurityEvents(filter?: SecurityEventFilter): Promise<ISecurityEvent[]> {
		let filteredEvents = [...this.auditEvents];

		if (filter) {
			filteredEvents = filteredEvents.filter(event => {
				if (filter.startDate && event.timestamp < filter.startDate) return false;
				if (filter.endDate && event.timestamp > filter.endDate) return false;
				if (filter.severity && event.severity !== filter.severity) return false;
				if (filter.eventType && event.eventType !== filter.eventType) return false;
				if (filter.userId && event.userId !== filter.userId) return false;
				if (filter.success !== undefined && event.success !== filter.success) return false;
				return true;
			});
		}

		return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	async hasPermission(userId: string, action: string, resource: string): Promise<boolean> {
		// Basic permission check - in production this would integrate with proper auth system
		this.logSecurityEvent({
			timestamp: new Date(),
			severity: SecuritySeverity.LOW,
			eventType: 'PERMISSION_CHECK',
			userId,
			resource,
			action,
			success: true,
			metadata: { action, resource }
		});

		// For now, allow all operations (this should be replaced with proper authorization)
		return true;
	}

	validateCSPDirective(directive: string): boolean {
		// Basic CSP directive validation
		const validDirectives = [
			'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
			'font-src', 'object-src', 'media-src', 'child-src', 'frame-src',
			'worker-src', 'frame-ancestors', 'base-uri', 'form-action'
		];

		const parts = directive.trim().split(/\s+/);
		if (parts.length < 2) return false;

		const directiveName = parts[0];
		if (!validDirectives.includes(directiveName)) return false;

		// Validate values (basic check)
		const values = parts.slice(1);
		const validValues = ['none', 'self', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic'];
		
		return values.every(value => 
			validValues.includes(`'${value}'`) ||
			value.startsWith('nonce-') ||
			value.startsWith('sha256-') ||
			value.startsWith('sha384-') ||
			value.startsWith('sha512-') ||
			this.isSafeURL(value)
		);
	}

	isSafeURL(url: string): boolean {
		try {
			const parsed = new URL(url);
			
			// Check protocol whitelist
			const allowedProtocols = ['https:', 'http:', 'data:', 'blob:'];
			if (!allowedProtocols.includes(parsed.protocol)) {
				return false;
			}

			// Check domain whitelist/blacklist
			if (this.config.blockedDomains.includes(parsed.hostname)) {
				return false;
			}

			if (this.config.trustedDomains.length > 0) {
				return this.config.trustedDomains.some(domain => 
					parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
				);
			}

			return true;
		} catch {
			return false;
		}
	}

	private isValidFilename(filename: string): boolean {
		// Check for invalid characters
		const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
		if (invalidChars.test(filename)) {
			return false;
		}

		// Check for reserved names (Windows)
		const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
		if (reservedNames.test(filename)) {
			return false;
		}

		// Check extension if allowlist is configured
		if (this.config.allowedFileExtensions.length > 0) {
			const ext = path.extname(filename).toLowerCase();
			return this.config.allowedFileExtensions.includes(ext);
		}

		return true;
	}

	private loadSecurityConfiguration(): ISecurityConfiguration {
		return {
			enableAuditLogging: this.configurationService.getValue('security.enableAuditLogging', true),
			maxAuditLogSize: this.configurationService.getValue('security.maxAuditLogSize', 10000),
			auditLogRetentionDays: this.configurationService.getValue('security.auditLogRetentionDays', 90),
			enableCSPValidation: this.configurationService.getValue('security.enableCSPValidation', true),
			enableURLWhitelist: this.configurationService.getValue('security.enableURLWhitelist', false),
			trustedDomains: this.configurationService.getValue('security.trustedDomains', []),
			blockedDomains: this.configurationService.getValue('security.blockedDomains', []),
			maxFileUploadSize: this.configurationService.getValue('security.maxFileUploadSize', 10 * 1024 * 1024),
			allowedFileExtensions: this.configurationService.getValue('security.allowedFileExtensions', [])
		};
	}
}