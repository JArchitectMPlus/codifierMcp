/**
 * Content parser for Confluence HTML <-> YAML/Markdown conversion
 */

import * as yaml from 'js-yaml';
import { Rule, Insight, InsightMetadata } from './types.js';
import { ParseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Extract YAML code blocks from Confluence HTML content
 * Supports both structured-macro and simple code block formats
 */
export function extractYamlFromHtml(htmlContent: string): string | null {
  logger.debug('Extracting YAML from HTML content');

  // Try Confluence structured macro format first
  const structuredMacroRegex =
    /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="language"[^>]*>yaml<\/ac:parameter>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/i;

  let match = htmlContent.match(structuredMacroRegex);
  if (match && match[1]) {
    logger.debug('Found YAML in structured macro format');
    return match[1].trim();
  }

  // Try simple code block format
  const codeBlockRegex =
    /<pre><code class="language-yaml">([\s\S]*?)<\/code><\/pre>/i;

  match = htmlContent.match(codeBlockRegex);
  if (match && match[1]) {
    logger.debug('Found YAML in code block format');
    // Decode HTML entities
    return decodeHtmlEntities(match[1].trim());
  }

  // Try alternative code block formats
  const altCodeBlockRegex =
    /<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/i;

  match = htmlContent.match(altCodeBlockRegex);
  if (match && match[1]) {
    logger.debug('Found YAML in plain-text-body format');
    return match[1].trim();
  }

  logger.warn('No YAML content found in HTML');
  return null;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Parse YAML rules from extracted YAML string
 */
export function parseYamlRules(yamlContent: string): Rule[] {
  logger.debug('Parsing YAML rules');

  try {
    const parsed = yaml.load(yamlContent) as any;

    if (!parsed || typeof parsed !== 'object') {
      throw new ParseError('YAML content is not a valid object');
    }

    // Handle different YAML structures
    let rulesArray: any[];

    if (Array.isArray(parsed)) {
      // YAML is a direct array of rules
      rulesArray = parsed;
    } else if (parsed.rules && Array.isArray(parsed.rules)) {
      // YAML has a 'rules' property with an array
      rulesArray = parsed.rules;
    } else {
      throw new ParseError(
        'YAML structure must be an array or have a "rules" property with an array'
      );
    }

    // Validate and transform rules
    const rules: Rule[] = rulesArray.map((rule, index) => {
      if (!rule.id || !rule.category || !rule.title) {
        throw new ParseError(
          `Rule at index ${index} is missing required fields (id, category, title)`
        );
      }

      return {
        id: String(rule.id),
        category: String(rule.category),
        title: String(rule.title),
        description: String(rule.description || ''),
        confidence: rule.confidence ? Number(rule.confidence) : undefined,
        patterns: Array.isArray(rule.patterns) ? rule.patterns : undefined,
        antipatterns: Array.isArray(rule.antipatterns)
          ? rule.antipatterns
          : undefined,
        examples: Array.isArray(rule.examples) ? rule.examples : undefined,
        metadata: rule.metadata || undefined,
      };
    });

    logger.info(`Successfully parsed ${rules.length} rules from YAML`);
    return rules;
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new ParseError(`Failed to parse YAML: ${errorMessage}`, yamlContent);
  }
}

/**
 * Parse rules from Confluence HTML content
 * Combines extraction and parsing steps
 */
export function parseRulesFromHtml(htmlContent: string): Rule[] {
  const yamlContent = extractYamlFromHtml(htmlContent);

  if (!yamlContent) {
    throw new ParseError('No YAML content found in HTML');
  }

  return parseYamlRules(yamlContent);
}

/**
 * Format insights as Confluence HTML
 * Creates a structured page with sections for each insight type
 */
export function formatInsightsAsHtml(
  insights: Insight[],
  context: string,
  metadata?: InsightMetadata
): string {
  logger.debug('Formatting insights as HTML', { count: insights.length });

  // Group insights by type
  const groupedInsights: Record<string, Insight[]> = {
    do: [],
    dont: [],
    pattern: [],
    antipattern: [],
  };

  insights.forEach((insight) => {
    if (groupedInsights[insight.type]) {
      groupedInsights[insight.type].push(insight);
    }
  });

  // Build HTML sections
  const sections: string[] = [];

  // Context section
  sections.push(`<h2>Context</h2>`);
  sections.push(`<p>${escapeHtml(context)}</p>`);

  // Metadata section (if provided)
  if (metadata && Object.keys(metadata).length > 0) {
    sections.push(`<h2>Metadata</h2>`);
    sections.push(`<ul>`);

    if (metadata.project) {
      sections.push(`<li><strong>Project:</strong> ${escapeHtml(metadata.project)}</li>`);
    }
    if (metadata.timestamp) {
      sections.push(`<li><strong>Timestamp:</strong> ${escapeHtml(metadata.timestamp)}</li>`);
    }
    if (metadata.author) {
      sections.push(`<li><strong>Author:</strong> ${escapeHtml(metadata.author)}</li>`);
    }
    if (metadata.relatedRules && metadata.relatedRules.length > 0) {
      sections.push(
        `<li><strong>Related Rules:</strong> ${metadata.relatedRules.map(escapeHtml).join(', ')}</li>`
      );
    }

    sections.push(`</ul>`);
  }

  // Do's section
  if (groupedInsights.do.length > 0) {
    sections.push(`<h2>Do's</h2>`);
    sections.push(`<ul>`);
    groupedInsights.do.forEach((insight) => {
      const category = insight.category
        ? ` <em>(${escapeHtml(insight.category)})</em>`
        : '';
      sections.push(`<li>${escapeHtml(insight.content)}${category}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Don'ts section
  if (groupedInsights.dont.length > 0) {
    sections.push(`<h2>Don'ts</h2>`);
    sections.push(`<ul>`);
    groupedInsights.dont.forEach((insight) => {
      const category = insight.category
        ? ` <em>(${escapeHtml(insight.category)})</em>`
        : '';
      sections.push(`<li>${escapeHtml(insight.content)}${category}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Patterns section
  if (groupedInsights.pattern.length > 0) {
    sections.push(`<h2>Patterns</h2>`);
    sections.push(`<ul>`);
    groupedInsights.pattern.forEach((insight) => {
      const category = insight.category
        ? ` <em>(${escapeHtml(insight.category)})</em>`
        : '';
      sections.push(`<li>${escapeHtml(insight.content)}${category}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Anti-patterns section
  if (groupedInsights.antipattern.length > 0) {
    sections.push(`<h2>Anti-patterns</h2>`);
    sections.push(`<ul>`);
    groupedInsights.antipattern.forEach((insight) => {
      const category = insight.category
        ? ` <em>(${escapeHtml(insight.category)})</em>`
        : '';
      sections.push(`<li>${escapeHtml(insight.content)}${category}</li>`);
    });
    sections.push(`</ul>`);
  }

  const html = sections.join('\n');
  logger.debug('Successfully formatted insights as HTML');

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => entities[char] || char);
}

/**
 * Generate page title for insights
 */
export function generateInsightPageTitle(
  context: string,
  timestamp?: string
): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

  // Truncate context if too long
  const maxContextLength = 50;
  const truncatedContext =
    context.length > maxContextLength
      ? context.substring(0, maxContextLength) + '...'
      : context;

  return `Insight: ${truncatedContext} (${dateStr})`;
}