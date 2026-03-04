/**
 * delete_memory MCP tool implementation (v2.0)
 */

import { z } from 'zod';
import { DeleteMemoryParamsSchema, type DeleteMemoryParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';

export const DeleteMemoryTool = {
  name: 'delete_memory',
  description:
    'Permanently delete a memory from institutional storage. ' +
    'Both "id" and "project_id" must match for the deletion to succeed (RLS scoping). ' +
    'Returns the title of the deleted memory as confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'UUID of the memory to delete',
      },
      project_id: {
        type: 'string',
        description: 'The project UUID — used for RLS scoping to ensure the memory belongs to this project',
      },
    },
    required: ['id', 'project_id'],
  },
} as const;

export async function handleDeleteMemory(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('delete_memory called', params);

    const validated: DeleteMemoryParams = DeleteMemoryParamsSchema.parse(params);

    logger.info('Deleting memory', {
      id: validated.id,
      project_id: validated.project_id,
    });

    const deleted = await dataStore.deleteMemory({
      id: validated.id,
      project_id: validated.project_id,
    });

    logger.info('Memory deleted successfully', { id: deleted.id });

    return {
      content: [
        {
          type: 'text',
          text:
            `# Memory Deleted Successfully\n\n` +
            `**ID:** ${deleted.id}\n` +
            `**Title:** ${deleted.title}\n` +
            `**Project:** ${validated.project_id}`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to delete memory', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for delete_memory: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'delete_memory',
        error
      );
    }

    throw new McpToolError(
      `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'delete_memory',
      error instanceof Error ? error : undefined
    );
  }
}
