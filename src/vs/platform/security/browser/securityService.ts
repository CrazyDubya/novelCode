/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { 
	ISecurityService, 
	ISecurityEvent, 
	IValidationResult, 
	SecuritySeverity, 
	SecurityEventFilter,
	ISecurityConfiguration 
} from '../common/security.js';
import { ILogService } from '../../log/common/log.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';

/**
 * Browser implementation of the security service
 */
export class BrowserSecurityService implements ISecurityService {

	readonly _serviceBrand: undefined;

	private readonly auditLog: ISecurityEvent[] = [];
	private readonly config: ISecurityConfiguration;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		this.config = this.loadSecurityConfiguration();
	}

	private loadSecurityConfiguration(): ISecurityConfiguration {
		return {
			enableAuditLogging: this.configurationService.getValue('security.enableAuditLogging', true),
			maxAuditLogSize: this.configurationService.getValue('security.maxAuditLogSize', 10000),
			auditLogRetentionDays: this.configurationService.getValue('security.auditLogRetentionDays', 30),
			enableCSPValidation: this.configurationService.getValue('security.enableCSPValidation', true),
			enableURLWhitelist: this.configurationService.getValue('security.enableURLWhitelist', true),
			trustedDomains: this.configurationService.getValue('security.trustedDomains', [
				'code.visualstudio.com',
				'marketplace.visualstudio.com',
				'github.com',
				'microsoft.com'
			]),
			blockedDomains: this.configurationService.getValue('security.blockedDomains', []),
			maxFileUploadSize: this.configurationService.getValue('security.maxFileUploadSize', 10 * 1024 * 1024),
			allowedFileExtensions: this.configurationService.getValue('security.allowedFileExtensions', [
				'.js', '.ts', '.json', '.md', '.txt', '.html', '.css'
			])
		};
	}

	validateInput(input: string, type: 'html' | 'url' | 'path' | 'filename' | 'json'): IValidationResult {
		const errors: string[] = [];
		let sanitizedValue: any = input;

		// Basic input length validation
		if (input.length > 10000) {
			errors.push('Input too long');
		}

		switch (type) {
			case 'html':
				sanitizedValue = this.sanitizeHTML(input);
				break;

			case 'url':
				try {
					const url = new URL(input);
					if (!this.isSafeURL(input)) {
						errors.push('URL not in allowed domains');
					}
					sanitizedValue = url.toString();
				} catch {
					errors.push('Invalid URL format');
				}
				break;

			case 'path':
				// Basic path validation for browser context
				if (input.includes('..') || input.includes('~')) {
					errors.push('Invalid or unsafe file path');
				}
				sanitizedValue = input.replace(/[\\\/]+/g, '/');
				break;

			case 'filename':
				// Extract filename from path
				const parts = input.split(/[\\\/]/);
				const filename = parts[parts.length - 1] || '';
				if (filename !== input || filename.includes('..')) {
					errors.push('Invalid filename');
				}
				// Check allowed extensions
				const ext = this.getFileExtension(filename).toLowerCase();
				if (ext && !this.config.allowedFileExtensions.includes(ext)) {
					errors.push(`File extension ${ext} not allowed`);
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

		return {
			isValid: errors.length === 0,
			errors,
			sanitizedValue: errors.length === 0 ? sanitizedValue : undefined
		};
	}

	sanitizeHTML(html: string): string {
		try {
			// Browser-specific HTML sanitization
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			
			// Remove dangerous elements
			const dangerousElements = doc.querySelectorAll('script, iframe, object, embed, applet, link[rel="import"]');
			dangerousElements.forEach(el => el.remove());
			
			// Remove dangerous attributes
			const allElements = doc.querySelectorAll('*');
			allElements.forEach(el => {
				// Remove event handler attributes
				const attributesToRemove: string[] = [];
				for (let i = 0; i < el.attributes.length; i++) {
					const attr = el.attributes[i];
					if (attr.name.startsWith('on') || 
						attr.name.startsWith('data-') ||
						attr.value.includes('javascript:')) {
						attributesToRemove.push(attr.name);
					}
				}
				attributesToRemove.forEach(attrName => el.removeAttribute(attrName));
			});
			
			return doc.body.innerHTML;
		} catch (error) {
			this.logService.error('HTML sanitization failed', error);
			return ''; // Return empty string if sanitization fails
		}
	}

	validateFilePath(filePath: string, allowedBasePaths: string[]): boolean {
		try {
			// Browser context - basic validation
			if (filePath.includes('..') || filePath.includes('~')) {
				return false;
			}

			// In browser context, we can't do full path resolution
			// This is a simplified check
			return allowedBasePaths.some(basePath => 
				filePath.startsWith(basePath) || filePath.startsWith('/' + basePath)
			);
		} catch {
			return false;
		}
	}

	generateSecureToken(length: number = 32): string {
		try {
			// Use Web Crypto API for secure random generation
			const array = new Uint8Array(length);
			crypto.getRandomValues(array);
			return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
		} catch (error) {
			this.logService.error('Secure token generation failed', error);
			// Fallback to Math.random (less secure but functional)
			let result = '';
			const characters = '0123456789abcdef';
			for (let i = 0; i < length * 2; i++) {
				result += characters.charAt(Math.floor(Math.random() * characters.length));
			}
			return result;
		}
	}

	constantTimeEquals(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}
		return result === 0;
	}

	async logSecurityEvent(event: ISecurityEvent): Promise<void> {
		if (!this.config.enableAuditLogging) {
			return;
		}

		// Add to in-memory audit log
		this.auditLog.push(event);

		// Trim log if it exceeds max size
		if (this.auditLog.length > this.config.maxAuditLogSize) {
			this.auditLog.splice(0, this.auditLog.length - this.config.maxAuditLogSize);
		}

		// Log to main logging service
		const logLevel = this.getLogLevel(event.severity);
		this.logService.log(logLevel, `Security Event: ${event.eventType}`, event);
	}

	async getSecurityEvents(filter?: SecurityEventFilter): Promise<ISecurityEvent[]> {
		let filteredEvents = [...this.auditLog];

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

		// Sort by timestamp (newest first)
		return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	async hasPermission(userId: string, action: string, resource: string): Promise<boolean> {
		await this.logSecurityEvent({
			timestamp: new Date(),
			severity: SecuritySeverity.LOW,
			eventType: 'permission_check',
			userId,
			resource,
			action,
			success: true,
			metadata: { action, resource }
		});

		// Placeholder implementation
		return true;
	}

	validateCSPDirective(directive: string): boolean {
		if (!this.config.enableCSPValidation) {
			return true;
		}

		// Basic CSP validation
		const unsafeKeywords = ['unsafe-inline', 'unsafe-eval', 'unsafe-hashes'];
		const hasUnsafeKeywords = unsafeKeywords.some(keyword => directive.includes(keyword));
		
		if (hasUnsafeKeywords) {
			this.logService.warn('CSP directive contains unsafe keywords', directive);
			return false;
		}

		return true;
	}

	isSafeURL(url: string): boolean {
		if (!this.config.enableURLWhitelist) {
			return true;
		}

		try {
			const parsedUrl = new URL(url);
			const hostname = parsedUrl.hostname.toLowerCase();

			// Check if domain is explicitly blocked
			if (this.config.blockedDomains.some(blocked => hostname.includes(blocked.toLowerCase()))) {
				return false;
			}

			// Check if domain is in trusted list
			return this.config.trustedDomains.some(trusted => 
				hostname === trusted.toLowerCase() || hostname.endsWith('.' + trusted.toLowerCase())
			);
		} catch {
			return false;
		}
	}

	private getLogLevel(severity: SecuritySeverity): number {
		switch (severity) {
			case SecuritySeverity.LOW:
				return 1; // Info
			case SecuritySeverity.MEDIUM:
				return 2; // Warn
			case SecuritySeverity.HIGH:
				return 3; // Error
			case SecuritySeverity.CRITICAL:
				return 3; // Error
			default:
				return 1; // Info
		}
	}

	private getFileExtension(filename: string): string {
		const lastDotIndex = filename.lastIndexOf('.');
		return lastDotIndex >= 0 ? filename.substring(lastDotIndex) : '';
	}
}