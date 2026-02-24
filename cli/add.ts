/**
 * `codifier add <skill>` — install a single skill by name.
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');
const SKILLS_SOURCE = join(PACKAGE_ROOT, 'skills');

export async function runAdd(skillName: string): Promise<void> {
  const cwd = process.cwd();
  const skillSource = join(SKILLS_SOURCE, skillName);

  if (!existsSync(skillSource)) {
    console.error(`Error: Skill "${skillName}" not found.`);
    console.error('Available skills: initialize-project, brownfield-onboard, research-analyze');
    process.exit(1);
  }

  const skillsDest = join(cwd, '.codifier', 'skills', skillName);
  mkdirSync(skillsDest, { recursive: true });
  cpSync(skillSource, skillsDest, { recursive: true });

  console.log(`✓ Skill "${skillName}" installed to .codifier/skills/${skillName}/`);
}
