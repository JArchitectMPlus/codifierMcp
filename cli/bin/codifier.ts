#!/usr/bin/env node
/**
 * Codifier CLI entry point
 * Usage: npx codifier <command>
 */

import { program } from 'commander';
import { runInit } from '../init.js';
import { runUpdate } from '../update.js';
import { runAdd } from '../add.js';
import { runDoctor } from '../doctor.js';
import type { ClientType } from '../detect.js';

const VALID_CLIENT_TYPES: ClientType[] = [
  'claude-code',
  'cowork',
  'cursor',
  'windsurf',
  'gemini',
  'codex',
  'generic',
];

function validateClientType(value: string): ClientType {
  if (!(VALID_CLIENT_TYPES as string[]).includes(value)) {
    console.error(
      `Error: Invalid --client value "${value}". Valid values: ${VALID_CLIENT_TYPES.join(', ')}`
    );
    process.exit(1);
  }
  return value as ClientType;
}

program
  .name('codifier')
  .description('Codifier MCP — install and manage AI skills for your project')
  .version('2.2.2');

program
  .command('init')
  .description('Scaffold Codifier skills, slash commands, and MCP config into this project')
  .option(
    '--client <type>',
    `Override client detection (${VALID_CLIENT_TYPES.join(', ')})`
  )
  .option('--url <serverUrl>', 'MCP server URL (skips interactive prompt)')
  .option('--key <apiKey>', 'Codifier API key (skips interactive prompt)')
  .action(async (opts: { client?: string; url?: string; key?: string }) => {
    const clientType = opts.client ? validateClientType(opts.client) : undefined;
    await runInit(clientType, opts.url, opts.key);
  });

program
  .command('update')
  .description('Pull the latest skills from the npm package into .codifier/skills/')
  .action(async () => {
    await runUpdate();
  });

program
  .command('add <skill>')
  .description('Install a single skill by name (e.g., research-analyze)')
  .action(async (skill: string) => {
    await runAdd(skill);
  });

program
  .command('doctor')
  .description('Verify MCP connectivity and check installed skill files')
  .option(
    '--client <type>',
    `Override client detection (${VALID_CLIENT_TYPES.join(', ')})`
  )
  .action(async (opts: { client?: string }) => {
    const clientType = opts.client ? validateClientType(opts.client) : undefined;
    await runDoctor(clientType);
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
