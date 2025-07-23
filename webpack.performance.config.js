/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

/**
 * Enhanced webpack configuration for performance optimization
 */
module.exports = (env, argv) => {
	const isProduction = argv.mode === 'production';
	const isDevelopment = !isProduction;

	return {
		// Enhanced optimization settings
		optimization: {
			// Split chunks for better caching
			splitChunks: {
				chunks: 'all',
				cacheGroups: {
					// Vendor dependencies
					vendor: {
						test: /[\\/]node_modules[\\/]/,
						name: 'vendors',
						priority: 10,
						reuseExistingChunk: true,
					},
					// Common code between modules
					common: {
						name: 'common',
						minChunks: 2,
						priority: 5,
						reuseExistingChunk: true,
					},
					// Large libraries that change infrequently
					framework: {
						test: /[\\/]node_modules[\\/](react|react-dom|lodash|moment)[\\/]/,
						name: 'framework',
						priority: 15,
					},
				},
			},

			// Runtime chunk for better long-term caching
			runtimeChunk: {
				name: 'runtime',
			},

			// Minimize bundle size in production
			minimize: isProduction,
			minimizer: [
				// Already handled by webpack defaults with terser-webpack-plugin
			],

			// Tree shaking optimization
			usedExports: true,
			sideEffects: false,
		},

		// Performance budgets and warnings
		performance: {
			maxAssetSize: 250000, // 250kb
			maxEntrypointSize: 250000,
			hints: isProduction ? 'error' : 'warning',
		},

		// Enhanced module resolution
		resolve: {
			// Add module extensions for better tree shaking
			extensions: ['.ts', '.js', '.json'],
			
			// Alias for easier imports and better bundling
			alias: {
				'@': path.resolve(__dirname, 'src'),
				'@components': path.resolve(__dirname, 'src/components'),
				'@utils': path.resolve(__dirname, 'src/utils'),
				'@services': path.resolve(__dirname, 'src/services'),
			},

			// Module resolution optimizations
			modules: ['node_modules'],
			symlinks: false,
		},

		// Module processing rules
		module: {
			rules: [
				{
					test: /\.ts$/,
					use: [
						{
							loader: 'ts-loader',
							options: {
								transpileOnly: isDevelopment, // Faster builds in dev
								experimentalWatchApi: true,
							},
						},
					],
					exclude: /node_modules/,
				},
				{
					test: /\.css$/,
					use: [
						'style-loader',
						{
							loader: 'css-loader',
							options: {
								modules: {
									mode: 'local',
									localIdentName: isProduction 
										? '[hash:base64:5]' 
										: '[name]__[local]--[hash:base64:5]',
								},
							},
						},
					],
				},
				{
					test: /\.(png|jpg|jpeg|gif|svg)$/,
					type: 'asset/resource',
					generator: {
						filename: 'images/[name].[contenthash][ext]',
					},
				},
			],
		},

		// Plugins for optimization and analysis
		plugins: [
			// Define environment variables
			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
				'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
			}),

			// Bundle analyzer (optional, for development)
			...(process.env.ANALYZE ? [
				new BundleAnalyzerPlugin({
					analyzerMode: 'static',
					openAnalyzer: false,
					reportFilename: 'bundle-report.html',
				})
			] : []),

			// Progress tracking
			new webpack.ProgressPlugin({
				activeModules: true,
				entries: true,
				modules: true,
				dependencies: true,
			}),
		],

		// Development server configuration
		devServer: isDevelopment ? {
			hot: true,
			compress: true,
			historyApiFallback: true,
			static: {
				directory: path.join(__dirname, 'public'),
			},
			client: {
				overlay: {
					errors: true,
					warnings: false,
				},
			},
		} : undefined,

		// Source maps for debugging
		devtool: isProduction ? 'source-map' : 'eval-source-map',

		// Output configuration
		output: {
			filename: isProduction 
				? '[name].[contenthash].js' 
				: '[name].js',
			chunkFilename: isProduction 
				? '[name].[contenthash].chunk.js' 
				: '[name].chunk.js',
			clean: true, // Clean output directory
		},

		// External dependencies (don't bundle these)
		externals: {
			// Common libraries that might be provided externally
			'electron': 'commonjs electron',
			'vscode': 'commonjs vscode',
		},

		// Cache configuration for faster builds
		cache: {
			type: 'filesystem',
			buildDependencies: {
				config: [__filename],
			},
		},

		// Experiments and advanced features
		experiments: {
			// Enable top-level await
			topLevelAwait: true,
		},
	};
};

/**
 * Bundle size analysis utilities
 */
const bundleAnalysis = {
	/**
	 * Analyze bundle size and provide recommendations
	 */
	analyzeBundleSize: (stats) => {
		const assets = stats.toJson().assets;
		const recommendations = [];

		assets.forEach(asset => {
			const sizeInKB = asset.size / 1024;
			
			if (sizeInKB > 500) {
				recommendations.push({
					type: 'warning',
					message: `Large asset detected: ${asset.name} (${sizeInKB.toFixed(2)}KB)`,
					suggestions: [
						'Consider code splitting',
						'Check for duplicate dependencies',
						'Optimize images and assets',
					],
				});
			}
		});

		return recommendations;
	},

	/**
	 * Check for common performance issues
	 */
	checkPerformanceIssues: (stats) => {
		const issues = [];
		const compilation = stats.compilation;

		// Check for circular dependencies
		const modules = compilation.modules;
		// Implementation would check for circular dependencies

		// Check for large modules
		modules.forEach(module => {
			if (module.size > 100000) { // 100KB
				issues.push({
					type: 'large-module',
					module: module.identifier(),
					size: module.size,
				});
			}
		});

		return issues;
	},
};

module.exports.bundleAnalysis = bundleAnalysis;