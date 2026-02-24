/**
 * `codifier init` — one-time scaffolder.
 * Copies skills, slash commands, and writes MCP config.
 */

import { mkdirSync, cpSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { detectEnvironment } from './detect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In the published npm package, skills/ is at the package root (sibling of dist/)
// When running from dist/cli/, the package root is two levels up
const PACKAGE_ROOT = join(__dirname, '..', '..');
const SKILLS_SOURCE = join(PACKAGE_ROOT, 'skills');
const COMMANDS_SOURCE = join(PACKAGE_ROOT, 'commands');

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const env = detectEnvironment(cwd);

  console.log(`\nCodifier Init — detected client: ${env.clientType}\n`);

  // 1. Create .codifier/skills/ and copy all skills
  const skillsDest = join(cwd, '.codifier', 'skills');
  mkdirSync(skillsDest, { recursive: true });

  if (existsSync(SKILLS_SOURCE)) {
    cpSync(SKILLS_SOURCE, skillsDest, { recursive: true });
    console.log('✓ Skills copied to .codifier/skills/');
  } else {
    console.warn(`⚠ Skills source not found at ${SKILLS_SOURCE} — skipping`);
  }

  // 2. Copy slash commands to client-specific location
  mkdirSync(env.commandsDir, { recursive: true });

  if (existsSync(COMMANDS_SOURCE)) {
    cpSync(COMMANDS_SOURCE, env.commandsDir, { recursive: true });
    console.log(`✓ Commands copied to ${env.commandsDir}`);
  } else {
    console.warn(`⚠ Commands source not found at ${COMMANDS_SOURCE} — skipping`);
  }

  // 3. Prompt for server URL and API key
  const serverUrl = await prompt('Codifier MCP server URL (e.g., https://codifier-mcp.fly.dev): ');
  const apiKey = await prompt('Codifier API key: ');

  // 4. Write .codifier/config.json
  const configDir = join(cwd, '.codifier');
  mkdirSync(configDir, { recursive: true });
  const config = { serverUrl, apiKey, installedAt: new Date().toISOString() };
  writeFileSync(join(configDir, 'config.json'), JSON.stringify(config, null, 2));
  console.log('✓ Config saved to .codifier/config.json');

  // 5. Write MCP config (client-specific format)
  const mcpConfig = buildMcpConfig(serverUrl, apiKey);
  writeFileSync(env.mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  console.log(`✓ MCP config written to ${env.mcpConfigPath}`);

  // 6. Verify connectivity (best-effort)
  console.log('\nVerifying MCP connectivity...');
  try {
    const response = await fetch(`${serverUrl}/health`);
    if (response.ok) {
      console.log('✓ MCP server reachable');
    } else {
      console.warn(`⚠ Health check returned ${response.status} — check your server URL`);
    }
  } catch {
    console.warn('⚠ Could not reach MCP server — check the URL and ensure the server is running');
  }

  // 7. Print summary
  console.log('\n✅ Codifier installed successfully!\n');
  console.log('Available skills:');
  console.log('  • Initialize Project  →  /init');
  console.log('  • Brownfield Onboard  →  /onboard');
  console.log('  • Research & Analyze  →  /research');
  console.log('\nRun /init in your LLM client to start your first project.\n');
}

function buildMcpConfig(serverUrl: string, apiKey: string): Record<string, unknown> {
  return {
    mcpServers: {
      codifier: {
        url: `${serverUrl}/sse`,
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  };
}
