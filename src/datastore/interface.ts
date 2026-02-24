/**
 * Data store interface for institutional memory operations (v2.0)
 *
 * Abstraction layer allowing different storage backends
 * (Supabase by default, Confluence legacy).
 */

import type {
  MemoryType,
  ProjectRow,
  MemoryRow,
  RepositoryRow,
} from './supabase-types.js';

export type {
  MemoryType,
  ProjectRow,
  MemoryRow,
  RepositoryRow,
};

export interface IDataStore {
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getStoreId(): Promise<string>;

  // Projects
  createProject(params: {
    name: string;
    org?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProjectRow>;
  listProjects(): Promise<ProjectRow[]>;
  getProject(id: string): Promise<ProjectRow | null>;

  // Memories
  fetchMemories(params: {
    project_id: string;
    memory_type?: MemoryType;
    tags?: string[];
    query?: string;
    limit?: number;
  }): Promise<MemoryRow[]>;
  upsertMemory(params: {
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
  }): Promise<MemoryRow>;

  // Repositories
  saveRepository(params: {
    project_id: string;
    url: string;
    snapshot: string;
    file_tree?: Record<string, unknown>;
    version_label?: string;
    token_count?: number;
  }): Promise<RepositoryRow>;
}
