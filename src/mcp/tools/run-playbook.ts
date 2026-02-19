/**
 * run_playbook MCP tool implementation
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import { PlaybookRunner } from '../../playbooks/PlaybookRunner.js';
import { listPlaybooks } from '../../playbooks/loader.js';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const RunPlaybookParamsSchema = z.object({
  playbook_id: z
    .string()
    .min(1, 'playbook_id must not be empty')
    .describe('ID of the playbook to start (e.g. "initialize-project")'),
  project_id: z
    .string()
    .min(1, 'project_id must not be empty')
    .describe('UUID of the project this session belongs to'),
});

type RunPlaybookParams = z.infer<typeof RunPlaybookParamsSchema>;

// ---------------------------------------------------------------------------
// Tool definition (JSON Schema for MCP ListTools response)
// ---------------------------------------------------------------------------

export const RunPlaybookTool = {
  name: 'run_playbook',
  description:
    'Start a guided playbook session. A playbook is a multi-step workflow that collects ' +
    'project context and generates institutional memory artifacts. ' +
    'Returns the first step prompt and a session ID to use with advance_step.',
  inputSchema: {
    type: 'object',
    properties: {
      playbook_id: {
        type: 'string',
        description:
          'ID of the playbook to start. Available playbooks: ' +
          'initialize-project, brownfield-onboard, research-analyze.',
      },
      project_id: {
        type: 'string',
        description: 'UUID of the project this playbook session belongs to.',
      },
    },
    required: ['playbook_id', 'project_id'],
  },
} as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleRunPlaybook(
  params: unknown,
  runner: PlaybookRunner
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('run_playbook called', params);

    const validated: RunPlaybookParams = RunPlaybookParamsSchema.parse(params);

    logger.info('Starting playbook', {
      playbookId: validated.playbook_id,
      projectId: validated.project_id,
    });

    const { session, step, prompt } = await runner.startPlaybook({
      playbook_id: validated.playbook_id,
      project_id: validated.project_id,
    });

    // Load playbook metadata for total_steps count
    const allPlaybooks = await listPlaybooks();
    const playbook = allPlaybooks.find((p) => p.id === validated.playbook_id);
    const totalSteps = playbook?.steps.length ?? '?';
    const playbookName = playbook?.name ?? validated.playbook_id;

    const text =
      `# Playbook Started: ${playbookName}\n\n` +
      `**Session ID:** ${session.id}\n` +
      `**Step:** 1 of ${totalSteps} — ${step.title}\n\n` +
      `---\n\n` +
      `${prompt}\n\n` +
      `---\n\n` +
      `When you have your answer, call \`advance_step\` with:\n` +
      `- \`session_id\`: "${session.id}"\n` +
      `- \`input\`: an object containing the fields requested above`;

    return {
      content: [{ type: 'text', text }],
    };
  } catch (error) {
    logger.error('run_playbook failed', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for run_playbook: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'run_playbook',
        error
      );
    }

    throw new McpToolError(
      `Failed to start playbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'run_playbook',
      error instanceof Error ? error : undefined
    );
  }
}
