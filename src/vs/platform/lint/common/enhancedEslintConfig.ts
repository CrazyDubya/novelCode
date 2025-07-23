/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Enhanced ESLint configuration with additional security and code quality rules
 * This extends the base configuration with more strict rules
 */

export const enhancedSecurityRules = {
	// Security Rules
	'no-eval': 'error',
	'no-implied-eval': 'error', 
	'no-new-func': 'error',
	'no-script-url': 'error',
	'no-proto': 'error',
	'no-caller': 'error',
	'no-extend-native': 'error',
	'no-global-assign': 'error',
	'no-implicit-globals': 'error',
	
	// Prevent potential XSS
	'no-inner-declarations': 'error',
	'no-multi-str': 'error',
	'no-new-wrappers': 'error',
	
	// Type safety
	'no-implicit-coercion': 'warn',
	'no-magic-numbers': ['warn', { 
		'ignore': [-1, 0, 1, 2], 
		'ignoreArrayIndexes': true,
		'ignoreDefaultValues': true 
	}],
	'strict': ['error', 'never'],
};

export const enhancedCodeQualityRules = {
	// Complexity and maintainability
	'complexity': ['warn', 15],
	'max-depth': ['warn', 4],
	'max-lines-per-function': ['warn', { max: 100, skipComments: true, skipBlankLines: true }],
	'max-nested-callbacks': ['warn', 4],
	'max-params': ['warn', 6],
	'max-statements': ['warn', 20],
	
	// Code style and readability
	'consistent-return': 'warn',
	'default-case': 'warn',
	'default-case-last': 'warn',
	'dot-notation': 'warn',
	'grouped-accessor-pairs': 'warn',
	'guard-for-in': 'warn',
	'no-console': 'warn',
	'no-debugger': 'error',
	'no-alert': 'error',
	'no-else-return': 'warn',
	'no-empty-function': 'warn',
	'no-lonely-if': 'warn',
	'no-multi-assign': 'warn',
	'no-nested-ternary': 'warn',
	'no-param-reassign': 'warn',
	'no-return-assign': 'error',
	'no-return-await': 'warn',
	'no-self-compare': 'error',
	'no-sequences': 'error',
	'no-throw-literal': 'error',
	'no-unmodified-loop-condition': 'error',
	'no-unreachable-loop': 'error',
	'no-unused-expressions': 'warn',
	'no-useless-call': 'warn',
	'no-useless-concat': 'warn',
	'no-useless-return': 'warn',
	'no-void': 'error',
	'prefer-promise-reject-errors': 'error',
	'prefer-regex-literals': 'warn',
	'radix': 'warn',
	'require-await': 'warn',
	'yoda': 'warn',
	
	// Variable declarations
	'init-declarations': ['warn', 'always'],
	'no-label-var': 'error',
	'no-shadow': 'warn',
	'no-undef-init': 'warn',
	'no-undefined': 'warn',
	'no-use-before-define': 'warn',
};

export const enhancedTypeScriptRules = {
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/no-unsafe-assignment': 'warn',
	'@typescript-eslint/no-unsafe-member-access': 'warn',
	'@typescript-eslint/no-unsafe-call': 'warn',
	'@typescript-eslint/no-unsafe-return': 'warn',
	'@typescript-eslint/prefer-nullish-coalescing': 'warn',
	'@typescript-eslint/prefer-optional-chain': 'warn',
	'@typescript-eslint/prefer-readonly': 'warn',
	'@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for most codebases
	'@typescript-eslint/prefer-as-const': 'warn',
	'@typescript-eslint/no-unnecessary-type-assertion': 'warn',
	'@typescript-eslint/no-unnecessary-condition': 'warn',
	'@typescript-eslint/strict-boolean-expressions': 'off', // Too strict
	'@typescript-eslint/switch-exhaustiveness-check': 'warn',
	'@typescript-eslint/prefer-string-starts-ends-with': 'warn',
	'@typescript-eslint/prefer-includes': 'warn',
	'@typescript-eslint/no-non-null-assertion': 'warn',
	'@typescript-eslint/no-unused-vars': ['warn', { 
		'argsIgnorePattern': '^_',
		'varsIgnorePattern': '^_',
		'caughtErrorsIgnorePattern': '^_'
	}],
	'@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
	'@typescript-eslint/consistent-type-imports': ['warn', { 
		'prefer': 'type-imports',
		'disallowTypeAnnotations': false 
	}],
	'@typescript-eslint/method-signature-style': ['warn', 'property'],
	'@typescript-eslint/no-confusing-void-expression': 'warn',
	'@typescript-eslint/no-duplicate-enum-values': 'error',
	'@typescript-eslint/no-redundant-type-constituents': 'warn',
	'@typescript-eslint/no-useless-empty-export': 'warn',
	'@typescript-eslint/prefer-enum-initializers': 'warn',
	'@typescript-eslint/prefer-for-of': 'warn',
	'@typescript-eslint/prefer-function-type': 'warn',
	'@typescript-eslint/prefer-literal-enum-member': 'warn',
	'@typescript-eslint/prefer-namespace-keyword': 'warn',
	'@typescript-eslint/prefer-reduce-type-parameter': 'warn',
	'@typescript-eslint/prefer-return-this-type': 'warn',
	'@typescript-eslint/prefer-ts-expect-error': 'warn',
	'@typescript-eslint/promise-function-async': 'warn',
	'@typescript-eslint/require-array-sort-compare': 'warn',
	'@typescript-eslint/sort-type-constituents': 'warn',
	'@typescript-eslint/unified-signatures': 'warn',
};

/**
 * Complete enhanced configuration
 */
export const enhancedEslintConfig = {
	// Combine all rule sets
	rules: {
		...enhancedSecurityRules,
		...enhancedCodeQualityRules,
		...enhancedTypeScriptRules,
	},
	
	// Additional parser options for enhanced TypeScript support
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
		project: './tsconfig.json',
		tsconfigRootDir: '.',
	},
	
	// Additional environments
	env: {
		browser: true,
		node: true,
		es2022: true,
		worker: true,
	},
	
	// Override specific file patterns
	overrides: [
		{
			files: ['**/*.test.ts', '**/*.test.js'],
			rules: {
				// Relax some rules for test files
				'@typescript-eslint/no-explicit-any': 'off',
				'no-magic-numbers': 'off',
				'max-lines-per-function': 'off',
				'max-statements': 'off',
			}
		},
		{
			files: ['**/*.d.ts'],
			rules: {
				// Type definition files have different requirements
				'@typescript-eslint/no-explicit-any': 'off',
				'@typescript-eslint/consistent-type-definitions': 'off',
			}
		},
		{
			files: ['**/build/**', '**/scripts/**'],
			rules: {
				// Build scripts can be more lenient
				'no-console': 'off',
				'no-magic-numbers': 'off',
				'@typescript-eslint/no-var-requires': 'off',
			}
		}
	]
};

/**
 * Security-focused configuration subset for critical files
 */
export const securityFocusedConfig = {
	rules: {
		...enhancedSecurityRules,
		// Make security rules even stricter
		'no-eval': 'error',
		'no-implied-eval': 'error',
		'no-new-func': 'error',
		'no-script-url': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-unsafe-assignment': 'error',
		'@typescript-eslint/no-unsafe-member-access': 'error',
		'@typescript-eslint/no-unsafe-call': 'error',
		'@typescript-eslint/no-unsafe-return': 'error',
	}
};