/**
 * Data store factory
 *
 * Creates the appropriate IDataStore implementation based on configuration.
 */

import type { EnvConfig } from '../config/env.js';
import type { IDataStore } from './interface.js';
import { AtlassianDataStore } from './atlassian-datastore.js';
import { SupabaseDataStore } from './supabase-datastore.js';
import { ConfigurationError } from '../utils/errors.js';

/**
 * Create a data store instance based on the environment configuration
 *
 * @param config - Validated environment configuration
 * @returns An IDataStore implementation matching the configured backend
 * @throws {ConfigurationError} If the DATA_STORE value is unsupported
 */
export function createDataStore(config: EnvConfig): IDataStore {
  switch (config.DATA_STORE) {
    case 'confluence':
      return new AtlassianDataStore({
        baseUrl: config.CONFLUENCE_BASE_URL!,
        username: config.CONFLUENCE_USERNAME!,
        apiToken: config.CONFLUENCE_API_TOKEN!,
        spaceKey: config.CONFLUENCE_SPACE_KEY!,
        rulesPageTitle: config.RULES_PAGE_TITLE,
        insightsParentPageTitle: config.INSIGHTS_PARENT_PAGE_TITLE,
      });

    case 'supabase':
      return new SupabaseDataStore({
        url: config.SUPABASE_URL!,
        serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY!,
        projectId: config.SUPABASE_PROJECT_ID,
      });

    default:
      throw new ConfigurationError(
        `Unsupported DATA_STORE value: ${config.DATA_STORE}`
      );
  }
}
