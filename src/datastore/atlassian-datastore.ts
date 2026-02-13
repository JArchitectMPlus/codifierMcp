/**
 * Atlassian Data Store implementation
 * Connects directly to Confluence via REST API
 */

import { IDataStore } from './interface.js';
import {
  FetchRulesParams,
  FetchRulesResult,
  SaveInsightsParams,
  SaveInsightsResult,
} from './types.js';
import {
  parseRulesFromHtml,
  formatInsightsAsHtml,
  generateInsightPageTitle,
} from './content-parser.js';
import { ConfluenceError, DataStoreError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ConfluenceClient } from './confluence-client.js';

/**
 * Configuration for AtlassianDataStore
 */
export interface AtlassianDataStoreConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
  rulesPageTitle: string;
  insightsParentPageTitle: string;
}

/**
 * Implementation of IDataStore using direct Confluence REST API
 */
export class AtlassianDataStore implements IDataStore {
  private confluenceClient: ConfluenceClient;
  private initialized = false;
  private readonly spaceKey: string;
  private readonly rulesPageTitle: string;
  private readonly insightsParentPageTitle: string;

  /**
   * Create a new Atlassian data store instance
   */
  constructor(config: AtlassianDataStoreConfig) {
    this.spaceKey = config.spaceKey;
    this.rulesPageTitle = config.rulesPageTitle;
    this.insightsParentPageTitle = config.insightsParentPageTitle;

    this.confluenceClient = new ConfluenceClient({
      baseUrl: config.baseUrl,
      username: config.username,
      apiToken: config.apiToken,
      spaceKey: config.spaceKey,
    });
  }

  /**
   * Initialize the data store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('AtlassianDataStore already initialized');
      return;
    }

    try {
      logger.info('Initializing AtlassianDataStore');

      // Perform health check to verify connectivity
      const isHealthy = await this.confluenceClient.healthCheck();
      if (!isHealthy) {
        throw new DataStoreError(
          'Confluence health check failed - unable to connect'
        );
      }

      // Verify space exists
      await this.confluenceClient.getSpace(this.spaceKey);

      this.initialized = true;
      logger.info('AtlassianDataStore initialized successfully', {
        spaceKey: this.spaceKey,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize AtlassianDataStore', message);
      throw new DataStoreError(
        `Failed to initialize data store: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.confluenceClient.healthCheck();
    } catch (error) {
      logger.warn('Health check failed', error);
      return false;
    }
  }

  /**
   * Get Atlassian Cloud ID (store identifier for this backend)
   * This delegates to the ConfluenceClient
   */
  async getStoreId(): Promise<string> {
    return await this.confluenceClient.getCloudId();
  }

  /**
   * Fetch rules from Confluence
   */
  async fetchRules(params: FetchRulesParams): Promise<FetchRulesResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Fetching rules from Confluence', params);

      // Search for the Rules page using CQL
      const cql = `space="${this.spaceKey}" AND title="${this.rulesPageTitle}" AND type=page`;
      const searchResult = await this.confluenceClient.searchPages(cql, 1);

      if (!searchResult.results || searchResult.results.length === 0) {
        throw new ConfluenceError(
          `Rules page not found: "${this.rulesPageTitle}" in space ${this.spaceKey}`
        );
      }

      const rulesPage = searchResult.results[0];

      // Get full page content if not already expanded
      const page = rulesPage.body?.storage?.value
        ? rulesPage
        : await this.confluenceClient.getPage(rulesPage.id);

      if (!page?.body?.storage?.value) {
        throw new ConfluenceError('Rules page has no content');
      }

      // Parse rules from HTML
      const rules = parseRulesFromHtml(page.body.storage.value);

      // Apply filters
      let filteredRules = rules;

      // Filter by query (text search in title, description, category)
      if (params.query) {
        const query = params.query.toLowerCase();
        filteredRules = filteredRules.filter(
          (rule) =>
            rule.title.toLowerCase().includes(query) ||
            rule.description.toLowerCase().includes(query) ||
            rule.category.toLowerCase().includes(query)
        );
      }

      // Filter by category
      if (params.category) {
        const category = params.category.toLowerCase();
        filteredRules = filteredRules.filter(
          (rule) => rule.category.toLowerCase() === category
        );
      }

      // Apply limit
      if (params.limit && params.limit > 0) {
        filteredRules = filteredRules.slice(0, params.limit);
      }

      logger.info(
        `Fetched ${filteredRules.length} rules (total: ${rules.length})`,
        params
      );

      return {
        rules: filteredRules,
        totalCount: rules.length,
        source: `Confluence: ${this.spaceKey}/${this.rulesPageTitle}`,
      };
    } catch (error) {
      if (error instanceof ConfluenceError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch rules', message);
      throw new ConfluenceError(
        `Failed to fetch rules: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Save insights to Confluence
   */
  async saveInsights(
    params: SaveInsightsParams
  ): Promise<SaveInsightsResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Saving insights to Confluence', {
        insightCount: params.insights.length,
        context: params.context,
      });

      // Get the space
      const space = await this.confluenceClient.getSpace(this.spaceKey);

      // Check if parent page exists, create if needed
      const parentPageId = await this.ensureParentPageExists();

      // Generate page title
      const pageTitle = generateInsightPageTitle(
        params.context,
        params.metadata?.timestamp
      );

      // Format insights as HTML
      const htmlContent = formatInsightsAsHtml(
        params.insights,
        params.context,
        params.metadata
      );

      // Create the insights page
      const page = await this.confluenceClient.createPage({
        spaceKey: this.spaceKey,
        title: pageTitle,
        body: htmlContent,
        parentId: parentPageId,
      });

      // Construct page URL
      const baseUrl = space._links?.base || this.confluenceClient.baseUrl;
      const pageUrl = page._links?.webui
        ? `${baseUrl}${page._links.webui}`
        : `${baseUrl}/pages/${page.id}`;

      logger.info('Successfully saved insights to Confluence', {
        pageId: page.id,
        pageTitle,
      });

      return {
        success: true,
        recordId: page.id,
        recordTitle: pageTitle,
        recordUrl: pageUrl,
        insightCount: params.insights.length,
      };
    } catch (error) {
      if (error instanceof ConfluenceError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save insights', message);
      throw new ConfluenceError(
        `Failed to save insights: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Ensure the parent page for insights exists
   * Creates it if it doesn't exist
   */
  private async ensureParentPageExists(): Promise<string> {
    try {
      // Check if parent page exists using CQL
      const cql = `space="${this.spaceKey}" AND title="${this.insightsParentPageTitle}" AND type=page`;
      const searchResult = await this.confluenceClient.searchPages(cql, 1);

      if (searchResult?.results && searchResult.results.length > 0) {
        logger.debug('Parent page exists', {
          pageId: searchResult.results[0].id,
        });
        return searchResult.results[0].id;
      }

      // Parent page doesn't exist, create it
      logger.info('Creating parent page for insights', {
        title: this.insightsParentPageTitle,
      });

      const page = await this.confluenceClient.createPage({
        spaceKey: this.spaceKey,
        title: this.insightsParentPageTitle,
        body: '<p>This page contains captured insights from AI-driven development sessions.</p>',
      });

      logger.info('Created parent page', { pageId: page.id });
      return page.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ConfluenceError(
        `Failed to ensure parent page exists: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}