#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * TODO/FIXME/HACK Finder Script
 * Scans the codebase for TODO, FIXME, HACK, XXX, and BUG comments
 * and generates a comprehensive report
 */

const fs = require('fs');
const path = require('path');

class TODOFinder {
	constructor() {
		this.patterns = [
			{ type: 'TODO', regex: /\/\/\s*TODO[:\s]*(.*)/gi, priority: 'medium' },
			{ type: 'FIXME', regex: /\/\/\s*FIXME[:\s]*(.*)/gi, priority: 'high' },
			{ type: 'HACK', regex: /\/\/\s*HACK[:\s]*(.*)/gi, priority: 'high' },
			{ type: 'XXX', regex: /\/\/\s*XXX[:\s]*(.*)/gi, priority: 'high' },
			{ type: 'BUG', regex: /\/\/\s*BUG[:\s]*(.*)/gi, priority: 'critical' },
			{ type: 'NOTE', regex: /\/\/\s*NOTE[:\s]*(.*)/gi, priority: 'low' },
			{ type: 'WARNING', regex: /\/\/\s*WARNING[:\s]*(.*)/gi, priority: 'medium' }
		];
		this.results = [];
		this.stats = {
			totalFiles: 0,
			filesWithIssues: 0,
			totalIssues: 0,
			byType: {},
			byPriority: { critical: 0, high: 0, medium: 0, low: 0 }
		};
	}

	/**
	 * Scan a directory recursively for TODO items
	 */
	async scanDirectory(dirPath, extensions = ['.ts', '.js', '.tsx', '.jsx']) {
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		
		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			
			if (entry.isDirectory()) {
				// Skip certain directories
				if (this.shouldSkipDirectory(entry.name)) {
					continue;
				}
				await this.scanDirectory(fullPath, extensions);
			} else if (entry.isFile()) {
				// Check if file has a relevant extension
				const ext = path.extname(entry.name);
				if (extensions.includes(ext)) {
					await this.scanFile(fullPath);
				}
			}
		}
	}

	/**
	 * Scan a single file for TODO items
	 */
	async scanFile(filePath) {
		try {
			this.stats.totalFiles++;
			const content = await fs.promises.readFile(filePath, 'utf8');
			const lines = content.split('\n');
			const fileIssues = [];

			lines.forEach((line, lineNumber) => {
				for (const pattern of this.patterns) {
					const matches = line.matchAll(pattern.regex);
					for (const match of matches) {
						const issue = {
							type: pattern.type,
							priority: pattern.priority,
							file: filePath,
							line: lineNumber + 1,
							text: line.trim(),
							description: match[1]?.trim() || '',
							context: this.getContext(lines, lineNumber)
						};
						fileIssues.push(issue);
						this.stats.totalIssues++;
						this.stats.byType[pattern.type] = (this.stats.byType[pattern.type] || 0) + 1;
						this.stats.byPriority[pattern.priority]++;
					}
				}
			});

			if (fileIssues.length > 0) {
				this.stats.filesWithIssues++;
				this.results.push(...fileIssues);
			}
		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error.message);
		}
	}

	/**
	 * Get context lines around the issue
	 */
	getContext(lines, lineNumber, contextLines = 2) {
		const start = Math.max(0, lineNumber - contextLines);
		const end = Math.min(lines.length, lineNumber + contextLines + 1);
		return lines.slice(start, end).map((line, index) => ({
			lineNumber: start + index + 1,
			text: line,
			isTarget: start + index === lineNumber
		}));
	}

	/**
	 * Check if directory should be skipped
	 */
	shouldSkipDirectory(dirName) {
		const skipDirs = [
			'node_modules', '.git', 'out', 'dist', 'build',
			'.vscode', '.vs', 'coverage', 'test-results',
			'extensions', 'remote' // VS Code specific
		];
		return skipDirs.includes(dirName) || dirName.startsWith('.');
	}

	/**
	 * Generate markdown report
	 */
	generateMarkdownReport() {
		let report = `# TODO/FIXME Analysis Report\n\n`;
		report += `Generated on: ${new Date().toISOString()}\n\n`;

		// Statistics
		report += `## 📊 Summary Statistics\n\n`;
		report += `- **Total Files Scanned:** ${this.stats.totalFiles}\n`;
		report += `- **Files with Issues:** ${this.stats.filesWithIssues}\n`;
		report += `- **Total Issues Found:** ${this.stats.totalIssues}\n\n`;

		// By Type
		report += `### By Type\n\n`;
		Object.entries(this.stats.byType).forEach(([type, count]) => {
			report += `- **${type}:** ${count}\n`;
		});

		// By Priority
		report += `\n### By Priority\n\n`;
		Object.entries(this.stats.byPriority).forEach(([priority, count]) => {
			const emoji = this.getPriorityEmoji(priority);
			report += `- ${emoji} **${priority.toUpperCase()}:** ${count}\n`;
		});

		// Group by priority for detailed report
		const byPriority = this.groupByPriority();

		// Critical Issues
		if (byPriority.critical.length > 0) {
			report += `\n## 🚨 Critical Issues\n\n`;
			report += this.formatIssuesList(byPriority.critical);
		}

		// High Priority Issues
		if (byPriority.high.length > 0) {
			report += `\n## ⚠️ High Priority Issues\n\n`;
			report += this.formatIssuesList(byPriority.high);
		}

		// Medium Priority Issues
		if (byPriority.medium.length > 0) {
			report += `\n## 📋 Medium Priority Issues\n\n`;
			report += this.formatIssuesList(byPriority.medium.slice(0, 20)); // Limit to first 20
			if (byPriority.medium.length > 20) {
				report += `\n*... and ${byPriority.medium.length - 20} more medium priority issues*\n`;
			}
		}

		// Low Priority Issues (just count)
		if (byPriority.low.length > 0) {
			report += `\n## 📝 Low Priority Issues: ${byPriority.low.length} items\n\n`;
		}

		// Files with most issues
		report += `\n## 📁 Files with Most Issues\n\n`;
		const fileStats = this.getFileStatistics();
		fileStats.slice(0, 10).forEach((stat, index) => {
			report += `${index + 1}. **${stat.file}** (${stat.count} issues)\n`;
		});

		return report;
	}

	/**
	 * Group issues by priority
	 */
	groupByPriority() {
		return {
			critical: this.results.filter(issue => issue.priority === 'critical'),
			high: this.results.filter(issue => issue.priority === 'high'),
			medium: this.results.filter(issue => issue.priority === 'medium'),
			low: this.results.filter(issue => issue.priority === 'low')
		};
	}

	/**
	 * Format a list of issues
	 */
	formatIssuesList(issues) {
		let output = '';
		issues.forEach(issue => {
			output += `### ${issue.type}: ${issue.file}:${issue.line}\n\n`;
			output += `**Description:** ${issue.description || 'No description'}\n\n`;
			output += `**Code:**\n\`\`\`typescript\n${issue.text}\n\`\`\`\n\n`;
			if (issue.context) {
				output += `<details>\n<summary>Context</summary>\n\n\`\`\`typescript\n`;
				issue.context.forEach(ctx => {
					const marker = ctx.isTarget ? '→ ' : '  ';
					output += `${marker}${ctx.lineNumber}: ${ctx.text}\n`;
				});
				output += `\`\`\`\n</details>\n\n`;
			}
			output += `---\n\n`;
		});
		return output;
	}

	/**
	 * Get file statistics
	 */
	getFileStatistics() {
		const fileMap = new Map();
		this.results.forEach(issue => {
			const relativePath = path.relative(process.cwd(), issue.file);
			fileMap.set(relativePath, (fileMap.get(relativePath) || 0) + 1);
		});

		return Array.from(fileMap.entries())
			.map(([file, count]) => ({ file, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Get priority emoji
	 */
	getPriorityEmoji(priority) {
		const emojis = {
			critical: '🚨',
			high: '⚠️',
			medium: '📋',
			low: '📝'
		};
		return emojis[priority] || '❓';
	}
}

// Main execution
async function main() {
	const finder = new TODOFinder();
	const srcPath = path.join(process.cwd(), 'src');
	
	console.log('🔍 Scanning for TODO/FIXME/HACK items...');
	console.log(`📁 Starting scan from: ${srcPath}`);
	
	const startTime = Date.now();
	await finder.scanDirectory(srcPath);
	const endTime = Date.now();
	
	console.log(`✅ Scan completed in ${endTime - startTime}ms`);
	console.log(`📊 Found ${finder.stats.totalIssues} issues in ${finder.stats.filesWithIssues} files`);
	
	// Generate report
	const report = finder.generateMarkdownReport();
	const reportPath = path.join(process.cwd(), 'TODO_ANALYSIS_REPORT.md');
	
	await fs.promises.writeFile(reportPath, report);
	console.log(`📝 Report generated: ${reportPath}`);
	
	// Also output summary to console
	console.log('\n📋 Summary:');
	Object.entries(finder.stats.byPriority).forEach(([priority, count]) => {
		if (count > 0) {
			console.log(`  ${finder.getPriorityEmoji(priority)} ${priority.toUpperCase()}: ${count}`);
		}
	});
}

if (require.main === module) {
	main().catch(console.error);
}

module.exports = { TODOFinder };