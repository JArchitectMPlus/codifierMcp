/**
 * `codifier update` — pull latest skills from the npm package.
 */

import { cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');
const SKILLS_SOURCE = join(PACKAGE_ROOT, 'skills');

export async function runUpdate(): Promise<void> {
  const cwd = process.cwd();
  const skillsDest = join(cwd, '.codifier', 'skills');

  if (!existsSync(skillsDest)) {
    console.error('Error: .codifier/skills/ not found. Run `codifier init` first.');
    process.exit(1);
  }

  if (!existsSync(SKILLS_SOURCE)) {
    console.error(`Error: Skills source not found at ${SKILLS_SOURCE}`);
    process.exit(1);
  }

  cpSync(SKILLS_SOURCE, skillsDest, { recursive: true });
  console.log('✓ Skills updated in .codifier/skills/');
  console.log('Note: .codifier/config.json was preserved.');
}
