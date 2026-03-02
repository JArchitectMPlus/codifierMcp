/**
 * `codifier update` — pull latest skills from the npm package.
 */

import { cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectEnvironment } from './detect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');
const SKILLS_SOURCE = join(PACKAGE_ROOT, 'skills');

export async function runUpdate(): Promise<void> {
  const cwd = process.cwd();
  const env = detectEnvironment(cwd);

  if (!existsSync(env.skillsDir)) {
    console.error(`Error: ${env.skillsDir} not found. Run \`codifier init\` first.`);
    process.exit(1);
  }

  if (!existsSync(SKILLS_SOURCE)) {
    console.error(`Error: Skills source not found at ${SKILLS_SOURCE}`);
    process.exit(1);
  }

  cpSync(SKILLS_SOURCE, env.skillsDir, { recursive: true });
  console.log(`✓ Skills updated in ${env.skillsDir}`);
  console.log('Note: .codifier/config.json was preserved.');
}
