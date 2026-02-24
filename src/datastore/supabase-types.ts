/**
 * TypeScript types for Supabase database schema (v2.0)
 */

export type MemoryType = 'rule' | 'document' | 'api_contract' | 'learning' | 'research_finding';

/** Row type for the projects table */
export interface ProjectRow {
  id: string;
  name: string;
  org: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Row type for the memories table */
export interface MemoryRow {
  id: string;
  project_id: string;
  memory_type: MemoryType;
  rule_id: string | null;
  title: string;
  category: string | null;
  description: string | null;
  confidence: number;
  usage_count: number;
  content: Record<string, unknown>;
  embedding: number[] | null;
  tags: string[];
  source_role: string | null;
  created_at: string;
  updated_at: string;
}

/** Row type for the repositories table */
export interface RepositoryRow {
  id: string;
  project_id: string;
  url: string;
  snapshot: string | null;
  file_tree: Record<string, unknown>;
  version_label: string | null;
  token_count: number | null;
  created_at: string;
}

/** Row type for the api_keys table */
export interface ApiKeyRow {
  id: string;
  project_id: string;
  key_hash: string;
  label: string | null;
  created_at: string;
}
