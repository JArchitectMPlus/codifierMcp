/**
 * Memory Service for enhanced insight storage and formatting
 *
 * Provides enhanced insight management with:
 * - Rich formatting with metadata and context
 * - Cross-reference linking to related rules
 * - Automatic timestamping and categorization
 * - Enhanced Confluence HTML formatting
 */

import type { IDataStore } from '../datastore/interface.js';
import type { Insight, InsightMetadata } from '../datastore/types.js';
import { logger } from '../utils/logger.js';
import { DataStoreError } from '../utils/errors.js';

/**
 * Individual insight to be saved
 */
export interface SaveInsightItem {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  type: 'do' | 'dont' | 'pattern' | 'antipattern';
}

/**
 * Context for insights being saved
 */
export interface InsightContext {
  query?: string;
  relatedRules?: string[];
  source?: string;
}

/**
 * Options for saving insights
 */
export interface SaveInsightOptions {
  insights: SaveInsightItem[];
  context?: InsightContext;
  metadata?: Record<string, unknown>;
}

/**
 * Information about a saved insight page
 */
export interface SavedPageInfo {
  title: string;
  url?: string;
  pageId: string;
}

/**
 * Result of saving insights
 */
export interface MemoryServiceResult {
  savedPages: SavedPageInfo[];
  metadata: {
    totalSaved: number;
    parentPageId?: string;
    timestamp: string;
  };
}

/**
 * Service for managing institutional memory insights
 */
export class MemoryService {
  constructor(private dataStore: IDataStore) {}

  /**
   * Save insights with enhanced formatting and metadata
   *
   * @param options - Insights to save with context and metadata
   * @returns Result with saved page information
   * @throws {DataStoreError} If insight saving fails
   */
  async saveInsights(options: SaveInsightOptions): Promise<MemoryServiceResult> {
    logger.debug('MemoryService.saveInsights called', {
      insightCount: options.insights.length,
    });

    try {
      // Enrich metadata with additional information
      const enrichedMetadata = this.enrichMetadata(options);

      // Convert SaveInsightItem[] to Insight[] for data store
      const insights: Insight[] = options.insights.map((item) => ({
        type: item.type,
        content: this.formatInsightContent(item),
        category: item.category,
      }));

      // Create context string with rich formatting
      const contextString = this.formatContextString(options);

      // Save to data store
      const result = await this.dataStore.saveInsights({
        insights,
        context: contextString,
        metadata: enrichedMetadata,
      });

      logger.info('Insights saved successfully', {
        pageId: result.pageId,
        insightCount: result.insightCount,
      });

      return {
        savedPages: [
          {
            title: result.pageTitle,
            url: result.pageUrl,
            pageId: result.pageId,
          },
        ],
        metadata: {
          totalSaved: result.insightCount,
          timestamp: enrichedMetadata.timestamp as string,
        },
      };
    } catch (error) {
      logger.error('Failed to save insights', { error });
      throw new DataStoreError(
        `Insight saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Enrich metadata with automatic fields
   *
   * @param options - Save insight options
   * @returns Enriched metadata
   */
  private enrichMetadata(options: SaveInsightOptions): InsightMetadata {
    const timestamp = new Date().toISOString();

    // Collect all unique categories and tags
    const categories = new Set<string>();
    const tags = new Set<string>();

    options.insights.forEach((insight) => {
      if (insight.category) {
        categories.add(insight.category);
      }
      if (insight.tags) {
        insight.tags.forEach((tag) => tags.add(tag));
      }
    });

    return {
      timestamp,
      relatedRules: options.context?.relatedRules || [],
      categories: Array.from(categories),
      tags: Array.from(tags),
      query: options.context?.query,
      source: options.context?.source,
      ...options.metadata,
    };
  }

  /**
   * Format individual insight content with title and tags
   *
   * @param insight - Insight item
   * @returns Formatted content string
   */
  private formatInsightContent(insight: SaveInsightItem): string {
    let formatted = insight.content;

    // Add title if provided and different from content
    if (insight.title && insight.title !== insight.content) {
      formatted = `**${insight.title}**: ${formatted}`;
    }

    // Add tags if provided
    if (insight.tags && insight.tags.length > 0) {
      const tagString = insight.tags.map((tag) => `#${tag}`).join(' ');
      formatted = `${formatted} [${tagString}]`;
    }

    return formatted;
  }

  /**
   * Format context string with rich information
   *
   * @param options - Save insight options
   * @returns Formatted context string
   */
  private formatContextString(options: SaveInsightOptions): string {
    const parts: string[] = [];

    // Add insight summary
    const insightCount = options.insights.length;
    const typeBreakdown = this.getInsightTypeBreakdown(options.insights);
    parts.push(
      `Captured ${insightCount} insight${insightCount === 1 ? '' : 's'}: ${typeBreakdown}`
    );

    // Add search context if provided
    if (options.context?.query) {
      parts.push(`Search Query: "${options.context.query}"`);
    }

    // Add source if provided
    if (options.context?.source) {
      parts.push(`Source: ${options.context.source}`);
    }

    // Add related rules if provided
    if (options.context?.relatedRules && options.context.relatedRules.length > 0) {
      parts.push(
        `Related Rules: ${options.context.relatedRules.join(', ')}`
      );
    }

    // Add custom metadata context
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      const metadataEntries = Object.entries(options.metadata)
        .filter(([key]) => !['timestamp', 'relatedRules'].includes(key))
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(', ');

      if (metadataEntries) {
        parts.push(`Additional Context: ${metadataEntries}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Get breakdown of insight types
   *
   * @param insights - Insights to analyze
   * @returns Formatted breakdown string
   */
  private getInsightTypeBreakdown(insights: SaveInsightItem[]): string {
    const counts: Record<string, number> = {
      do: 0,
      dont: 0,
      pattern: 0,
      antipattern: 0,
    };

    insights.forEach((insight) => {
      counts[insight.type] = (counts[insight.type] || 0) + 1;
    });

    const parts: string[] = [];
    if (counts.do > 0) parts.push(`${counts.do} do's`);
    if (counts.dont > 0) parts.push(`${counts.dont} don'ts`);
    if (counts.pattern > 0) parts.push(`${counts.pattern} patterns`);
    if (counts.antipattern > 0) parts.push(`${counts.antipattern} anti-patterns`);

    return parts.join(', ') || 'no insights';
  }
}
