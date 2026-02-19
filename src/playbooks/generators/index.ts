/**
 * Generators index — re-exports all prompt builder functions and provides
 * a dynamic lookup helper used by PlaybookRunner at runtime.
 */

export { rulesFromContextPrompt } from './rules-from-context.js';
export { evalsFromRulesPrompt } from './evals-from-rules.js';
export { requirementsFromContextPrompt } from './requirements-from-context.js';
export { roadmapFromRequirementsPrompt } from './roadmap-from-requirements.js';
export { queriesFromObjectivePrompt } from './queries-from-objective.js';
export { researchSynthesisPrompt } from './research-synthesis.js';

import { rulesFromContextPrompt } from './rules-from-context.js';
import { evalsFromRulesPrompt } from './evals-from-rules.js';
import { requirementsFromContextPrompt } from './requirements-from-context.js';
import { roadmapFromRequirementsPrompt } from './roadmap-from-requirements.js';
import { queriesFromObjectivePrompt } from './queries-from-objective.js';
import { researchSynthesisPrompt } from './research-synthesis.js';

type GeneratorFn = (context: Record<string, unknown>) => string;

const GENERATORS: Record<string, GeneratorFn> = {
  'rules-from-context': rulesFromContextPrompt,
  'evals-from-rules': evalsFromRulesPrompt,
  'requirements-from-context': requirementsFromContextPrompt,
  'roadmap-from-requirements': roadmapFromRequirementsPrompt,
  'queries-from-objective': queriesFromObjectivePrompt,
  'research-synthesis': researchSynthesisPrompt,
};

/**
 * Look up a generator function by its registered name.
 *
 * @returns The generator function, or `null` if no matching generator is found.
 */
export function getGenerator(name: string): GeneratorFn | null {
  return GENERATORS[name] ?? null;
}

/**
 * List the names of all registered generators.
 */
export function listGeneratorNames(): string[] {
  return Object.keys(GENERATORS);
}
