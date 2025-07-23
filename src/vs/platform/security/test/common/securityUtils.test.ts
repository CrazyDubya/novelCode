/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual, ok, deepStrictEqual } from 'assert';
import { InputSanitizer, CSPBuilder, CryptoUtils, RateLimiter, SecurityHeaders } from '../common/securityUtils.js';

suite('Security Utils', () => {

	suite('InputSanitizer', () => {

		test('should sanitize malicious HTML', () => {
			const maliciousHTML = '<script>alert("XSS")</script><p>Safe content</p>';
			const sanitized = InputSanitizer.sanitizeHTML(maliciousHTML);
			
			ok(!sanitized.includes('<script>'), 'Script tags should be removed');
			ok(sanitized.includes('<p>Safe content</p>'), 'Safe content should be preserved');
		});

		test('should remove javascript protocols', () => {
			const maliciousLink = '<a href="javascript:alert(\'XSS\')">Click me</a>';
			const sanitized = InputSanitizer.sanitizeHTML(maliciousLink);
			
			ok(!sanitized.includes('javascript:'), 'JavaScript protocol should be removed');
		});

		test('should remove event handlers', () => {
			const maliciousHTML = '<div onclick="alert(\'XSS\')">Content</div>';
			const sanitized = InputSanitizer.sanitizeHTML(maliciousHTML);
			
			ok(!sanitized.includes('onclick='), 'Event handlers should be removed');
		});

		test('should escape HTML entities', () => {
			const input = '<script>alert("XSS")</script>';
			const escaped = InputSanitizer.escapeHTML(input);
			
			strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
		});

		test('should detect path traversal attempts', () => {
			const maliciousPath = '../../../etc/passwd';
			const result = InputSanitizer.sanitizeFilePath(maliciousPath);
			
			strictEqual(result.isValid, false);
			strictEqual(result.error, 'Path traversal detected');
		});

		test('should detect null bytes in paths', () => {
			const maliciousPath = 'file.txt\x00.exe';
			const result = InputSanitizer.sanitizeFilePath(maliciousPath);
			
			strictEqual(result.isValid, false);
			strictEqual(result.error, 'Path contains null bytes');
		});

		test('should sanitize safe paths', () => {
			const safePath = 'documents/file.txt';
			const result = InputSanitizer.sanitizeFilePath(safePath);
			
			strictEqual(result.isValid, true);
			strictEqual(result.sanitized, 'documents/file.txt');
		});

		test('should sanitize logging input', () => {
			const maliciousLog = 'User input\r\nFAKE LOG ENTRY: Admin logged in';
			const sanitized = InputSanitizer.sanitizeForLogging(maliciousLog);
			
			ok(!sanitized.includes('\r'), 'Carriage returns should be removed');
			ok(!sanitized.includes('\n'), 'Line feeds should be removed');
		});
	});

	suite('CSPBuilder', () => {

		test('should build basic CSP', () => {
			const csp = new CSPBuilder()
				.addDirective('default-src', ["'self'"])
				.addDirective('script-src', ["'self'", "'unsafe-inline'"])
				.build();

			strictEqual(csp, "default-src 'self'; script-src 'self' 'unsafe-inline'");
		});

		test('should create secure default CSP', () => {
			const csp = CSPBuilder.createSecureDefault();
			
			ok(csp.includes("default-src 'self'"), 'Should include default-src self');
			ok(csp.includes("frame-ancestors 'none'"), 'Should prevent framing');
			ok(csp.includes("base-uri 'self'"), 'Should restrict base URI');
		});

		test('should create CSP with nonce', () => {
			const nonce = 'test-nonce-123';
			const csp = CSPBuilder.createSecureDefault(nonce);
			
			ok(csp.includes(`'nonce-${nonce}'`), 'Should include nonce in script-src');
		});
	});

	suite('CryptoUtils', () => {

		test('should generate secure random strings', () => {
			const random1 = CryptoUtils.generateSecureRandom(16);
			const random2 = CryptoUtils.generateSecureRandom(16);
			
			strictEqual(random1.length, 32); // 16 bytes = 32 hex chars
			strictEqual(random2.length, 32);
			ok(random1 !== random2, 'Should generate different values');
		});

		test('should perform constant time comparison', () => {
			const str1 = 'secret123';
			const str2 = 'secret123';
			const str3 = 'secret456';
			
			ok(CryptoUtils.constantTimeEquals(str1, str2), 'Equal strings should return true');
			ok(!CryptoUtils.constantTimeEquals(str1, str3), 'Different strings should return false');
		});

		test('should handle different length strings', () => {
			const short = 'abc';
			const long = 'abcdef';
			
			ok(!CryptoUtils.constantTimeEquals(short, long), 'Different length strings should return false');
		});

		test('should create hashes', () => {
			const input = 'test input';
			const hash1 = CryptoUtils.createHash(input);
			const hash2 = CryptoUtils.createHash(input);
			
			strictEqual(hash1, hash2, 'Same input should produce same hash');
			ok(hash1.length > 0, 'Hash should not be empty');
		});
	});

	suite('RateLimiter', () => {

		test('should allow requests under limit', () => {
			const limiter = new RateLimiter(5, 1000); // 5 requests per second
			
			ok(limiter.isAllowed('user1'), 'First request should be allowed');
			ok(limiter.isAllowed('user1'), 'Second request should be allowed');
			ok(limiter.isAllowed('user1'), 'Third request should be allowed');
		});

		test('should block requests over limit', () => {
			const limiter = new RateLimiter(2, 1000); // 2 requests per second
			
			ok(limiter.isAllowed('user1'), 'First request should be allowed');
			ok(limiter.isAllowed('user1'), 'Second request should be allowed');
			ok(!limiter.isAllowed('user1'), 'Third request should be blocked');
		});

		test('should handle different users separately', () => {
			const limiter = new RateLimiter(1, 1000); // 1 request per second
			
			ok(limiter.isAllowed('user1'), 'User1 first request should be allowed');
			ok(limiter.isAllowed('user2'), 'User2 first request should be allowed');
			ok(!limiter.isAllowed('user1'), 'User1 second request should be blocked');
		});

		test('should reset after time window', (done) => {
			const limiter = new RateLimiter(1, 50); // 1 request per 50ms
			
			ok(limiter.isAllowed('user1'), 'First request should be allowed');
			ok(!limiter.isAllowed('user1'), 'Second request should be blocked');
			
			setTimeout(() => {
				ok(limiter.isAllowed('user1'), 'Request after window should be allowed');
				done();
			}, 60);
		});
	});

	suite('SecurityHeaders', () => {

		test('should generate basic secure headers', () => {
			const headers = SecurityHeaders.getSecureHeaders();
			
			ok(headers['X-Frame-Options'], 'Should include X-Frame-Options');
			ok(headers['X-Content-Type-Options'], 'Should include X-Content-Type-Options');
			ok(headers['X-XSS-Protection'], 'Should include X-XSS-Protection');
			ok(headers['Referrer-Policy'], 'Should include Referrer-Policy');
		});

		test('should include CSP when provided', () => {
			const csp = "default-src 'self'";
			const headers = SecurityHeaders.getSecureHeaders({ csp });
			
			strictEqual(headers['Content-Security-Policy'], csp);
		});

		test('should include HSTS by default', () => {
			const headers = SecurityHeaders.getSecureHeaders();
			
			ok(headers['Strict-Transport-Security'], 'Should include HSTS header');
			ok(headers['Strict-Transport-Security'].includes('max-age='), 'Should include max-age');
		});

		test('should allow disabling HSTS', () => {
			const headers = SecurityHeaders.getSecureHeaders({ hsts: false });
			
			ok(!headers['Strict-Transport-Security'], 'Should not include HSTS when disabled');
		});

		test('should use custom frame options', () => {
			const headers = SecurityHeaders.getSecureHeaders({ frameOptions: 'SAMEORIGIN' });
			
			strictEqual(headers['X-Frame-Options'], 'SAMEORIGIN');
		});
	});

	suite('Security Validation Tests', () => {

		test('should detect common XSS vectors', () => {
			const xssVectors = [
				'<script>alert(1)</script>',
				'<img src=x onerror=alert(1)>',
				'<svg onload=alert(1)>',
				'javascript:alert(1)',
				'<iframe src="javascript:alert(1)"></iframe>',
				'<object data="javascript:alert(1)"></object>',
				'<embed src="javascript:alert(1)">',
				'<link rel="stylesheet" href="javascript:alert(1)">',
				'<style>@import "javascript:alert(1)"</style>'
			];

			for (const vector of xssVectors) {
				const sanitized = InputSanitizer.sanitizeHTML(vector);
				ok(!sanitized.includes('alert(1)'), `XSS vector should be neutralized: ${vector}`);
			}
		});

		test('should detect path traversal vectors', () => {
			const pathVectors = [
				'../../../etc/passwd',
				'..\\..\\..\\windows\\system32\\config\\sam',
				'....//....//....//etc/passwd',
				'..%2f..%2f..%2fetc%2fpasswd',
				'..%252f..%252f..%252fetc%252fpasswd'
			];

			for (const vector of pathVectors) {
				const result = InputSanitizer.sanitizeFilePath(decodeURIComponent(vector));
				ok(!result.isValid, `Path traversal should be detected: ${vector}`);
			}
		});

		test('should validate secure token generation', () => {
			const tokens = new Set();
			
			// Generate 1000 tokens and check for uniqueness
			for (let i = 0; i < 1000; i++) {
				const token = CryptoUtils.generateSecureRandom();
				ok(!tokens.has(token), 'Token should be unique');
				tokens.add(token);
				ok(token.length === 64, 'Token should be 64 characters (32 bytes hex)');
				ok(/^[0-9a-f]+$/.test(token), 'Token should be valid hex');
			}
		});

		test('should validate CSP directive safety', () => {
			const safeCsp = CSPBuilder.createSecureDefault();
			
			// Check for dangerous directives
			ok(!safeCsp.includes("'unsafe-eval'"), 'Should not allow unsafe-eval');
			ok(safeCsp.includes("frame-ancestors 'none'"), 'Should prevent clickjacking');
			ok(safeCsp.includes("base-uri 'self'"), 'Should restrict base URI');
		});
	});
});