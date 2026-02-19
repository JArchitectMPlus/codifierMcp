/**
 * fetch_context MCP tool implementation (v2.0)
 */

import { z } from 'zod';
import { FetchContextParamsSchema, type FetchContextParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import type { MemoryRow } from '../../datastore/supabase-types.js';

export const FetchContextTool = {
  name: 'fetch_context',
  description:
    'Retrieve institutional memory scoped to a project. ' +
    'Supports filtering by memory_type, tags, and free-text query. ' +
    'Use this to access rules, API contracts, documents, learnings, and research findings.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'The project UUID to scope the query',
      },
      memory_type: {
        type: 'string',
        enum: ['rule', 'document', 'api_contract', 'learning', 'research_finding'],
        description: 'Filter by memory type',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (all supplied tags must be present)',
      },
      query: {
        type: 'string',
        description: 'Full-text search applied to title and content',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (1-100)',
        default: 20,
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['project_id'],
  },
} as const;

export async function handleFetchContext(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('fetch_context called', params);

    const validated: FetchContextParams = FetchContextParamsSchema.parse(params);

    logger.info('Fetching context', {
      project_id: validated.project_id,
      memory_type: validated.memory_type,
      tags: validated.tags,
      query: validated.query,
      limit: validated.limit,
    });

    const memories = await dataStore.fetchMemories({
      project_id: validated.project_id,
      memory_type: validated.memory_type,
      tags: validated.tags,
      query: validated.query,
      limit: validated.limit,
    });

    logger.info('Context fetched successfully', { count: memories.length });

    const formatted = memories.map(formatMemory).join('\n---\n\n');

    const summary = [
      `**Project:** ${validated.project_id}`,
      validated.memory_type ? `**Type:** ${validated.memory_type}` : null,
      validated.query ? `**Query:** ${validated.query}` : null,
      validated.tags?.length ? `**Tags:** ${validated.tags.join(', ')}` : null,
      `**Results:** ${memories.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text:
            `# Institutional Memory Context\n\n${summary}\n\n---\n\n` +
            (formatted || 'No matching memories found.'),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to fetch context', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for fetch_context: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'fetch_context',
        error
      );
    }

    throw new McpToolError(
      `Failed to fetch context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'fetch_context',
      error instanceof Error ? error : undefined
    );
  }
}

function formatMemory(row: MemoryRow): string {
  const lines: string[] = [
    `## ${row.title}`,
    `**ID:** ${row.id}`,
    `**Type:** ${row.memory_type}`,
  ];

  if (row.category) lines.push(`**Category:** ${row.category}`);
  if (row.description) lines.push(`**Description:** ${row.description}`);
  if (row.tags.length > 0) lines.push(`**Tags:** ${row.tags.join(', ')}`);
  if (row.source_role) lines.push(`**Source Role:** ${row.source_role}`);
  if (row.confidence !== undefined) lines.push(`**Confidence:** ${row.confidence}`);

  lines.push('');
  lines.push('**Content:**');
  lines.push('```json');
  lines.push(JSON.stringify(row.content, null, 2));
  lines.push('```');

  return lines.join('\n');
}
