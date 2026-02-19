/**
 * Zod schemas for MCP tool parameters (v2.0)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared / legacy schemas (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export const ContextTypeSchema = z.enum([
  'rules',
  'documents',
  'api-contracts',
  'all',
]);

export type ContextType = z.infer<typeof ContextTypeSchema>;

export const InsightSchema = z.object({
  type: z
    .enum(['do', 'dont', 'pattern', 'antipattern'])
    .describe('Type of insight being captured'),
  content: z
    .string()
    .min(1, 'Insight content must not be empty')
    .describe('The insight content'),
  category: z
    .string()
    .optional()
    .describe('Category for this insight'),
});

export type InsightInput = z.infer<typeof InsightSchema>;

// ---------------------------------------------------------------------------
// fetch_context schema
// ---------------------------------------------------------------------------

export const FetchContextParamsSchema = z.object({
  project_id: z
    .string()
    .min(1, 'project_id is required')
    .describe('The project UUID to scope the query'),

  memory_type: z
    .enum(['rule', 'document', 'api_contract', 'learning', 'research_finding'])
    .optional()
    .describe('Filter by memory type'),

  tags: z
    .array(z.string())
    .optional()
    .describe('Filter by tags (all supplied tags must be present)'),

  query: z
    .string()
    .optional()
    .describe('Full-text search applied to title and content'),

  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe('Maximum number of results to return (1-100)'),
});

export type FetchContextParams = z.infer<typeof FetchContextParamsSchema>;

// ---------------------------------------------------------------------------
// update_memory schema
// ---------------------------------------------------------------------------

export const UpdateMemoryParamsSchema = z.object({
  project_id: z
    .string()
    .min(1, 'project_id is required')
    .describe('The project UUID to scope this memory'),

  memory_type: z
    .enum(['rule', 'document', 'api_contract', 'learning', 'research_finding'])
    .describe('Type of memory being stored'),

  title: z
    .string()
    .min(1, 'title is required')
    .describe('Short descriptive title for the memory'),

  content: z
    .record(z.unknown())
    .describe('Structured content payload for this memory'),

  id: z
    .string()
    .optional()
    .describe('Existing memory UUID — if provided, the record is updated rather than created'),

  tags: z
    .array(z.string())
    .optional()
    .describe('Tags for filtering and categorization'),

  category: z
    .string()
    .optional()
    .describe('Category grouping (e.g., "error-handling", "security")'),

  description: z
    .string()
    .optional()
    .describe('Human-readable summary of the memory'),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Confidence score between 0 and 1 (default 1.0)'),

  source_role: z
    .string()
    .optional()
    .describe('Role that produced this memory (e.g., "developer", "researcher")'),
});

export type UpdateMemoryParams = z.infer<typeof UpdateMemoryParamsSchema>;

// ---------------------------------------------------------------------------
// manage_projects schema
// ---------------------------------------------------------------------------

export const ManageProjectsParamsSchema = z.object({
  operation: z
    .enum(['create', 'list', 'switch'])
    .describe('Operation to perform on projects'),

  name: z
    .string()
    .optional()
    .describe('Project name — required for "create"'),

  org: z
    .string()
    .optional()
    .describe('Organisation name — optional for "create"'),

  project_id: z
    .string()
    .optional()
    .describe('Project UUID — required for "switch"'),
});

export type ManageProjectsParams = z.infer<typeof ManageProjectsParamsSchema>;

// ---------------------------------------------------------------------------
// pack_repo schema
// ---------------------------------------------------------------------------

export const PackRepoParamsSchema = z.object({
  url: z
    .string()
    .min(1, 'url is required')
    .describe('Repository URL or local path to pack with RepoMix'),

  project_id: z
    .string()
    .min(1, 'project_id is required')
    .describe('Project UUID to associate the snapshot with'),

  version_label: z
    .string()
    .optional()
    .describe('Optional version label for the snapshot (e.g., "v1.2.3", "2024-01-sprint-3")'),
});

export type PackRepoParams = z.infer<typeof PackRepoParamsSchema>;

// ---------------------------------------------------------------------------
// query_data schema
// ---------------------------------------------------------------------------

export const QueryDataParamsSchema = z.object({
  operation: z
    .enum(['list-tables', 'describe-tables', 'execute-query'])
    .describe('Athena operation to perform'),

  project_id: z
    .string()
    .min(1, 'project_id is required')
    .describe('Project UUID for session scoping'),

  query: z
    .string()
    .optional()
    .describe('SQL SELECT query — required for "execute-query"'),

  table_names: z
    .array(z.string())
    .optional()
    .describe('Table names — required for "describe-tables"'),
});

export type QueryDataParams = z.infer<typeof QueryDataParamsSchema>;
