/**
 * Zod schemas for MCP tool parameters
 */

import { z } from 'zod';

/**
 * Context type for filtering rules
 */
export const ContextTypeSchema = z.enum([
  'rules',
  'documents',
  'api-contracts',
  'all',
]);

export type ContextType = z.infer<typeof ContextTypeSchema>;

/**
 * Schema for fetch_context tool parameters
 */
export const FetchContextParamsSchema = z.object({
  query: z
    .string()
    .min(1, 'Query must not be empty')
    .describe('Search query for retrieving relevant institutional memory'),

  context_type: ContextTypeSchema
    .default('all')
    .describe('Type of context to retrieve (rules, documents, api-contracts, or all)'),

  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (1-100)'),

  category: z
    .string()
    .optional()
    .describe('Filter by specific category (e.g., "code-quality", "mcp-protocol")'),
});

export type FetchContextParams = z.infer<typeof FetchContextParamsSchema>;

/**
 * Schema for a single insight
 */
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
    .describe('Category for this insight (e.g., "error-handling", "performance")'),
});

export type InsightInput = z.infer<typeof InsightSchema>;

/**
 * Schema for update_memory tool parameters
 */
export const UpdateMemoryParamsSchema = z.object({
  insights: z
    .array(InsightSchema)
    .min(1, 'At least one insight is required')
    .describe('Array of insights to save to institutional memory'),

  context: z
    .string()
    .min(1, 'Context must not be empty')
    .describe('Context describing where these insights came from (e.g., task description, code review)'),

  metadata: z
    .object({
      project: z.string().optional(),
      author: z.string().optional(),
      relatedRules: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Additional metadata for the insights'),
});

export type UpdateMemoryParams = z.infer<typeof UpdateMemoryParamsSchema>;
