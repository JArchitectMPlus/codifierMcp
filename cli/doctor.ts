/**
 * `codifier doctor` — verify installation health.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectEnvironment, type ClientType } from './detect.js';

const REQUIRED_SKILLS = [
  'initialize-project/SKILL.md',
  'brownfield-onboard/SKILL.md',
  'research-analyze/SKILL.md',
];

export async function runDoctor(clientOverride?: ClientType): Promise<void> {
  const cwd = process.cwd();
  const env = detectEnvironment(cwd, clientOverride);
  const configPath = join(cwd, '.codifier', 'config.json');
  let allGood = true;

  console.log(`\nCodifier Doctor (client: ${env.clientType})\n`);

  // Check config
  if (!existsSync(configPath)) {
    console.error('✗ .codifier/config.json not found — run `codifier init` first');
    allGood = false;
  } else {
    console.log('✓ .codifier/config.json found');
  }

  // Check skill files in the client-appropriate location
  for (const skillFile of REQUIRED_SKILLS) {
    const fullPath = join(env.skillsDir, skillFile);
    if (!existsSync(fullPath) || readFileSync(fullPath, 'utf8').trim().length === 0) {
      console.error(`✗ Missing or empty: ${skillFile} in ${env.skillsDir}`);
      allGood = false;
    } else {
      console.log(`✓ ${skillFile}`);
    }
  }

  // Check Cowork-specific files
  if (env.clientType === 'cowork') {
    const manifestPath = join(cwd, '.claude-plugin', 'plugin.json');
    if (!existsSync(manifestPath)) {
      console.error('✗ .claude-plugin/plugin.json not found — run `codifier init --client cowork` to regenerate');
      allGood = false;
    } else {
      console.log('✓ .claude-plugin/plugin.json found');
    }
  }

  // Check MCP connectivity
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
        serverUrl: string;
        apiKey: string;
      };
      console.log('\nChecking MCP connectivity...');
      const response = await fetch(`${config.serverUrl}/health`);
      if (response.ok) {
        console.log('✓ MCP server reachable');
      } else {
        console.warn(`⚠ Health check returned ${response.status}`);
        allGood = false;
      }
    } catch {
      console.warn('⚠ Could not reach MCP server');
      allGood = false;
    }
  }

  console.log(allGood ? '\n✅ All checks passed\n' : '\n⚠ Some checks failed — see above\n');
  if (!allGood) process.exit(1);
}
