/**
 * fetch_context MCP tool implementation
 */

import { z } from 'zod';
import { FetchContextParamsSchema, type FetchContextParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import { ContextService } from '../../services/context-service.js';

/**
 * Tool definition for fetch_context
 */
export const FetchContextTool = {
  name: 'fetch_context',
  description:
    'Retrieve relevant institutional memory based on a query. ' +
    'Returns rules, documents, or API contracts that match the search criteria. ' +
    'Use this to access project conventions, architectural decisions, and best practices.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for retrieving relevant institutional memory',
      },
      context_type: {
        type: 'string',
        enum: ['rules', 'documents', 'api-contracts', 'all'],
        default: 'all',
        description: 'Type of context to retrieve',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (1-100)',
        default: 10,
        minimum: 1,
        maximum: 100,
      },
      category: {
        type: 'string',
        description: 'Filter by specific category (e.g., "code-quality", "mcp-protocol")',
      },
    },
    required: ['query'],
  },
} as const;

/**
 * Handler for fetch_context tool
 *
 * Uses ContextService for advanced filtering, relevance scoring, and ranking.
 *
 * @param params - Validated tool parameters
 * @param contextService - Context service instance for retrieving rules
 * @returns Tool response with fetched context
 * @throws {McpToolError} If context fetching fails
 */
export async function handleFetchContext(
  params: unknown,
  contextService: ContextService
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('fetch_context called', params);

    // Validate parameters
    const validatedParams: FetchContextParams = FetchContextParamsSchema.parse(params);

    logger.info('Fetching context', {
      query: validatedParams.query,
      type: validatedParams.context_type,
      limit: validatedParams.limit,
      category: validatedParams.category,
    });

    // Use ContextService for advanced filtering and relevance scoring
    const result = await contextService.fetchContext({
      query: validatedParams.query,
      contextType: validatedParams.context_type,
      category: validatedParams.category,
      limit: validatedParams.limit,
    });

    logger.info('Context fetched successfully', {
      ruleCount: result.rules.length,
      totalFound: result.metadata.totalFound,
      filtered: result.metadata.filtered,
    });

    // Format response for MCP client
    const formattedRules = result.rules
      .map(
        (rule) =>
          `## ${rule.title} (${rule.id})\n\n` +
          `**Category:** ${rule.category}\n` +
          `**Description:** ${rule.description}\n\n` +
          (rule.patterns && rule.patterns.length > 0
            ? `**Patterns (DO):**\n${rule.patterns.map((p) => `- ${p}`).join('\n')}\n\n`
            : '') +
          (rule.antipatterns && rule.antipatterns.length > 0
            ? `**Antipatterns (DON'T):**\n${rule.antipatterns.map((a) => `- ${a}`).join('\n')}\n\n`
            : '') +
          (rule.examples && rule.examples.length > 0
            ? `**Examples:**\n${rule.examples.map((e) => `- ${e}`).join('\n')}\n\n`
            : '')
      )
      .join('\n---\n\n');

    // Build metadata summary
    const metadataSummary = [
      `**Query:** ${validatedParams.query}`,
      `**Context Type:** ${validatedParams.context_type}`,
      validatedParams.category ? `**Category Filter:** ${validatedParams.category}` : null,
      `**Results:** ${result.rules.length} of ${result.metadata.filtered} (total found: ${result.metadata.totalFound})`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = {
      content: [
        {
          type: 'text',
          text:
            `# Institutional Memory Context\n\n` +
            `${metadataSummary}\n\n` +
            `---\n\n` +
            (formattedRules || 'No matching rules found.'),
        },
      ],
    };

    return response;
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
