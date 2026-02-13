/**
 * Confluence-specific type definitions
 *
 * These types are specific to the Confluence backend and are not part of the
 * generic IDataStore abstraction.
 */

/**
 * Confluence page information
 */
export interface ConfluencePage {
  id: string;
  title: string;
  body: {
    storage: {
      value: string; // HTML content
      representation: 'storage';
    };
  };
  version?: {
    number: number;
  };
  metadata?: any;
}

/**
 * Atlassian resource information
 */
export interface AtlassianResource {
  id: string; // cloudId
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
}
