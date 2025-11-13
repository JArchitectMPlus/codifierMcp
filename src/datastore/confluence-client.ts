/**
 * Confluence REST API Client
 * Direct HTTP integration with Confluence Cloud REST API v1
 */

import { ConfluenceError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for Confluence client
 */
export interface ConfluenceClientConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
}

/**
 * Confluence page structure
 */
export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space?: {
    id: string | number;
    key: string;
    name: string;
  };
  body?: {
    storage: {
      value: string;
      representation: string;
    };
  };
  version?: {
    number: number;
  };
  _links?: {
    base?: string;
    webui?: string;
  };
}

/**
 * Confluence space structure
 */
export interface ConfluenceSpace {
  id: string | number;
  key: string;
  name: string;
  type: string;
  _links?: {
    base?: string;
    webui?: string;
  };
}

/**
 * Search results structure
 */
export interface ConfluenceSearchResult {
  results: ConfluencePage[];
  size: number;
  _links?: {
    base?: string;
    next?: string;
  };
}

/**
 * Direct Confluence REST API client
 */
export class ConfluenceClient {
  readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly spaceKey: string;
  private cloudId: string | null = null;

  constructor(config: ConfluenceClientConfig) {
    // Remove trailing slash from baseUrl
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.spaceKey = config.spaceKey;

    // Create Basic Auth header
    const credentials = `${config.username}:${config.apiToken}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Get cloud ID from Confluence instance
   */
  async getCloudId(): Promise<string> {
    if (this.cloudId) {
      return this.cloudId;
    }

    try {
      logger.debug('Fetching Confluence cloud ID');

      // Extract cloud ID from URL or fetch from API
      // For Confluence Cloud URLs like https://yoursite.atlassian.net
      // we can extract the site name, but we'll verify via API call
      const response = await this.request('GET', '/wiki/rest/api/space', {
        limit: 1,
      });

      if (!response.results || response.results.length === 0) {
        throw new ConfluenceError(
          'Unable to determine cloud ID: No spaces accessible'
        );
      }

      // Extract cloud ID from the base URL
      // For now, we'll use a hash of the baseUrl as a pseudo cloud ID
      this.cloudId = Buffer.from(this.baseUrl).toString('base64').slice(0, 32);

      logger.info('Retrieved Confluence cloud ID', { cloudId: this.cloudId });
      return this.cloudId;
    } catch (error) {
      throw new ConfluenceError(
        `Failed to get cloud ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Health check - verify connectivity to Confluence
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.debug('Performing Confluence health check');

      await this.request('GET', '/wiki/rest/api/space', { limit: 1 });

      logger.debug('Health check passed');
      return true;
    } catch (error) {
      logger.warn(
        'Health check failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Get a specific page by ID
   */
  async getPage(pageId: string): Promise<ConfluencePage> {
    try {
      logger.debug('Fetching Confluence page', { pageId });

      const page = await this.request<ConfluencePage>(
        'GET',
        `/wiki/rest/api/content/${pageId}`,
        {
          expand: 'body.storage,version,space',
        }
      );

      logger.debug('Successfully fetched page', { pageId, title: page.title });
      return page;
    } catch (error) {
      throw new ConfluenceError(
        `Failed to get page ${pageId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for pages using CQL (Confluence Query Language)
   */
  async searchPages(cql: string, limit = 25): Promise<ConfluenceSearchResult> {
    try {
      logger.debug('Searching Confluence pages', { cql, limit });

      const result = await this.request<ConfluenceSearchResult>(
        'GET',
        '/wiki/rest/api/content/search',
        {
          cql,
          limit,
          expand: 'body.storage,version,space',
        }
      );

      logger.debug('Search completed', {
        resultCount: result.results.length,
        total: result.size,
      });

      return result;
    } catch (error) {
      throw new ConfluenceError(
        `Failed to search pages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get space information by key
   */
  async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    try {
      logger.debug('Fetching Confluence space', { spaceKey });

      const space = await this.request<ConfluenceSpace>(
        'GET',
        `/wiki/rest/api/space/${spaceKey}`
      );

      logger.debug('Successfully fetched space', {
        spaceKey,
        name: space.name,
      });
      return space;
    } catch (error) {
      throw new ConfluenceError(
        `Failed to get space ${spaceKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new page in Confluence
   */
  async createPage(params: {
    spaceKey: string;
    title: string;
    body: string;
    parentId?: string;
  }): Promise<ConfluencePage> {
    try {
      logger.debug('Creating Confluence page', {
        spaceKey: params.spaceKey,
        title: params.title,
        hasParent: !!params.parentId,
      });

      const payload: any = {
        type: 'page',
        title: params.title,
        space: {
          key: params.spaceKey,
        },
        body: {
          storage: {
            value: params.body,
            representation: 'storage',
          },
        },
      };

      if (params.parentId) {
        payload.ancestors = [{ id: params.parentId }];
      }

      const page = await this.request<ConfluencePage>(
        'POST',
        '/wiki/rest/api/content',
        undefined,
        payload
      );

      logger.info('Successfully created page', {
        pageId: page.id,
        title: page.title,
      });

      return page;
    } catch (error) {
      throw new ConfluenceError(
        `Failed to create page "${params.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Make an HTTP request to Confluence REST API
   */
  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    queryParams?: Record<string, any>,
    body?: any
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    logger.debug('Making Confluence API request', {
      method,
      url: url.toString(),
      hasBody: !!body,
    });

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Log response status
      logger.debug('Confluence API response', {
        status: response.status,
        statusText: response.statusText,
      });

      // Handle error responses
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }

        throw new ConfluenceError(
          `HTTP ${response.status}: ${errorMessage || response.statusText}`
        );
      }

      // Parse and return JSON response
      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof ConfluenceError) {
        throw error;
      }

      throw new ConfluenceError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
