/**
 * manage_projects MCP tool implementation
 */

import { z } from 'zod';
import { ManageProjectsParamsSchema, type ManageProjectsParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError, DataStoreError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import type { ProjectRow } from '../../datastore/supabase-types.js';

export const ManageProjectsTool = {
  name: 'manage_projects',
  description:
    'Create, list, or switch active projects. ' +
    'All memories, sessions, and repositories are scoped to a project. ' +
    'Use "create" to start a new project, "list" to see all, "switch" to validate and activate one.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'list', 'switch'],
        description: 'Operation to perform on projects',
      },
      name: {
        type: 'string',
        description: 'Project name — required for "create"',
      },
      org: {
        type: 'string',
        description: 'Organisation name — optional for "create"',
      },
      project_id: {
        type: 'string',
        description: 'Project UUID — required for "switch"',
      },
    },
    required: ['operation'],
  },
} as const;

export async function handleManageProjects(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    logger.debug('manage_projects called', params);

    const validated: ManageProjectsParams = ManageProjectsParamsSchema.parse(params);

    switch (validated.operation) {
      case 'create': {
        if (!validated.name) {
          throw new McpToolError(
            'Parameter "name" is required for the "create" operation',
            'manage_projects'
          );
        }

        logger.info('Creating project', { name: validated.name, org: validated.org });

        const project = await dataStore.createProject({
          name: validated.name,
          org: validated.org,
        });

        return {
          content: [
            {
              type: 'text',
              text: formatProjectCreated(project),
            },
          ],
        };
      }

      case 'list': {
        logger.info('Listing projects');

        const projects = await dataStore.listProjects();

        return {
          content: [
            {
              type: 'text',
              text: formatProjectList(projects),
            },
          ],
        };
      }

      case 'switch': {
        if (!validated.project_id) {
          throw new McpToolError(
            'Parameter "project_id" is required for the "switch" operation',
            'manage_projects'
          );
        }

        logger.info('Switching to project', { project_id: validated.project_id });

        const project = await dataStore.getProject(validated.project_id);

        if (!project) {
          throw new DataStoreError(
            `Project not found: ${validated.project_id}`
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: formatProjectSwitched(project),
            },
          ],
        };
      }
    }
  } catch (error) {
    logger.error('Failed to manage projects', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for manage_projects: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'manage_projects',
        error
      );
    }

    if (error instanceof McpToolError) throw error;

    throw new McpToolError(
      `Failed to manage projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'manage_projects',
      error instanceof Error ? error : undefined
    );
  }
}

function formatProjectCreated(project: ProjectRow): string {
  return (
    `# Project Created\n\n` +
    `**ID:** ${project.id}\n` +
    `**Name:** ${project.name}\n` +
    (project.org ? `**Org:** ${project.org}\n` : '') +
    `**Created:** ${project.created_at}\n\n` +
    `Use this project_id in all subsequent tool calls to scope operations to this project.`
  );
}

function formatProjectList(projects: ProjectRow[]): string {
  if (projects.length === 0) {
    return '# Projects\n\nNo projects found. Use manage_projects with operation "create" to create one.';
  }

  const rows = projects
    .map(
      (p) =>
        `- **${p.name}** (${p.id})` +
        (p.org ? ` — ${p.org}` : '') +
        ` — created ${p.created_at.slice(0, 10)}`
    )
    .join('\n');

  return `# Projects (${projects.length})\n\n${rows}`;
}

function formatProjectSwitched(project: ProjectRow): string {
  return (
    `# Active Project\n\n` +
    `**ID:** ${project.id}\n` +
    `**Name:** ${project.name}\n` +
    (project.org ? `**Org:** ${project.org}\n` : '') +
    `**Created:** ${project.created_at}\n\n` +
    `Project validated. Use project_id "${project.id}" in subsequent tool calls.`
  );
}
