/**
 * Context Service for legacy rule retrieval (backward-compatible wrapper)
 *
 * Delegates to the fetchRules method available on SupabaseDataStore
 * (and AtlassianDataStore). Not used by the v2.0 fetch_context tool,
 * which calls dataStore.fetchMemories() directly.
 */

import type { Rule } from '../datastore/types.js';
import { logger } from '../utils/logger.js';
import { DataStoreError } from '../utils/errors.js';
import type { FetchRulesParams, FetchRulesResult } from '../datastore/types.js';

/** Duck-typed interface for stores that support legacy fetchRules */
interface LegacyFetchStore {
  fetchRules(params: FetchRulesParams): Promise<FetchRulesResult>;
}

export interface ContextServiceOptions {
  query?: string;
  contextType?: string;
  category?: string;
  limit?: number;
}

export interface ContextMetadata {
  totalFound: number;
  filtered: number;
  query?: string;
  appliedFilters: {
    category?: string;
    contextType?: string;
    limit?: number;
  };
}

export interface ContextServiceResult {
  rules: Rule[];
  metadata: ContextMetadata;
}

interface ScoredRule {
  rule: Rule;
  score: number;
}

export class ContextService {
  constructor(private dataStore: LegacyFetchStore) {}

  async fetchContext(options: ContextServiceOptions): Promise<ContextServiceResult> {
    logger.debug('ContextService.fetchContext called', options);

    try {
      const fetchResult = await this.dataStore.fetchRules({
        category: options.category,
        limit: undefined,
      });

      logger.debug('Rules fetched from data store', { count: fetchResult.rules.length });

      let filteredRules = fetchResult.rules;
      const totalFound = filteredRules.length;

      if (options.contextType && options.contextType !== 'all') {
        filteredRules = this.filterByContextType(filteredRules, options.contextType);
        logger.debug('Applied context type filter', {
          contextType: options.contextType,
          remaining: filteredRules.length,
        });
      }

      let scoredRules: ScoredRule[];
      if (options.query && options.query.trim()) {
        scoredRules = this.scoreRulesByRelevance(filteredRules, options.query);
        logger.debug('Applied relevance scoring', {
          query: options.query,
          scoredCount: scoredRules.length,
        });
      } else {
        scoredRules = filteredRules.map((rule) => ({ rule, score: 0 }));
      }

      scoredRules.sort((a, b) => b.score - a.score);

      const limit = options.limit ?? 10;
      const limitedRules = scoredRules.slice(0, limit);

      logger.info('Context retrieval complete', {
        totalFound,
        filtered: scoredRules.length,
        returned: limitedRules.length,
      });

      return {
        rules: limitedRules.map((sr) => sr.rule),
        metadata: {
          totalFound,
          filtered: scoredRules.length,
          query: options.query,
          appliedFilters: {
            category: options.category,
            contextType: options.contextType,
            limit,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to fetch context', { error });
      throw new DataStoreError(
        `Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private filterByContextType(rules: Rule[], contextType: string): Rule[] {
    const contextTypeMap: Record<string, string[]> = {
      security: ['security', 'authentication', 'authorization'],
      testing: ['testing', 'test', 'quality-assurance'],
      architecture: ['architecture', 'design', 'patterns'],
      'code-quality': ['code-quality', 'best-practices', 'standards'],
      mcp: ['mcp-protocol', 'mcp'],
      configuration: ['configuration', 'config', 'environment'],
    };

    const matchingCategories = contextTypeMap[contextType.toLowerCase()] || [contextType];

    return rules.filter((rule) =>
      matchingCategories.some((cat) =>
        rule.category.toLowerCase().includes(cat.toLowerCase())
      )
    );
  }

  private scoreRulesByRelevance(rules: Rule[], query: string): ScoredRule[] {
    const queryLower = query.toLowerCase().trim();
    const queryTerms = queryLower.split(/\s+/);

    return rules
      .map((rule) => {
        let score = 0;

        const titleLower = rule.title.toLowerCase();
        if (titleLower === queryLower) {
          score += 10;
        } else if (titleLower.includes(queryLower)) {
          score += 5;
        } else {
          queryTerms.forEach((term) => {
            if (titleLower.includes(term)) score += 2;
          });
        }

        if (rule.id.toLowerCase().includes(queryLower)) score += 3;

        const descLower = rule.description.toLowerCase();
        if (descLower.includes(queryLower)) {
          score += 2;
        } else {
          queryTerms.forEach((term) => {
            if (descLower.includes(term)) score += 1;
          });
        }

        const patterns = [...(rule.patterns || []), ...(rule.antipatterns || [])];
        patterns.forEach((pattern) => {
          if (pattern.toLowerCase().includes(queryLower)) score += 1;
        });

        (rule.examples || []).forEach((example) => {
          if (example.toLowerCase().includes(queryLower)) score += 1;
        });

        return { rule, score };
      })
      .filter((sr) => sr.score > 0);
  }
}
