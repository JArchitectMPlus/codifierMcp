/**
 * Memory Service for legacy insight storage (backward-compatible wrapper)
 *
 * Delegates to the saveInsights method available on SupabaseDataStore
 * (and AtlassianDataStore). Not used by the v2.0 update_memory tool,
 * which calls dataStore.upsertMemory() directly.
 */

import type { Insight, InsightMetadata, SaveInsightsParams, SaveInsightsResult } from '../datastore/types.js';
import { logger } from '../utils/logger.js';
import { DataStoreError } from '../utils/errors.js';

/** Duck-typed interface for stores that support legacy saveInsights */
interface LegacySaveStore {
  saveInsights(params: SaveInsightsParams): Promise<SaveInsightsResult>;
}

export interface SaveInsightItem {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  type: 'do' | 'dont' | 'pattern' | 'antipattern';
}

export interface InsightContext {
  query?: string;
  relatedRules?: string[];
  source?: string;
}

export interface SaveInsightOptions {
  insights: SaveInsightItem[];
  context?: InsightContext;
  metadata?: Record<string, unknown>;
}

export interface SavedRecordInfo {
  title: string;
  url?: string;
  recordId: string;
}

export interface MemoryServiceResult {
  savedRecords: SavedRecordInfo[];
  metadata: {
    totalSaved: number;
    parentRecordId?: string;
    timestamp: string;
  };
}

export class MemoryService {
  constructor(private dataStore: LegacySaveStore) {}

  async saveInsights(options: SaveInsightOptions): Promise<MemoryServiceResult> {
    logger.debug('MemoryService.saveInsights called', {
      insightCount: options.insights.length,
    });

    try {
      const enrichedMetadata = this.enrichMetadata(options);

      const insights: Insight[] = options.insights.map((item) => ({
        type: item.type,
        content: this.formatInsightContent(item),
        category: item.category,
      }));

      const contextString = this.formatContextString(options);

      const result = await this.dataStore.saveInsights({
        insights,
        context: contextString,
        metadata: enrichedMetadata,
      });

      logger.info('Insights saved successfully', {
        recordId: result.recordId,
        insightCount: result.insightCount,
      });

      return {
        savedRecords: [
          {
            title: result.recordTitle,
            url: result.recordUrl,
            recordId: result.recordId,
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

  private enrichMetadata(options: SaveInsightOptions): InsightMetadata {
    const timestamp = new Date().toISOString();

    const categories = new Set<string>();
    const tags = new Set<string>();

    options.insights.forEach((insight) => {
      if (insight.category) categories.add(insight.category);
      if (insight.tags) insight.tags.forEach((tag) => tags.add(tag));
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

  private formatInsightContent(insight: SaveInsightItem): string {
    let formatted = insight.content;

    if (insight.title && insight.title !== insight.content) {
      formatted = `**${insight.title}**: ${formatted}`;
    }

    if (insight.tags && insight.tags.length > 0) {
      const tagString = insight.tags.map((tag) => `#${tag}`).join(' ');
      formatted = `${formatted} [${tagString}]`;
    }

    return formatted;
  }

  private formatContextString(options: SaveInsightOptions): string {
    const parts: string[] = [];

    const insightCount = options.insights.length;
    const typeBreakdown = this.getInsightTypeBreakdown(options.insights);
    parts.push(`Captured ${insightCount} insight${insightCount === 1 ? '' : 's'}: ${typeBreakdown}`);

    if (options.context?.query) parts.push(`Search Query: "${options.context.query}"`);
    if (options.context?.source) parts.push(`Source: ${options.context.source}`);
    if (options.context?.relatedRules && options.context.relatedRules.length > 0) {
      parts.push(`Related Rules: ${options.context.relatedRules.join(', ')}`);
    }

    if (options.metadata && Object.keys(options.metadata).length > 0) {
      const metadataEntries = Object.entries(options.metadata)
        .filter(([key]) => !['timestamp', 'relatedRules'].includes(key))
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(', ');
      if (metadataEntries) parts.push(`Additional Context: ${metadataEntries}`);
    }

    return parts.join(' | ');
  }

  private getInsightTypeBreakdown(insights: SaveInsightItem[]): string {
    const counts: Record<string, number> = { do: 0, dont: 0, pattern: 0, antipattern: 0 };
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
