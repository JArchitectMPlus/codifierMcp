/**
 * Environment detection — identifies which LLM client is in use
 * by checking for client-specific directories.
 * Accepts an optional override for cases where auto-detection fails
 * (e.g., Cowork has no pre-existing directory before init).
 */

import { existsSync } from 'fs';
import { join } from 'path';

export type ClientType = 'claude-code' | 'cowork' | 'cursor' | 'windsurf' | 'generic';

export interface DetectedEnvironment {
  clientType: ClientType;
  commandsDir: string;
  skillsDir: string;
  mcpConfigPath: string;
}

export function detectEnvironment(cwd: string = process.cwd(), clientOverride?: ClientType): DetectedEnvironment {
  if (clientOverride) {
    return buildEnvironment(cwd, clientOverride);
  }

  // Cowork: .claude-plugin/ exists (re-init or manually created)
  if (existsSync(join(cwd, '.claude-plugin'))) {
    return buildEnvironment(cwd, 'cowork');
  }

  if (existsSync(join(cwd, '.claude'))) {
    return buildEnvironment(cwd, 'claude-code');
  }

  if (existsSync(join(cwd, '.cursor'))) {
    return buildEnvironment(cwd, 'cursor');
  }

  if (existsSync(join(cwd, '.windsurf'))) {
    return buildEnvironment(cwd, 'windsurf');
  }

  return buildEnvironment(cwd, 'generic');
}

function buildEnvironment(cwd: string, clientType: ClientType): DetectedEnvironment {
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
    default:
      return {
        clientType,
        commandsDir: join(cwd, '.codifier', 'commands'),
        skillsDir: join(cwd, '.codifier', 'skills'),
        mcpConfigPath: join(cwd, '.codifier', 'mcp.json'),
      };
  }
}
