/**
 * Atlassian Data Store implementation
 * Connects to Confluence via Atlassian MCP server tools
 */

import { IDataStore } from './interface.js';
import {
  FetchRulesParams,
  FetchRulesResult,
  SaveInsightsParams,
  SaveInsightsResult,
  AtlassianResource,
} from './types.js';
import {
  parseRulesFromHtml,
  formatInsightsAsHtml,
  generateInsightPageTitle,
} from './content-parser.js';
import { ConfluenceError, DataStoreError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/env.js';

/**
 * Implementation of IDataStore using Atlassian MCP tools
 *
 * IMPORTANT: This implementation assumes the Atlassian MCP server is configured
 * and accessible to the MCP client. The MCP client handles routing between servers.
 *
 * For MVP, we document that users must configure the Atlassian MCP server
 * alongside CodifierMcp in their MCP client configuration.
 */
export class AtlassianDataStore implements IDataStore {
  private cloudId: string | null = null;
  private initialized = false;
  private atlassianMcpTools: any; // MCP tools will be injected

  /**
   * Create a new Atlassian data store instance
   * @param mcpTools - MCP tools interface for calling Atlassian MCP tools
   */
  constructor(mcpTools?: any) {
    this.atlassianMcpTools = mcpTools;
  }

  /**
   * Set the MCP tools interface (for dependency injection)
   */
  setMcpTools(mcpTools: any): void {
    this.atlassianMcpTools = mcpTools;
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

      // Get cloudId from Atlassian MCP
      this.cloudId = await this.getCloudId();

      // Validate configuration
      const config = getConfig();
      if (!config.CONFLUENCE_SPACE_KEY) {
        throw new DataStoreError('CONFLUENCE_SPACE_KEY not configured');
      }

      this.initialized = true;
      logger.info('AtlassianDataStore initialized successfully', {
        cloudId: this.cloudId,
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
      // Simple health check: try to get cloudId
      const cloudId = await this.getCloudId();
      return !!cloudId;
    } catch (error) {
      logger.warn('Health check failed', error);
      return false;
    }
  }

  /**
   * Get Atlassian Cloud ID
   */
  async getCloudId(): Promise<string> {
    if (this.cloudId) {
      return this.cloudId;
    }

    try {
      logger.debug('Fetching Atlassian cloudId');

      // Call Atlassian MCP tool to get accessible resources
      const result = await this.callAtlassianMcpTool(
        'mcp__atlassian__getAccessibleAtlassianResources',
        {}
      );

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new ConfluenceError(
          'No accessible Atlassian resources found. Ensure Atlassian MCP is configured and you have access.'
        );
      }

      // Use the first available resource
      const resource = result[0] as AtlassianResource;
      this.cloudId = resource.id;

      logger.info('Retrieved Atlassian cloudId', { cloudId: this.cloudId });
      return this.cloudId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ConfluenceError(
        `Failed to get Atlassian cloudId: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
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

      const config = getConfig();
      const cloudId = await this.getCloudId();

      // First, get the space to find the Rules page
      const space = await this.callAtlassianMcpTool(
        'mcp__atlassian__getConfluenceSpaces',
        {
          cloudId,
          keys: [config.CONFLUENCE_SPACE_KEY],
          limit: 1,
        }
      );

      if (!space?.results || space.results.length === 0) {
        throw new ConfluenceError(
          `Confluence space not found: ${config.CONFLUENCE_SPACE_KEY}`
        );
      }

      const spaceId = space.results[0].id;

      // Search for the Rules page in the space
      const pagesResult = await this.callAtlassianMcpTool(
        'mcp__atlassian__getPagesInConfluenceSpace',
        {
          cloudId,
          spaceId: String(spaceId),
          title: config.RULES_PAGE_TITLE,
          limit: 1,
        }
      );

      if (!pagesResult?.results || pagesResult.results.length === 0) {
        throw new ConfluenceError(
          `Rules page not found: "${config.RULES_PAGE_TITLE}" in space ${config.CONFLUENCE_SPACE_KEY}`
        );
      }

      const rulesPageId = pagesResult.results[0].id;

      // Fetch the full page content
      const page = await this.callAtlassianMcpTool(
        'mcp__atlassian__getConfluencePage',
        {
          cloudId,
          pageId: rulesPageId,
        }
      );

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
        source: `Confluence: ${config.CONFLUENCE_SPACE_KEY}/${config.RULES_PAGE_TITLE}`,
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

      const config = getConfig();
      const cloudId = await this.getCloudId();

      // Get the space
      const space = await this.callAtlassianMcpTool(
        'mcp__atlassian__getConfluenceSpaces',
        {
          cloudId,
          keys: [config.CONFLUENCE_SPACE_KEY],
          limit: 1,
        }
      );

      if (!space?.results || space.results.length === 0) {
        throw new ConfluenceError(
          `Confluence space not found: ${config.CONFLUENCE_SPACE_KEY}`
        );
      }

      const spaceId = space.results[0].id;

      // Check if parent page exists, create if needed
      const parentPageId = await this.ensureParentPageExists(
        cloudId,
        String(spaceId)
      );

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
      const result = await this.callAtlassianMcpTool(
        'mcp__atlassian__createConfluencePage',
        {
          cloudId,
          spaceId: String(spaceId),
          parentId: parentPageId,
          title: pageTitle,
          body: htmlContent,
        }
      );

      if (!result?.id) {
        throw new ConfluenceError('Failed to create insights page');
      }

      // Construct page URL
      const pageUrl = `${space.results[0]._links?.base || 'https://your-domain.atlassian.net/wiki'}/pages/${result.id}`;

      logger.info('Successfully saved insights to Confluence', {
        pageId: result.id,
        pageTitle,
      });

      return {
        success: true,
        pageId: result.id,
        pageTitle,
        pageUrl,
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
  private async ensureParentPageExists(
    cloudId: string,
    spaceId: string
  ): Promise<string> {
    const config = getConfig();

    try {
      // Check if parent page exists
      const pagesResult = await this.callAtlassianMcpTool(
        'mcp__atlassian__getPagesInConfluenceSpace',
        {
          cloudId,
          spaceId,
          title: config.INSIGHTS_PARENT_PAGE_TITLE,
          limit: 1,
        }
      );

      if (pagesResult?.results && pagesResult.results.length > 0) {
        logger.debug('Parent page exists', {
          pageId: pagesResult.results[0].id,
        });
        return pagesResult.results[0].id;
      }

      // Parent page doesn't exist, create it
      logger.info('Creating parent page for insights', {
        title: config.INSIGHTS_PARENT_PAGE_TITLE,
      });

      const result = await this.callAtlassianMcpTool(
        'mcp__atlassian__createConfluencePage',
        {
          cloudId,
          spaceId,
          title: config.INSIGHTS_PARENT_PAGE_TITLE,
          body: '<p>This page contains captured insights from AI-driven development sessions.</p>',
        }
      );

      if (!result?.id) {
        throw new ConfluenceError('Failed to create parent page');
      }

      logger.info('Created parent page', { pageId: result.id });
      return result.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ConfluenceError(
        `Failed to ensure parent page exists: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Call an Atlassian MCP tool
   *
   * For MVP: This method throws an informative error if Atlassian MCP tools
   * are not available. In a production setup, the MCP client should handle
   * routing between MCP servers.
   */
  private async callAtlassianMcpTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    logger.debug('Calling Atlassian MCP tool', { toolName, args });

    if (!this.atlassianMcpTools) {
      throw new ConfluenceError(
        `Atlassian MCP tools not available. Ensure the Atlassian MCP server is configured in your MCP client alongside CodifierMcp.

Configuration example (for Claude Desktop):
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-atlassian"]
    },
    "codifier": {
      "command": "node",
      "args": ["/absolute/path/to/codifierMcp/dist/index.js"]
    }
  }
}`
      );
    }

    try {
      // Call the MCP tool through the provided interface
      const result = await this.atlassianMcpTools.callTool(toolName, args);
      logger.debug('Atlassian MCP tool call succeeded', { toolName });
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Atlassian MCP tool call failed', { toolName, error: message });
      throw new ConfluenceError(
        `Atlassian MCP tool "${toolName}" failed: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}