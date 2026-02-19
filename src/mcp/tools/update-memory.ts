/**
 * update_memory MCP tool implementation (v2.0)
 */

import { z } from 'zod';
import { UpdateMemoryParamsSchema, type UpdateMemoryParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import type { MemoryType } from '../../datastore/supabase-types.js';

export const UpdateMemoryTool = {
  name: 'update_memory',
  description:
    'Create or update a memory in institutional storage. ' +
    'Supports rules, documents, API contracts, learnings, and research findings. ' +
    'Provide an existing "id" to update; omit it to create a new record.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'The project UUID to scope this memory',
      },
      memory_type: {
        type: 'string',
        enum: ['rule', 'document', 'api_contract', 'learning', 'research_finding'],
        description: 'Type of memory being stored',
      },
      title: {
        type: 'string',
        description: 'Short descriptive title for the memory',
      },
      content: {
        type: 'object',
        description: 'Structured content payload for this memory',
      },
      id: {
        type: 'string',
        description: 'Existing memory UUID — if provided, the record is updated',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for filtering and categorization',
      },
      category: {
        type: 'string',
        description: 'Category grouping (e.g., "error-handling", "security")',
      },
      description: {
        type: 'string',
        description: 'Human-readable summary of the memory',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score between 0 and 1 (default 1.0)',
        minimum: 0,
        maximum: 1,
      },
      source_role: {
        type: 'string',
        description: 'Role that produced this memory (e.g., "developer", "researcher")',
      },
    },
    required: ['project_id', 'memory_type', 'title', 'content'],
  },
} as const;

export async function handleUpdateMemory(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('update_memory called', params);

    const validated: UpdateMemoryParams = UpdateMemoryParamsSchema.parse(params);

    logger.info('Updating memory', {
      project_id: validated.project_id,
      memory_type: validated.memory_type,
      title: validated.title,
      id: validated.id,
    });

    const row = await dataStore.upsertMemory({
      project_id: validated.project_id,
      memory_type: validated.memory_type as MemoryType,
      title: validated.title,
      content: validated.content,
      id: validated.id,
      tags: validated.tags,
      category: validated.category,
      description: validated.description,
      confidence: validated.confidence,
      source_role: validated.source_role,
    });

    const operation = validated.id ? 'updated' : 'created';

    logger.info(`Memory ${operation} successfully`, { id: row.id });

    return {
      content: [
        {
          type: 'text',
          text:
            `# Memory ${operation.charAt(0).toUpperCase() + operation.slice(1)} Successfully\n\n` +
            `**ID:** ${row.id}\n` +
            `**Type:** ${row.memory_type}\n` +
            `**Title:** ${row.title}\n` +
            `**Project:** ${row.project_id}\n` +
            (row.category ? `**Category:** ${row.category}\n` : '') +
            (row.tags.length > 0 ? `**Tags:** ${row.tags.join(', ')}\n` : '') +
            `**Confidence:** ${row.confidence}\n` +
            `**Created:** ${row.created_at}\n` +
            `**Updated:** ${row.updated_at}`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to update memory', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for update_memory: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'update_memory',
        error
      );
    }

    throw new McpToolError(
      `Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'update_memory',
      error instanceof Error ? error : undefined
    );
  }
}
