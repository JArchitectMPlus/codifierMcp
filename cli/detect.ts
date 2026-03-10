/**
 * Environment detection — identifies which LLM client is in use
 * by checking for client-specific directories.
 * Accepts an optional override for cases where auto-detection fails
 * (e.g., Cowork has no pre-existing directory before init).
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

export const ClientTypeSchema = z.enum([
  'claude-code',
  'cowork',
  'cursor',
  'windsurf',
  'gemini',
  'codex',
  'generic',
]);

export type ClientType = z.infer<typeof ClientTypeSchema>;

/** Zod schema for .codifier/config.json */
export const CodifierConfigSchema = z.object({
  clientType: ClientTypeSchema.optional(),
  serverUrl: z.string().optional(),
  apiKey: z.string().optional(),
  installedAt: z.string().optional(),
});

export interface DetectedEnvironment {
  clientType: ClientType;
  commandsDir: string;
  skillsDir: string;
  mcpConfigPath: string;
}

/**
 * Pure filesystem probe — returns the first detected client type, or null
 * if no known client directory is found.
 */
export function detectExistingClient(cwd: string): ClientType | null {
  // Cowork: .claude-plugin/ exists (re-init or manually created)
  if (existsSync(join(cwd, '.claude-plugin'))) return 'cowork';
  if (existsSync(join(cwd, '.claude'))) return 'claude-code';
  if (existsSync(join(cwd, '.cursor'))) return 'cursor';
  if (existsSync(join(cwd, '.windsurf'))) return 'windsurf';
  if (existsSync(join(cwd, '.gemini'))) return 'gemini';
  if (existsSync(join(cwd, '.codex'))) return 'codex';
  return null;
}

/**
 * Returns ALL detected client types (for multi-detection warnings).
 */
export function detectAllClients(cwd: string): ClientType[] {
  const found: ClientType[] = [];
  if (existsSync(join(cwd, '.claude-plugin'))) found.push('cowork');
  if (existsSync(join(cwd, '.claude'))) found.push('claude-code');
  if (existsSync(join(cwd, '.cursor'))) found.push('cursor');
  if (existsSync(join(cwd, '.windsurf'))) found.push('windsurf');
  if (existsSync(join(cwd, '.gemini'))) found.push('gemini');
  if (existsSync(join(cwd, '.codex'))) found.push('codex');
  return found;
}

/**
 * Pure mapping from a ClientType to its directory layout.
 */
export function buildEnvironment(cwd: string, clientType: ClientType): DetectedEnvironment {
  switch (clientType) {
    case 'cowork':
      // Cowork plugin spec: commands/ and skills/ at project root,
      // only plugin.json inside .claude-plugin/
      return {
        clientType,
        commandsDir: join(cwd, 'commands'),
        skillsDir: join(cwd, 'skills'),
        mcpConfigPath: join(cwd, '.mcp.json'),
      };
    case 'claude-code':
      return {
        clientType,
        commandsDir: join(cwd, '.claude', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.mcp.json'),
      };
    case 'cursor':
      return {
        clientType,
        commandsDir: join(cwd, '.cursor', 'rules'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.cursor', 'mcp.json'),
      };
    case 'windsurf':
      return {
        clientType,
        commandsDir: join(cwd, '.windsurf', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.windsurf', 'mcp.json'),
      };
    case 'gemini':
      return {
        clientType,
        commandsDir: join(cwd, '.gemini', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.gemini', 'mcp.json'),
      };
    case 'codex':
      return {
        clientType,
        commandsDir: join(cwd, '.codex', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.codex', 'mcp.json'),
      };
    default:
      return {
        clientType: 'generic',
        commandsDir: join(cwd, '.codifier', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.codifier', 'mcp.json'),
      };
  }
}

/**
 * Three-step detection with fallback:
 *  1. If override provided → use it directly
 *  2. Probe filesystem for known client directories
 *  3. Read .codifier/config.json for stored clientType
 *  4. Fall back to generic
 */
export function detectEnvironment(cwd: string = process.cwd(), clientOverride?: ClientType): DetectedEnvironment {
  // Step 1: explicit override
  if (clientOverride) {
    return buildEnvironment(cwd, clientOverride);
  }

  // Step 2: filesystem probe
  const detected = detectExistingClient(cwd);
  if (detected !== null) {
    return buildEnvironment(cwd, detected);
  }

  // Step 3: read persisted clientType from .codifier/config.json
  const configPath = join(cwd, '.codifier', 'config.json');
  if (existsSync(configPath)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
      const config = CodifierConfigSchema.parse(raw);
      if (config.clientType) {
        return buildEnvironment(cwd, config.clientType);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Could not parse .codifier/config.json — ${msg}`);
    }
  }

  // Step 4: generic fallback
  return buildEnvironment(cwd, 'generic');
}
