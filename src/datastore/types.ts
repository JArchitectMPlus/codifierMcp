/**
 * TypeScript types for institutional memory data structures
 */

/**
 * A single rule from the institutional memory
 */
export interface Rule {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence?: number;
  patterns?: string[];
  antipatterns?: string[];
  examples?: string[];
  metadata?: RuleMetadata;
}

/**
 * Metadata associated with a rule
 */
export interface RuleMetadata {
  created?: string;
  updated?: string;
  author?: string;
  usageCount?: number;
  tags?: string[];
  [key: string]: any; // Allow additional metadata fields
}

/**
 * Type of insight being captured
 */
export type InsightType = 'do' | 'dont' | 'pattern' | 'antipattern';

/**
 * A single insight to be saved to institutional memory
 */
export interface Insight {
  type: InsightType;
  content: string;
  category?: string;
}

/**
 * Parameters for saving insights
 */
export interface SaveInsightsParams {
  insights: Insight[];
  context: string;
  metadata?: InsightMetadata;
}

/**
 * Metadata for saved insights
 */
export interface InsightMetadata {
  project?: string;
  timestamp?: string;
  author?: string;
  relatedRules?: string[];
  [key: string]: any; // Allow additional metadata fields
}

/**
 * Result of saving insights
 */
export interface SaveInsightsResult {
  success: boolean;
  recordId: string;
  recordTitle: string;
  recordUrl?: string;
  insightCount: number;
}

/**
 * Parameters for fetching rules
 */
export interface FetchRulesParams {
  query?: string;
  category?: string;
  limit?: number;
}

/**
 * Result of fetching rules
 */
export interface FetchRulesResult {
  rules: Rule[];
  totalCount: number;
  source: string;
}

