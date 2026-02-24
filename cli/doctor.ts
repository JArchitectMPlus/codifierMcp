/**
 * `codifier doctor` — verify installation health.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REQUIRED_SKILLS = [
  'initialize-project/SKILL.md',
  'brownfield-onboard/SKILL.md',
  'research-analyze/SKILL.md',
];

export async function runDoctor(): Promise<void> {
  const cwd = process.cwd();
  const configPath = join(cwd, '.codifier', 'config.json');
  let allGood = true;

  console.log('\nCodifier Doctor\n');

  // Check config
  if (!existsSync(configPath)) {
    console.error('✗ .codifier/config.json not found — run `codifier init` first');
    allGood = false;
  } else {
    console.log('✓ .codifier/config.json found');
  }

  // Check skill files
  for (const skillFile of REQUIRED_SKILLS) {
    const fullPath = join(cwd, '.codifier', 'skills', skillFile);
    if (!existsSync(fullPath) || readFileSync(fullPath, 'utf8').trim().length === 0) {
      console.error(`✗ Missing or empty: .codifier/skills/${skillFile}`);
      allGood = false;
    } else {
      console.log(`✓ .codifier/skills/${skillFile}`);
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
