/**
 * Environment detection — identifies which LLM client is in use
 * by checking for client-specific directories.
 */

import { existsSync } from 'fs';
import { join } from 'path';

export type ClientType = 'claude-code' | 'cursor' | 'windsurf' | 'generic';

export interface DetectedEnvironment {
  clientType: ClientType;
  commandsDir: string;
  mcpConfigPath: string;
}

export function detectEnvironment(cwd: string = process.cwd()): DetectedEnvironment {
  if (existsSync(join(cwd, '.claude'))) {
    return {
      clientType: 'claude-code',
      commandsDir: join(cwd, '.claude', 'commands'),
      mcpConfigPath: join(cwd, '.mcp.json'),
    };
  }

  if (existsSync(join(cwd, '.cursor'))) {
    return {
      clientType: 'cursor',
      commandsDir: join(cwd, '.cursor', 'rules'),
      mcpConfigPath: join(cwd, '.cursor', 'mcp.json'),
    };
  }

  if (existsSync(join(cwd, '.windsurf'))) {
    return {
      clientType: 'windsurf',
      commandsDir: join(cwd, '.windsurf', 'commands'),
      mcpConfigPath: join(cwd, '.windsurf', 'mcp.json'),
    };
  }

  return {
    clientType: 'generic',
    commandsDir: join(cwd, '.codifier', 'commands'),
    mcpConfigPath: join(cwd, '.codifier', 'mcp.json'),
  };
}
