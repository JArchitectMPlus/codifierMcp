/**
 * update_memory MCP tool implementation
 */

import { z } from 'zod';
import { UpdateMemoryParamsSchema, type UpdateMemoryParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import type { Insight } from '../../datastore/types.js';

/**
 * Tool definition for update_memory
 */
export const UpdateMemoryTool = {
  name: 'update_memory',
  description:
    'Save new learnings and insights to institutional memory. ' +
    'Use this to capture patterns, antipatterns, best practices, and architectural decisions ' +
    'discovered during development. Creates a timestamped insight page in Confluence.',
  inputSchema: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        description: 'Array of insights to save',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['do', 'dont', 'pattern', 'antipattern'],
              description: 'Type of insight',
            },
            content: {
              type: 'string',
              description: 'The insight content',
            },
            category: {
              type: 'string',
              description: 'Category for this insight',
            },
          },
          required: ['type', 'content'],
        },
      },
      context: {
        type: 'string',
        description: 'Context describing where these insights came from',
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata',
        properties: {
          project: { type: 'string' },
          author: { type: 'string' },
          relatedRules: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    required: ['insights', 'context'],
  },
} as const;

/**
 * Handler for update_memory tool
 *
 * Note: This is a Phase 3 skeleton implementation. Full memory service
 * with rule extraction and graph updates will be implemented in Phase 4.
 *
 * @param params - Validated tool parameters
 * @param dataStore - Data store instance for saving insights
 * @returns Tool response with save result
 * @throws {McpToolError} If memory update fails
 */
export async function handleUpdateMemory(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('update_memory called', params);

    // Validate parameters
    const validatedParams: UpdateMemoryParams = UpdateMemoryParamsSchema.parse(params);

    logger.info('Updating institutional memory', {
      insightCount: validatedParams.insights.length,
      context: validatedParams.context,
      metadata: validatedParams.metadata,
    });

    // Convert schema insights to datastore Insight type
    const insights: Insight[] = validatedParams.insights.map((insight) => ({
      type: insight.type,
      content: insight.content,
      category: insight.category,
    }));

    // Save insights using dataStore
    const result = await dataStore.saveInsights({
      insights,
      context: validatedParams.context,
      metadata: {
        ...validatedParams.metadata,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info('Memory updated successfully', {
      pageId: result.pageId,
      pageTitle: result.pageTitle,
      insightCount: result.insightCount,
    });

    // Format response for MCP client
    const insightSummary = validatedParams.insights
      .map(
        (insight, index) =>
          `${index + 1}. **[${insight.type.toUpperCase()}]** ${insight.category ? `(${insight.category})` : ''}: ${insight.content}`
      )
      .join('\n');

    const response = {
      content: [
        {
          type: 'text',
          text:
            `# Memory Updated Successfully\n\n` +
            `**Context:** ${validatedParams.context}\n` +
            `**Insights Saved:** ${result.insightCount}\n` +
            `**Page:** [${result.pageTitle}](${result.pageUrl})\n\n` +
            `## Captured Insights:\n\n` +
            insightSummary +
            `\n\n---\n\n` +
            `These insights have been saved to institutional memory and will be available for future context retrieval.`,
        },
      ],
    };

    return response;
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
