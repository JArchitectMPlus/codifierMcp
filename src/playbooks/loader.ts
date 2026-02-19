/**
 * Playbook loader — reads YAML definitions from disk and validates them with Zod.
 */

import { readFile, readdir, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { CodifierError } from '../utils/errors.js';
import type { Playbook } from './types.js';

// ---------------------------------------------------------------------------
// Zod schema — validates the raw YAML structure
// ---------------------------------------------------------------------------

const PlaybookStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  action: z.enum(['store', 'skill-invoke', 'generate', 'data-query']),
  store_as: z.string().optional(),
  generator: z.string().optional(),
  query_operation: z.string().optional(),
  collect: z.array(z.string()).optional(),
});

const PlaybookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['developer', 'researcher']),
  description: z.string().min(1),
  steps: z.array(PlaybookStepSchema).min(1),
});

// ---------------------------------------------------------------------------
// Resolve the definitions directory
//
// YAML files live in src/playbooks/definitions/ and are NOT copied to dist/
// by tsc. We therefore prefer the cwd-relative path so the server can find
// the YAML files whether running via ts-node or compiled JS (Fly.io / local).
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the absolute path to the definitions directory.
 *
 * Resolution order:
 * 1. `<cwd>/src/playbooks/definitions` — works for compiled dist/ where cwd
 *    is the project root (Fly.io, local `node dist/index.js`)
 * 2. `<__dirname>/definitions` — fallback for co-located YAML (bundler / copy)
 */
async function resolveDefinitionsDir(): Promise<string> {
  const cwdBased = join(process.cwd(), 'src', 'playbooks', 'definitions');
  try {
    await access(cwdBased);
    return cwdBased;
  } catch {
    return join(__dirname, 'definitions');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a single playbook by its ID.
 *
 * Searches all role sub-directories under `definitions/` for a file whose
 * base name (without extension) matches `playbookId`.
 *
 * @throws {CodifierError} if the playbook file cannot be found or is invalid
 */
export async function loadPlaybook(playbookId: string): Promise<Playbook> {
  logger.debug('Loading playbook', { playbookId });

  const defsDir = await resolveDefinitionsDir();
  let filePath: string | undefined;

  try {
    const roleDirs = await readdir(defsDir);

    outer: for (const role of roleDirs) {
      const roleDir = join(defsDir, role);
      const files = await readdir(roleDir);

      for (const file of files) {
        if (file === `${playbookId}.yaml` || file === `${playbookId}.yml`) {
          filePath = join(roleDir, file);
          break outer;
        }
      }
    }
  } catch (error) {
    throw new CodifierError(
      `Failed to scan playbook definitions directory "${defsDir}": ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!filePath) {
    throw new CodifierError(
      `Playbook not found: "${playbookId}". ` +
        `Ensure a file named "${playbookId}.yaml" exists under src/playbooks/definitions/.`
    );
  }

  return parsePlaybookFile(filePath);
}

/**
 * List all available playbooks from all role sub-directories.
 *
 * Files that fail to parse are logged as warnings and excluded from results.
 */
export async function listPlaybooks(): Promise<Playbook[]> {
  logger.debug('Listing all playbooks');

  const defsDir = await resolveDefinitionsDir();
  const playbooks: Playbook[] = [];

  let roleDirs: string[];
  try {
    roleDirs = await readdir(defsDir);
  } catch (error) {
    throw new CodifierError(
      `Failed to read playbook definitions directory "${defsDir}": ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  for (const role of roleDirs) {
    const roleDir = join(defsDir, role);
    let files: string[];

    try {
      files = await readdir(roleDir);
    } catch {
      logger.warn('Could not read role directory, skipping', { roleDir });
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const filePath = join(roleDir, file);
      try {
        const playbook = await parsePlaybookFile(filePath);
        playbooks.push(playbook);
      } catch (error) {
        logger.warn('Skipping invalid playbook file', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  logger.debug('Playbooks loaded', { count: playbooks.length });
  return playbooks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function parsePlaybookFile(filePath: string): Promise<Playbook> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new CodifierError(
      `Cannot read playbook file "${filePath}": ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (error) {
    throw new CodifierError(
      `YAML parse error in "${filePath}": ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  const result = PlaybookSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new CodifierError(`Invalid playbook schema in "${filePath}": ${issues}`);
  }

  logger.debug('Playbook parsed successfully', { id: result.data.id, file: filePath });
  return result.data as Playbook;
}
