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

program
  .name('codifier')
  .description('Codifier MCP — install and manage AI skills for your project')
  .version('2.0.0');

program
  .command('init')
  .description('Scaffold Codifier skills, slash commands, and MCP config into this project')
  .action(async () => {
    await runInit();
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
  .action(async () => {
    await runDoctor();
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
