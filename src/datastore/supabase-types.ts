/**
 * TypeScript types for Supabase database schema
 */

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
  memory_type: 'rule' | 'document' | 'api_contract';
  rule_id: string | null;
  title: string;
  category: string | null;
  description: string | null;
  confidence: number;
  usage_count: number;
  content: Record<string, unknown>;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

/** Row type for the insights table */
export interface InsightRow {
  id: string;
  project_id: string;
  context: string;
  insights: Record<string, unknown>[];
  source: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  created_at: string;
}
