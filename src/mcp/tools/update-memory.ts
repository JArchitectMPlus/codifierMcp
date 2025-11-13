/**
 * update_memory MCP tool implementation
 */

import { z } from 'zod';
import { UpdateMemoryParamsSchema, type UpdateMemoryParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import { MemoryService } from '../../services/memory-service.js';
import type { SaveInsightItem } from '../../services/memory-service.js';

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
 * Uses MemoryService for enhanced insight formatting and metadata enrichment.
 *
 * @param params - Validated tool parameters
 * @param memoryService - Memory service instance for saving insights
 * @returns Tool response with save result
 * @throws {McpToolError} If memory update fails
 */
export async function handleUpdateMemory(
  params: unknown,
  memoryService: MemoryService
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

    // Convert to MemoryService format
    const insightItems: SaveInsightItem[] = validatedParams.insights.map((insight) => ({
      title: insight.content.split('.')[0], // Use first sentence as title
      content: insight.content,
      category: insight.category,
      type: insight.type,
      tags: [], // Could be extracted from metadata in future
    }));

    // Use MemoryService for enhanced formatting
    const result = await memoryService.saveInsights({
      insights: insightItems,
      context: {
        source: validatedParams.context,
        relatedRules: validatedParams.metadata?.relatedRules,
      },
      metadata: validatedParams.metadata,
    });

    logger.info('Memory updated successfully', {
      pageId: result.savedPages[0]?.pageId,
      totalSaved: result.metadata.totalSaved,
      timestamp: result.metadata.timestamp,
    });

    // Format response for MCP client
    const insightSummary = validatedParams.insights
      .map(
        (insight, index) =>
          `${index + 1}. **[${insight.type.toUpperCase()}]** ${insight.category ? `(${insight.category})` : ''}: ${insight.content}`
      )
      .join('\n');

    const savedPage = result.savedPages[0];

    const response = {
      content: [
        {
          type: 'text',
          text:
            `# Memory Updated Successfully\n\n` +
            `**Context:** ${validatedParams.context}\n` +
            `**Insights Saved:** ${result.metadata.totalSaved}\n` +
            `**Timestamp:** ${result.metadata.timestamp}\n` +
            (savedPage
              ? `**Page:** [${savedPage.title}](${savedPage.url})\n\n`
              : '\n') +
            `## Captured Insights:\n\n` +
            insightSummary +
            `\n\n---\n\n` +
            `These insights have been saved to institutional memory with enhanced metadata and will be available for future context retrieval.`,
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
