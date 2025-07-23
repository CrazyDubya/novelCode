/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cookie from 'cookie';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import * as path from '../../base/common/path.js';
import { generateUuid } from '../../base/common/uuid.js';
import { connectionTokenCookieName, connectionTokenQueryName } from '../../base/common/network.js';
import { ServerParsedArgs } from './serverEnvironmentService.js';
import { Promises } from '../../base/node/pfs.js';
import { Result } from '../../base/common/result.js';
import { InputSanitizer } from '../../platform/security/common/securityUtils.js';
import { EnhancedPerformanceMonitor } from '../../base/common/enhancedPerformance.js';

const connectionTokenRegex = /^[0-9A-Za-z_-]+$/;

export const enum ServerConnectionTokenType {
	None,
	Mandatory
}

export class NoneServerConnectionToken {
	public readonly type = ServerConnectionTokenType.None;

	public validate(connectionToken: any): boolean {
		return true;
	}
}

export class MandatoryServerConnectionToken {
	public readonly type = ServerConnectionTokenType.Mandatory;

	constructor(public readonly value: string) {
	}

	public validate(connectionToken: any): boolean {
		// Enhanced security: Validate token format and content
		if (typeof connectionToken !== 'string') {
			return false;
		}
		
		// Use InputSanitizer to validate the token format
		const sanitized = InputSanitizer.sanitizeInput(connectionToken);
		if (sanitized !== connectionToken) {
			// Token was modified during sanitization, likely malicious
			return false;
		}
		
		// Validate against regex and exact match
		return connectionTokenRegex.test(connectionToken) && connectionToken === this.value;
	}
}

export type ServerConnectionToken = NoneServerConnectionToken | MandatoryServerConnectionToken;

export class ServerConnectionTokenParseError {
	constructor(
		public readonly message: string
	) { }
}

export async function parseServerConnectionToken(args: ServerParsedArgs, defaultValue: () => Promise<string>): Promise<ServerConnectionToken | ServerConnectionTokenParseError> {
	const withoutConnectionToken = args['without-connection-token'];
	const connectionToken = args['connection-token'];
	const connectionTokenFile = args['connection-token-file'];

	if (withoutConnectionToken) {
		if (typeof connectionToken !== 'undefined' || typeof connectionTokenFile !== 'undefined') {
			return new ServerConnectionTokenParseError(`Please do not use the argument '--connection-token' or '--connection-token-file' at the same time as '--without-connection-token'.`);
		}
		return new NoneServerConnectionToken();
	}

	if (typeof connectionTokenFile !== 'undefined') {
		if (typeof connectionToken !== 'undefined') {
			return new ServerConnectionTokenParseError(`Please do not use the argument '--connection-token' at the same time as '--connection-token-file'.`);
		}

		// Enhanced security: Validate file path
		const fileResult = Result.try(() => InputSanitizer.validatePath(connectionTokenFile));
		if (fileResult.isError || !fileResult.value) {
			return new ServerConnectionTokenParseError(`Invalid connection token file path: potential security risk detected.`);
		}

		let rawConnectionToken: string;
		try {
			rawConnectionToken = fs.readFileSync(connectionTokenFile).toString().replace(/\r?\n$/, '');
		} catch (e) {
			return new ServerConnectionTokenParseError(`Unable to read the connection token file at '${connectionTokenFile}'.`);
		}

		// Enhanced validation with security sanitization
		const sanitizedToken = InputSanitizer.sanitizeInput(rawConnectionToken);
		if (sanitizedToken !== rawConnectionToken || !connectionTokenRegex.test(rawConnectionToken)) {
			return new ServerConnectionTokenParseError(`The connection token defined in '${connectionTokenFile}' contains invalid or potentially malicious characters.`);
		}

		return new MandatoryServerConnectionToken(rawConnectionToken);
	}

	if (typeof connectionToken !== 'undefined') {
		// Enhanced validation with security sanitization
		const sanitizedToken = InputSanitizer.sanitizeInput(connectionToken);
		if (sanitizedToken !== connectionToken || !connectionTokenRegex.test(connectionToken)) {
			return new ServerConnectionTokenParseError(`The connection token contains invalid or potentially malicious characters.`);
		}

		return new MandatoryServerConnectionToken(connectionToken);
	}

	return new MandatoryServerConnectionToken(await defaultValue());
}

export async function determineServerConnectionToken(args: ServerParsedArgs): Promise<ServerConnectionToken | ServerConnectionTokenParseError> {
	const readOrGenerateConnectionToken = async () => {
		if (!args['user-data-dir']) {
			// No place to store it!
			return generateUuid();
		}
		const storageLocation = path.join(args['user-data-dir'], 'token');

		// Enhanced security: Validate storage path
		const pathResult = Result.try(() => InputSanitizer.validatePath(storageLocation));
		if (pathResult.isError || !pathResult.value) {
			// Path validation failed, fall back to in-memory token
			return generateUuid();
		}

		// First try to find a connection token using Result pattern
		const fileReadResult = await Result.tryAsync(async () => {
			const fileContents = await fs.promises.readFile(storageLocation);
			return fileContents.toString().replace(/\r?\n$/, '');
		});

		if (fileReadResult.isOk) {
			const connectionToken = fileReadResult.value;
			// Enhanced validation
			const sanitizedToken = InputSanitizer.sanitizeInput(connectionToken);
			if (sanitizedToken === connectionToken && connectionTokenRegex.test(connectionToken)) {
				return connectionToken;
			}
		}

		// No valid connection token found, generate one
		const connectionToken = generateUuid();

		// Try to store it using Result pattern
		const writeResult = await Result.tryAsync(async () => {
			await Promises.writeFile(storageLocation, connectionToken, { mode: 0o600 });
		});

		// If write failed, we still return the token (it will be memory-only)
		// This is better than failing entirely
		
		return connectionToken;
	};
	return parseServerConnectionToken(args, readOrGenerateConnectionToken);
}

export function requestHasValidConnectionToken(connectionToken: ServerConnectionToken, req: http.IncomingMessage, parsedUrl: url.UrlWithParsedQuery) {
	const performanceMonitor = EnhancedPerformanceMonitor.getInstance();
	const timer = performanceMonitor.startTimer('connectionTokenValidation');
	
	try {
		// Enhanced security checks
		if (!req || !parsedUrl) {
			return false;
		}

		// First check if there is a valid query parameter
		const queryToken = parsedUrl.query[connectionTokenQueryName];
		if (queryToken && typeof queryToken === 'string') {
			// Sanitize query parameter
			const sanitizedQueryToken = InputSanitizer.sanitizeInput(queryToken);
			if (sanitizedQueryToken === queryToken && connectionToken.validate(queryToken)) {
				performanceMonitor.recordMetric('connectionTokenValidation.success', 1, 'count');
				return true;
			}
		}

		// Otherwise, check if there is a valid cookie
		const cookieHeader = req.headers.cookie;
		if (cookieHeader && typeof cookieHeader === 'string') {
			// Enhanced cookie parsing with security validation
			const sanitizedCookie = InputSanitizer.sanitizeInput(cookieHeader);
			if (sanitizedCookie === cookieHeader) {
				const cookies = cookie.parse(cookieHeader);
				const cookieToken = cookies[connectionTokenCookieName];
				if (cookieToken && typeof cookieToken === 'string') {
					const sanitizedCookieToken = InputSanitizer.sanitizeInput(cookieToken);
					if (sanitizedCookieToken === cookieToken) {
						const isValid = connectionToken.validate(cookieToken);
						if (isValid) {
							performanceMonitor.recordMetric('connectionTokenValidation.success', 1, 'count');
						} else {
							performanceMonitor.recordMetric('connectionTokenValidation.failed', 1, 'count');
						}
						return isValid;
					}
				}
			}
		}

		performanceMonitor.recordMetric('connectionTokenValidation.failed', 1, 'count');
		return false;
	} finally {
		timer.end();
	}
}
