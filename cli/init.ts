/**
 * `codifier init` — one-time scaffolder.
 * Copies skills, slash commands, and writes MCP config.
 */

import { mkdirSync, cpSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import {
  detectEnvironment,
  detectExistingClient,
  detectAllClients,
  buildEnvironment,
  CodifierConfigSchema,
  type ClientType,
} from './detect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In the published npm package, skills/ is at the package root (sibling of dist/)
// When running from dist/cli/, the package root is two levels up
const PACKAGE_ROOT = join(__dirname, '..', '..');
const SKILLS_SOURCE = join(PACKAGE_ROOT, 'skills');
const COMMANDS_SOURCE = join(PACKAGE_ROOT, 'commands');

const CLIENT_MENU: Array<{ label: string; value: ClientType }> = [
  { label: 'Claude Code (Anthropic)', value: 'claude-code' },
  { label: 'Cursor', value: 'cursor' },
  { label: 'Windsurf', value: 'windsurf' },
  { label: 'Google Gemini CLI', value: 'gemini' },
  { label: 'OpenAI Codex / GPT', value: 'codex' },
  { label: 'Cowork (Claude Code plugin)', value: 'cowork' },
  { label: 'Other / None (use generic .codifier/ layout)', value: 'generic' },
];

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive numbered menu for selecting the LLM client.
 * Only called when stdin is a TTY and CI is not set.
 */
async function promptForClient(): Promise<ClientType> {
  console.log('\nWhich LLM client are you using?');
  CLIENT_MENU.forEach((entry, idx) => {
    console.log(`  ${idx + 1}. ${entry.label}`);
  });
  console.log('');

  const answer = await prompt(`Enter a number [1-${CLIENT_MENU.length}]: `);
  const num = parseInt(answer, 10);
  if (num >= 1 && num <= CLIENT_MENU.length) {
    return CLIENT_MENU[num - 1].value;
  }

  console.warn('Invalid selection — defaulting to generic layout.');
  return 'generic';
}

export async function runInit(clientOverride?: ClientType, urlFlag?: string, keyFlag?: string): Promise<void> {
  const cwd = process.cwd();
  const configDir = join(cwd, '.codifier');
  const configPath = join(configDir, 'config.json');
  const isInteractive = process.stdin.isTTY && !process.env['CI'];

  // Re-run safety: warn if already initialized
  if (existsSync(configPath)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
      const existing = CodifierConfigSchema.parse(raw);
      const when = existing.installedAt
        ? ` (installed ${existing.installedAt.split('T')[0]})`
        : '';
      console.warn(
        `\nWarning: Codifier is already initialized in this directory${when}.`
      );
      if (existing.clientType) {
        console.warn(`Existing client type: ${existing.clientType}`);
      }
      if (isInteractive) {
        const confirm = await prompt('Overwrite existing configuration? [y/N]: ');
        if (!confirm.toLowerCase().startsWith('y')) {
          console.log('Aborted — no changes made.');
          return;
        }
      } else {
        console.warn('Non-interactive mode: proceeding with overwrite.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Could not parse existing config.json — ${msg}`);
    }
  }

  // Resolve client type (3-step priority)
  let clientType: ClientType;

  if (clientOverride) {
    clientType = clientOverride;
    console.log(`\nUsing specified client: ${clientType}`);
  } else {
    const allDetected = detectAllClients(cwd);
    const firstDetected = detectExistingClient(cwd);

    if (firstDetected !== null) {
      if (allDetected.length > 1) {
        console.warn(
          `\nNotice: Multiple LLM client directories detected: ${allDetected.join(', ')}.`
        );
        console.warn(`Using first match: ${firstDetected}`);
      } else {
        console.log(`\nDetected: ${firstDetected}`);
      }
      clientType = firstDetected;
    } else if (isInteractive) {
      clientType = await promptForClient();
    } else {
      console.warn('\nNon-interactive mode: no client detected — using generic layout.');
      clientType = 'generic';
    }
  }

  const env = buildEnvironment(cwd, clientType);

  console.log(`\nCodifier Init — client: ${env.clientType}\n`);

  // 1. Copy skills to the client-appropriate location
  mkdirSync(env.skillsDir, { recursive: true });

  if (existsSync(SKILLS_SOURCE)) {
    cpSync(SKILLS_SOURCE, env.skillsDir, { recursive: true });
    console.log(`✓ Skills copied to ${env.skillsDir}`);
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

  // 2b. Cowork: write plugin.json manifest
  if (env.clientType === 'cowork') {
    const pluginDir = join(cwd, '.claude-plugin');
    mkdirSync(pluginDir, { recursive: true });
    const version = getPackageVersion();
    const manifest = {
      name: 'codifier',
      description: 'Institutional memory for AI-driven development',
      version,
      author: { name: 'Codifier' },
    };
    writeFileSync(join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
    console.log('✓ Cowork plugin manifest written to .claude-plugin/plugin.json');
  }

  // 3. Resolve server URL and API key: flags → env vars → interactive prompt → default/error
  const DEFAULT_SERVER_URL = 'https://codifier-mcp.fly.dev';
  const serverUrl =
    urlFlag ||
    process.env['CODIFIER_SERVER_URL'] ||
    (isInteractive ? await prompt(`Codifier MCP server URL [${DEFAULT_SERVER_URL}]: `) : '') ||
    DEFAULT_SERVER_URL;

  const apiKey =
    keyFlag ||
    process.env['CODIFIER_API_KEY'] ||
    (isInteractive ? await prompt('Codifier API key: ') : '');

  if (!apiKey) {
    console.error('Error: No API key provided. Use --key <key> or set CODIFIER_API_KEY.');
    process.exit(1);
  }

  // 4. Write .codifier/config.json (includes clientType for future detection)
  mkdirSync(configDir, { recursive: true });
  const config = {
    clientType,
    serverUrl,
    apiKey,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✓ Config saved to .codifier/config.json');

  // 4b. Create docs/ directory for local artifact copies
  const docsDir = join(cwd, 'docs');
  mkdirSync(docsDir, { recursive: true });
  console.log('✓ Created docs/ for local artifact storage');

  // 4c. Create docs/MEMORY.md placeholder if it doesn't exist
  const memoryFile = join(docsDir, 'MEMORY.md');
  if (!existsSync(memoryFile)) {
    const memoryPlaceholder = `# Project Memory
_Last updated: ${new Date().toISOString().split('T')[0]}_

`;
    writeFileSync(memoryFile, memoryPlaceholder);
    console.log('✓ Created docs/MEMORY.md for session memory capture');
  }

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
  console.log('  • Initialize Project  →  /codify');
  console.log('  • Brownfield Onboard  →  /onboard');
  console.log('  • Research & Analyze  →  /research');
  console.log('\nMemory capture:');
  console.log('  • Capture learnings   →  /remember');
  console.log('  • Push to shared KB   →  /push-memory');
  console.log('  • Recall learnings    →  /recall');
  console.log('\n  Artifacts and memories saved locally to docs/');
  console.log('\nRun /codify in your LLM client to start your first project.\n');
}

function buildMcpConfig(serverUrl: string, apiKey: string): Record<string, unknown> {
  return {
    mcpServers: {
      codifier: {
        type: 'http',
        url: `${serverUrl}/mcp`,
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  };
}

function getPackageVersion(): string {
  try {
    const pkgPath = join(PACKAGE_ROOT, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    return pkg.version;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Could not read package.json version — ${msg}`);
    return '2.0.0';
  }
}
