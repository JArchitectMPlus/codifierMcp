/**
 * Data store interface for institutional memory operations
 *
 * This abstraction allows for swapping between different storage backends
 * (e.g., Confluence via Atlassian MCP, Supabase, etc.)
 */

import {
  FetchRulesParams,
  FetchRulesResult,
  SaveInsightsParams,
  SaveInsightsResult,
} from './types.js';

/**
 * Interface for data store operations
 */
export interface IDataStore {
  /**
   * Get the Atlassian Cloud ID for making API calls
   * @returns Promise resolving to the cloud ID
   * @throws {DataStoreError} If unable to retrieve cloud ID
   */
  getCloudId(): Promise<string>;

  /**
   * Fetch rules from the institutional memory
   * @param params - Parameters for filtering and limiting results
   * @returns Promise resolving to rules and metadata
   * @throws {DataStoreError} If unable to fetch rules
   */
  fetchRules(params: FetchRulesParams): Promise<FetchRulesResult>;

  /**
   * Save insights to the institutional memory
   * @param params - Insights to save with context and metadata
   * @returns Promise resolving to save result with page information
   * @throws {DataStoreError} If unable to save insights
   */
  saveInsights(params: SaveInsightsParams): Promise<SaveInsightsResult>;

  /**
   * Initialize the data store connection
   * @throws {DataStoreError} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Health check for the data store connection
   * @returns Promise resolving to true if healthy
   */
  healthCheck(): Promise<boolean>;
}