/**
 * pack_repo MCP tool implementation
 */

import { z } from 'zod';
import { PackRepoParamsSchema, type PackRepoParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import { packRepository } from '../../integrations/repomix.js';

export const PackRepoTool = {
  name: 'pack_repo',
  description:
    'Condense a repository into a versioned text snapshot using RepoMix. ' +
    'Accepts a remote URL (GitHub, etc.) or local path. ' +
    'The snapshot is stored in the repositories table and is available for future context retrieval.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Repository URL (https://github.com/org/repo) or local path',
      },
      project_id: {
        type: 'string',
        description: 'Project UUID to associate the snapshot with',
      },
      version_label: {
        type: 'string',
        description: 'Optional version label for this snapshot (e.g., "v1.2.3", "sprint-5")',
      },
    },
    required: ['url', 'project_id'],
  },
} as const;

export async function handlePackRepo(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('pack_repo called', params);

    const validated: PackRepoParams = PackRepoParamsSchema.parse(params);

    logger.info('Packing repository', {
      url: validated.url,
      project_id: validated.project_id,
      version_label: validated.version_label,
    });

    const packResult = await packRepository(validated.url);

    const repositoryRow = await dataStore.saveRepository({
      project_id: validated.project_id,
      url: validated.url,
      snapshot: packResult.snapshot,
      file_tree: {},
      version_label: validated.version_label,
      token_count: packResult.tokenCount,
    });

    logger.info('Repository snapshot saved', {
      repository_id: repositoryRow.id,
      token_count: packResult.tokenCount,
      file_count: packResult.fileCount,
    });

    return {
      content: [
        {
          type: 'text',
          text:
            `# Repository Packed Successfully\n\n` +
            `**Repository ID:** ${repositoryRow.id}\n` +
            `**URL:** ${validated.url}\n` +
            (repositoryRow.version_label ? `**Version:** ${repositoryRow.version_label}\n` : '') +
            `**Files Packed:** ${packResult.fileCount}\n` +
            `**Token Count:** ${packResult.tokenCount.toLocaleString()}\n` +
            `**Snapshot Size:** ${packResult.snapshot.length.toLocaleString()} characters\n` +
            `**Saved At:** ${repositoryRow.created_at}\n\n` +
            `The repository snapshot is stored and available for future context retrieval.`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to pack repo', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for pack_repo: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'pack_repo',
        error
      );
    }

    throw new McpToolError(
      `Failed to pack repo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'pack_repo',
      error instanceof Error ? error : undefined
    );
  }
}
