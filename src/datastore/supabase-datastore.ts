/**
 * Supabase Data Store implementation
 * Stores institutional memory in Supabase Postgres
 */

import { IDataStore } from './interface.js';
import {
  FetchRulesParams,
  FetchRulesResult,
  Rule,
  SaveInsightsParams,
  SaveInsightsResult,
} from './types.js';
import { CodifierSupabaseClient } from './supabase-client.js';
import type { MemoryRow } from './supabase-types.js';
import { SupabaseError, DataStoreError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for SupabaseDataStore
 */
export interface SupabaseDataStoreConfig {
  url: string;
  serviceRoleKey: string;
  projectId?: string;
  autoCreateProject?: boolean;
  projectName?: string;
}

/**
 * IDataStore implementation backed by Supabase
 */
export class SupabaseDataStore implements IDataStore {
  private supabaseClient: CodifierSupabaseClient;
  private initialized = false;
  private projectId: string | undefined;
  private readonly autoCreateProject: boolean;
  private readonly projectName: string;

  constructor(config: SupabaseDataStoreConfig) {
    this.supabaseClient = new CodifierSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    this.projectId = config.projectId;
    this.autoCreateProject = config.autoCreateProject ?? true;
    this.projectName = config.projectName ?? 'default';
  }

  async getStoreId(): Promise<string> {
    return this.supabaseClient.getProjectRef();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('SupabaseDataStore already initialized');
      return;
    }

    try {
      logger.info('Initializing SupabaseDataStore');

      const isHealthy = await this.supabaseClient.healthCheck();
      if (!isHealthy) {
        throw new DataStoreError('Supabase health check failed — unable to connect');
      }

      // Resolve or create project
      if (this.projectId) {
        const client = this.supabaseClient.getClient();
        const { data, error } = await client
          .from('projects')
          .select('id')
          .eq('id', this.projectId)
          .single();
        if (error || !data) {
          throw new SupabaseError(`Project not found: ${this.projectId}`);
        }
      } else if (this.autoCreateProject) {
        this.projectId = await this.ensureProjectExists();
      } else {
        throw new DataStoreError('No project ID provided and autoCreateProject is disabled');
      }

      this.initialized = true;
      logger.info('SupabaseDataStore initialized successfully', {
        projectId: this.projectId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize SupabaseDataStore', message);
      throw new DataStoreError(
        `Failed to initialize data store: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.supabaseClient.healthCheck();
  }

  async fetchRules(params: FetchRulesParams): Promise<FetchRulesResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Fetching rules from Supabase', params);

      const client = this.supabaseClient.getClient();
      let query = client
        .from('memories')
        .select('*')
        .eq('project_id', this.projectId!)
        .eq('memory_type', 'rule');

      if (params.category) {
        query = query.ilike('category', params.category);
      }

      if (params.query) {
        query = query.or(
          `title.ilike.%${params.query}%,description.ilike.%${params.query}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new SupabaseError(`Failed to fetch rules: ${error.message}`);
      }

      const rows = (data ?? []) as MemoryRow[];
      let rules = rows.map(mapMemoryRowToRule);

      const totalCount = rules.length;

      if (params.limit && params.limit > 0) {
        rules = rules.slice(0, params.limit);
      }

      logger.info(`Fetched ${rules.length} rules (total: ${totalCount})`, params);

      return {
        rules,
        totalCount,
        source: `Supabase: project ${this.projectId}`,
      };
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch rules', message);
      throw new SupabaseError(
        `Failed to fetch rules: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async saveInsights(params: SaveInsightsParams): Promise<SaveInsightsResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Saving insights to Supabase', {
        insightCount: params.insights.length,
        context: params.context,
      });

      const client = this.supabaseClient.getClient();
      const title = `Insight — ${new Date().toISOString().slice(0, 16)}`;

      const { data, error } = await client
        .from('insights')
        .insert({
          project_id: this.projectId!,
          context: params.context,
          insights: params.insights,
          source: params.metadata?.author ?? null,
          tags: params.metadata?.relatedRules ?? [],
          metadata: params.metadata ?? {},
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new SupabaseError(`Failed to save insights: ${error?.message ?? 'No data returned'}`);
      }

      logger.info('Successfully saved insights to Supabase', {
        recordId: data.id,
        title,
      });

      return {
        success: true,
        recordId: data.id,
        recordTitle: title,
        insightCount: params.insights.length,
      };
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save insights', message);
      throw new SupabaseError(
        `Failed to save insights: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /** Ensure a default project exists, creating one if needed */
  private async ensureProjectExists(): Promise<string> {
    const client = this.supabaseClient.getClient();

    // Check for existing project by name
    const { data: existing } = await client
      .from('projects')
      .select('id')
      .eq('name', this.projectName)
      .limit(1)
      .single();

    if (existing) {
      logger.debug('Found existing project', { projectId: existing.id });
      return existing.id;
    }

    // Create new project
    const { data: created, error } = await client
      .from('projects')
      .insert({ name: this.projectName })
      .select('id')
      .single();

    if (error || !created) {
      throw new SupabaseError(
        `Failed to create project: ${error?.message ?? 'No data returned'}`
      );
    }

    logger.info('Created new project', { projectId: created.id, name: this.projectName });
    return created.id;
  }
}

/** Map a Supabase memories row to the Rule domain type */
function mapMemoryRowToRule(row: MemoryRow): Rule {
  const content = row.content as Record<string, unknown>;
  return {
    id: row.rule_id ?? row.id,
    category: row.category ?? 'uncategorized',
    title: row.title,
    description: row.description ?? '',
    confidence: row.confidence,
    patterns: (content.patterns as string[]) ?? [],
    antipatterns: (content.antipatterns as string[]) ?? [],
    examples: (content.examples as string[]) ?? [],
    metadata: {
      created: row.created_at,
      updated: row.updated_at,
      usageCount: row.usage_count,
      tags: (content.tags as string[]) ?? [],
      ...(content.metadata as Record<string, unknown> ?? {}),
    },
  };
}
