/**
 * Supabase Data Store implementation (v2.0)
 * Stores institutional memory in Supabase Postgres.
 */

import type { IDataStore, MemoryType, SessionStatus } from './interface.js';
import type {
  ProjectRow,
  MemoryRow,
  RepositoryRow,
  SessionRow,
} from './supabase-types.js';
import { CodifierSupabaseClient } from './supabase-client.js';
import { SupabaseError, DataStoreError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Legacy types retained for backward-compatible wrapper methods
import type {
  FetchRulesParams,
  FetchRulesResult,
  Rule,
  SaveInsightsParams,
  SaveInsightsResult,
} from './types.js';

export interface SupabaseDataStoreConfig {
  url: string;
  serviceRoleKey: string;
  projectId?: string;
}

export class SupabaseDataStore implements IDataStore {
  private supabaseClient: CodifierSupabaseClient;
  private initialized = false;

  constructor(config: SupabaseDataStoreConfig) {
    this.supabaseClient = new CodifierSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
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

      this.initialized = true;
      logger.info('SupabaseDataStore initialized successfully');
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

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  async createProject(params: {
    name: string;
    org?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProjectRow> {
    await this.ensureInitialized();

    try {
      logger.info('Creating project', { name: params.name, org: params.org });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('projects')
        .insert({
          name: params.name,
          org: params.org ?? null,
          metadata: params.metadata ?? {},
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new SupabaseError(
          `Failed to create project: ${error?.message ?? 'No data returned'}`
        );
      }

      logger.info('Project created', { projectId: data.id });
      return data as ProjectRow;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to create project: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  async listProjects(): Promise<ProjectRow[]> {
    await this.ensureInitialized();

    try {
      logger.info('Listing projects');

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new SupabaseError(`Failed to list projects: ${error.message}`);
      }

      return (data ?? []) as ProjectRow[];
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to list projects: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  async getProject(id: string): Promise<ProjectRow | null> {
    await this.ensureInitialized();

    try {
      logger.debug('Getting project', { id });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw new SupabaseError(`Failed to get project: ${error.message}`);
      }

      return data as ProjectRow | null;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to get project: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Memories
  // ---------------------------------------------------------------------------

  async fetchMemories(params: {
    project_id: string;
    memory_type?: MemoryType;
    tags?: string[];
    query?: string;
    limit?: number;
  }): Promise<MemoryRow[]> {
    await this.ensureInitialized();

    try {
      logger.info('Fetching memories', {
        project_id: params.project_id,
        memory_type: params.memory_type,
        tags: params.tags,
        query: params.query,
        limit: params.limit,
      });

      const client = this.supabaseClient.getClient();
      let query = client
        .from('memories')
        .select('*')
        .eq('project_id', params.project_id);

      if (params.memory_type) {
        query = query.eq('memory_type', params.memory_type);
      }

      if (params.tags && params.tags.length > 0) {
        // @> checks that the row's tags array contains all supplied tags
        query = query.contains('tags', params.tags);
      }

      if (params.query) {
        const escaped = params.query.replace(/[%_]/g, '\\$&');
        query = query.or(
          `title.ilike.%${escaped}%,content::text.ilike.%${escaped}%`
        );
      }

      if (params.limit && params.limit > 0) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new SupabaseError(`Failed to fetch memories: ${error.message}`);
      }

      logger.info(`Fetched ${(data ?? []).length} memories`);
      return (data ?? []) as MemoryRow[];
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to fetch memories: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  async upsertMemory(params: {
    project_id: string;
    memory_type: MemoryType;
    title: string;
    content: Record<string, unknown>;
    id?: string;
    tags?: string[];
    category?: string;
    description?: string;
    confidence?: number;
    source_role?: string;
  }): Promise<MemoryRow> {
    await this.ensureInitialized();

    try {
      logger.info('Upserting memory', {
        project_id: params.project_id,
        memory_type: params.memory_type,
        title: params.title,
        id: params.id,
      });

      const client = this.supabaseClient.getClient();

      if (params.id) {
        // Update existing record
        const { data, error } = await client
          .from('memories')
          .update({
            memory_type: params.memory_type,
            title: params.title,
            content: params.content,
            tags: params.tags ?? [],
            category: params.category ?? null,
            description: params.description ?? null,
            confidence: params.confidence ?? 1.0,
            source_role: params.source_role ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .eq('project_id', params.project_id)
          .select('*')
          .single();

        if (error || !data) {
          throw new SupabaseError(
            `Failed to update memory: ${error?.message ?? 'No data returned'}`
          );
        }

        logger.info('Memory updated', { id: data.id });
        return data as MemoryRow;
      }

      // Insert new record
      const { data, error } = await client
        .from('memories')
        .insert({
          project_id: params.project_id,
          memory_type: params.memory_type,
          title: params.title,
          content: params.content,
          tags: params.tags ?? [],
          category: params.category ?? null,
          description: params.description ?? null,
          confidence: params.confidence ?? 1.0,
          source_role: params.source_role ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new SupabaseError(
          `Failed to insert memory: ${error?.message ?? 'No data returned'}`
        );
      }

      logger.info('Memory inserted', { id: data.id });
      return data as MemoryRow;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to upsert memory: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Repositories
  // ---------------------------------------------------------------------------

  async saveRepository(params: {
    project_id: string;
    url: string;
    snapshot: string;
    file_tree?: Record<string, unknown>;
    version_label?: string;
    token_count?: number;
  }): Promise<RepositoryRow> {
    await this.ensureInitialized();

    try {
      logger.info('Saving repository snapshot', {
        project_id: params.project_id,
        url: params.url,
        version_label: params.version_label,
      });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('repositories')
        .insert({
          project_id: params.project_id,
          url: params.url,
          snapshot: params.snapshot,
          file_tree: params.file_tree ?? {},
          version_label: params.version_label ?? null,
          token_count: params.token_count ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new SupabaseError(
          `Failed to save repository: ${error?.message ?? 'No data returned'}`
        );
      }

      logger.info('Repository snapshot saved', { id: data.id });
      return data as RepositoryRow;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to save repository: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async createSession(params: {
    project_id: string;
    playbook_id: string;
  }): Promise<SessionRow> {
    await this.ensureInitialized();

    try {
      logger.info('Creating session', {
        project_id: params.project_id,
        playbook_id: params.playbook_id,
      });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('sessions')
        .insert({
          project_id: params.project_id,
          playbook_id: params.playbook_id,
          current_step: 0,
          collected_data: {},
          status: 'active',
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new SupabaseError(
          `Failed to create session: ${error?.message ?? 'No data returned'}`
        );
      }

      logger.info('Session created', { id: data.id });
      return data as SessionRow;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to create session: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  async getSession(id: string): Promise<SessionRow | null> {
    await this.ensureInitialized();

    try {
      logger.debug('Getting session', { id });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new SupabaseError(`Failed to get session: ${error.message}`);
      }

      return data as SessionRow | null;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to get session: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  async updateSession(
    id: string,
    updates: {
      current_step?: number;
      collected_data?: Record<string, unknown>;
      status?: SessionStatus;
    }
  ): Promise<SessionRow> {
    await this.ensureInitialized();

    try {
      logger.info('Updating session', { id, updates });

      const client = this.supabaseClient.getClient();
      const { data, error } = await client
        .from('sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) {
        throw new SupabaseError(
          `Failed to update session: ${error?.message ?? 'No data returned'}`
        );
      }

      logger.info('Session updated', { id: data.id, status: data.status });
      return data as SessionRow;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SupabaseError(`Failed to update session: ${message}`, error instanceof Error ? error : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Backward-compatible wrappers (used by context-service.ts / memory-service.ts)
  // NOT on the IDataStore interface.
  // ---------------------------------------------------------------------------

  async fetchRules(params: FetchRulesParams): Promise<FetchRulesResult> {
    // Derive a project_id from the first available project when not scoped
    const projects = await this.listProjects();
    const project_id = projects[0]?.id ?? '';

    const rows = await this.fetchMemories({
      project_id,
      memory_type: 'rule',
      query: params.query,
      limit: params.limit,
    });

    let rules = rows.map(mapMemoryRowToRule);

    if (params.category) {
      const cat = params.category.toLowerCase();
      rules = rules.filter((r) => r.category.toLowerCase().includes(cat));
    }

    return {
      rules,
      totalCount: rules.length,
      source: `Supabase: project ${project_id}`,
    };
  }

  async saveInsights(params: SaveInsightsParams): Promise<SaveInsightsResult> {
    const projects = await this.listProjects();
    const project_id = projects[0]?.id ?? '';

    const row = await this.upsertMemory({
      project_id,
      memory_type: 'learning',
      title: `Insight — ${new Date().toISOString().slice(0, 16)}`,
      content: {
        context: params.context,
        insights: params.insights,
        metadata: params.metadata ?? {},
      },
      tags: (params.metadata?.relatedRules as string[]) ?? [],
      source_role: (params.metadata?.author as string) ?? undefined,
    });

    return {
      success: true,
      recordId: row.id,
      recordTitle: row.title,
      insightCount: params.insights.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/** Map a memories row to the legacy Rule domain type */
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
      tags: row.tags ?? [],
      ...(content.metadata as Record<string, unknown> ?? {}),
    },
  };
}
