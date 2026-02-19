/**
 * advance_step MCP tool implementation
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import { PlaybookRunner } from '../../playbooks/PlaybookRunner.js';
import { getGenerator } from '../../playbooks/generators/index.js';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const AdvanceStepParamsSchema = z.object({
  session_id: z
    .string()
    .min(1, 'session_id must not be empty')
    .describe('The session ID returned by run_playbook'),
  input: z
    .record(z.unknown())
    .describe('Key-value pairs collected for this step (e.g. { "project_name": "MyApp" })'),
});

type AdvanceStepParams = z.infer<typeof AdvanceStepParamsSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const AdvanceStepTool = {
  name: 'advance_step',
  description:
    'Submit your response to the current playbook step and advance to the next one. ' +
    'Pass the session_id from run_playbook and an input object with the requested fields. ' +
    'When a generate step is reached, the response includes a generate_request with the ' +
    'prompt to send to your LLM.',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'The session ID returned by run_playbook.',
      },
      input: {
        type: 'object',
        description:
          'Key-value pairs for this step. Keys should match the "collect" fields ' +
          'listed in the step prompt.',
        additionalProperties: true,
      },
    },
    required: ['session_id', 'input'],
  },
} as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleAdvanceStep(
  params: unknown,
  runner: PlaybookRunner
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('advance_step called', params);

    const validated: AdvanceStepParams = AdvanceStepParamsSchema.parse(params);

    logger.info('Advancing playbook step', { sessionId: validated.session_id });

    const result = await runner.advanceStep({
      session_id: validated.session_id,
      input: validated.input,
    });

    // -----------------------------------------------------------------------
    // Session completed
    // -----------------------------------------------------------------------
    if (result.completed) {
      return {
        content: [
          {
            type: 'text',
            text:
              `# Playbook Completed\n\n` +
              `All steps have been completed for session \`${validated.session_id}\`.\n\n` +
              `The collected data has been saved to institutional memory and is now available ` +
              `via \`fetch_context\`.`,
          },
        ],
      };
    }

    // -----------------------------------------------------------------------
    // Generate step — return the assembled prompt for the client's LLM
    // -----------------------------------------------------------------------
    if (result.generate_request && result.step) {
      const { generator, context } = result.generate_request;
      const generatorFn = getGenerator(generator);

      let promptText: string;
      if (generatorFn) {
        promptText = generatorFn(context);
      } else {
        logger.warn('Unknown generator requested', { generator });
        promptText = `Generator "${generator}" not found. Context collected:\n\n${JSON.stringify(context, null, 2)}`;
      }

      return {
        content: [
          {
            type: 'text',
            text:
              `# Step: ${result.step.title}\n\n` +
              `**Session:** \`${validated.session_id}\`\n` +
              `**Action:** generate (using \`${generator}\`)\n\n` +
              `---\n\n` +
              `## Prompt for your LLM\n\n` +
              `${promptText}\n\n` +
              `---\n\n` +
              `After your LLM has responded, call \`advance_step\` again with:\n` +
              `- \`session_id\`: "${validated.session_id}"\n` +
              `- \`input\`: \`{ "${generator}_output": "<paste LLM response here>" }\``,
          },
        ],
      };
    }

    // -----------------------------------------------------------------------
    // Regular next step
    // -----------------------------------------------------------------------
    if (!result.step) {
      // Should not happen, but guard defensively
      throw new McpToolError(
        'advance_step returned neither a next step nor a completion signal',
        'advance_step'
      );
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `# Next Step: ${result.step.title}\n\n` +
            `**Session:** \`${validated.session_id}\`\n` +
            `**Action:** ${result.step.action}\n\n` +
            `---\n\n` +
            `${result.prompt ?? result.step.prompt}\n\n` +
            `---\n\n` +
            `When you have your answer, call \`advance_step\` again with:\n` +
            `- \`session_id\`: "${validated.session_id}"\n` +
            `- \`input\`: an object containing the fields requested above`,
        },
      ],
    };
  } catch (error) {
    logger.error('advance_step failed', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for advance_step: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'advance_step',
        error
      );
    }

    throw new McpToolError(
      `Failed to advance step: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'advance_step',
      error instanceof Error ? error : undefined
    );
  }
}
