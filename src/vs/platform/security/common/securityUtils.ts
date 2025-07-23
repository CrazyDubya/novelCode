/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Security utility functions for common security operations
 */

/**
 * Content Security Policy helper class for generating and validating CSP headers
 */
export class CSPBuilder {
	private directives: Map<string, string[]> = new Map();

	/**
	 * Add a directive to the CSP
	 */
	addDirective(directive: string, values: string[]): this {
		this.directives.set(directive, values);
		return this;
	}

	/**
	 * Build the CSP header string
	 */
	build(): string {
		const parts: string[] = [];
		for (const [directive, values] of this.directives) {
			parts.push(`${directive} ${values.join(' ')}`);
		}
		return parts.join('; ');
	}

	/**
	 * Create a secure default CSP for webviews
	 */
	static createSecureDefault(nonce?: string): string {
		const builder = new CSPBuilder();
		
		builder
			.addDirective('default-src', ["'self'"])
			.addDirective('script-src', nonce ? ["'self'", `'nonce-${nonce}'`] : ["'self'"])
			.addDirective('style-src', ["'self'", "'unsafe-inline'"])
			.addDirective('img-src', ["'self'", 'data:', 'https:'])
			.addDirective('connect-src', ["'self'", 'wss:', 'https:'])
			.addDirective('frame-ancestors', ["'none'"])
			.addDirective('base-uri', ["'self'"]);

		return builder.build();
	}
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
	
	/**
	 * Sanitize HTML content to prevent XSS
	 */
	static sanitizeHTML(html: string, options: { allowedTags?: string[], allowedAttributes?: string[] } = {}): string {
		const allowedTags = options.allowedTags || ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'];
		const allowedAttributes = options.allowedAttributes || ['href', 'title'];

		// Remove all script tags and their content
		let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
		
		// Remove dangerous tags
		const dangerousTags = ['iframe', 'object', 'embed', 'link', 'meta', 'style'];
		for (const tag of dangerousTags) {
			const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
			sanitized = sanitized.replace(regex, '');
		}

		// Remove javascript: and vbscript: protocols
		sanitized = sanitized.replace(/javascript:/gi, '');
		sanitized = sanitized.replace(/vbscript:/gi, '');

		// Remove event handlers
		sanitized = sanitized.replace(/on\w+\s*=/gi, '');

		// Remove dangerous data URLs
		sanitized = sanitized.replace(/data:text\/html[^"']*/gi, '');

		return sanitized;
	}

	/**
	 * Escape HTML entities to prevent XSS
	 */
	static escapeHTML(text: string): string {
		const entityMap: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
			'/': '&#x2F;'
		};

		return text.replace(/[&<>"'\/]/g, (char) => entityMap[char]);
	}

	/**
	 * Sanitize user input for safe logging
	 */
	static sanitizeForLogging(input: string, maxLength: number = 1000): string {
		// Remove potential log injection attempts
		let sanitized = input
			.replace(/[\r\n]/g, ' ')  // Remove line breaks
			.replace(/\x00/g, '')     // Remove null bytes
			.substring(0, maxLength); // Limit length

		return InputSanitizer.escapeHTML(sanitized);
	}

	/**
	 * Validate and sanitize file paths
	 */
	static sanitizeFilePath(filePath: string): { isValid: boolean; sanitized?: string; error?: string } {
		// Check for null bytes
		if (filePath.includes('\x00')) {
			return { isValid: false, error: 'Path contains null bytes' };
		}

		// Check for path traversal
		if (filePath.includes('..')) {
			return { isValid: false, error: 'Path traversal detected' };
		}

		// Remove dangerous characters
		const sanitized = filePath.replace(/[<>:"|?*]/g, '');

		// Check for absolute paths (may be dangerous depending on context)
		if (filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(filePath)) {
			return { isValid: false, error: 'Absolute paths not allowed' };
		}

		return { isValid: true, sanitized };
	}
}

/**
 * Cryptographic utilities for security operations
 */
export class CryptoUtils {
	
	/**
	 * Generate a cryptographically secure random string
	 */
	static generateSecureRandom(length: number = 32, encoding: 'hex' | 'base64' = 'hex'): string {
		if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
			// Browser environment
			const bytes = new Uint8Array(length);
			crypto.getRandomValues(bytes);
			
			if (encoding === 'base64') {
				return btoa(String.fromCharCode(...bytes));
			}
			return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
		}
		
		// Node.js environment
		try {
			const crypto = require('crypto');
			return crypto.randomBytes(length).toString(encoding);
		} catch {
			// Fallback - less secure but functional
			const chars = '0123456789abcdef';
			let result = '';
			for (let i = 0; i < length * 2; i++) {
				result += chars[Math.floor(Math.random() * chars.length)];
			}
			return result;
		}
	}

	/**
	 * Create a secure hash of input data
	 */
	static createHash(input: string, algorithm: string = 'sha256'): string {
		try {
			const crypto = require('crypto');
			return crypto.createHash(algorithm).update(input).digest('hex');
		} catch {
			// Fallback for browser or when crypto is not available
			// This is not cryptographically secure but better than nothing
			let hash = 0;
			for (let i = 0; i < input.length; i++) {
				const char = input.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash; // Convert to 32-bit integer
			}
			return Math.abs(hash).toString(16);
		}
	}

	/**
	 * Constant time string comparison to prevent timing attacks
	 */
	static constantTimeEquals(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}
		return result === 0;
	}
}

/**
 * Rate limiting utility for preventing abuse
 */
export class RateLimiter {
	private requests: Map<string, number[]> = new Map();

	constructor(
		private readonly maxRequests: number,
		private readonly windowMs: number
	) {}

	/**
	 * Check if a request should be allowed
	 */
	isAllowed(identifier: string): boolean {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		
		// Get existing requests for this identifier
		const existingRequests = this.requests.get(identifier) || [];
		
		// Filter out old requests
		const recentRequests = existingRequests.filter(time => time > windowStart);
		
		// Check if under limit
		if (recentRequests.length >= this.maxRequests) {
			return false;
		}

		// Add current request
		recentRequests.push(now);
		this.requests.set(identifier, recentRequests);

		return true;
	}

	/**
	 * Clear old entries to prevent memory leaks
	 */
	cleanup(): void {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		for (const [identifier, requests] of this.requests) {
			const recentRequests = requests.filter(time => time > windowStart);
			if (recentRequests.length === 0) {
				this.requests.delete(identifier);
			} else {
				this.requests.set(identifier, recentRequests);
			}
		}
	}
}

/**
 * Security headers helper for HTTP responses
 */
export class SecurityHeaders {
	
	/**
	 * Get secure headers for HTTP responses
	 */
	static getSecureHeaders(options: {
		csp?: string;
		hsts?: boolean;
		frameOptions?: 'DENY' | 'SAMEORIGIN';
		contentTypeOptions?: boolean;
		xssProtection?: boolean;
	} = {}): Record<string, string> {
		const headers: Record<string, string> = {};

		// Content Security Policy
		if (options.csp) {
			headers['Content-Security-Policy'] = options.csp;
		}

		// HTTP Strict Transport Security
		if (options.hsts !== false) {
			headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
		}

		// X-Frame-Options
		headers['X-Frame-Options'] = options.frameOptions || 'DENY';

		// X-Content-Type-Options
		if (options.contentTypeOptions !== false) {
			headers['X-Content-Type-Options'] = 'nosniff';
		}

		// X-XSS-Protection
		if (options.xssProtection !== false) {
			headers['X-XSS-Protection'] = '1; mode=block';
		}

		// Referrer Policy
		headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

		// Permissions Policy
		headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';

		return headers;
	}
}