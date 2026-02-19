/**
 * Generator: evals-from-rules
 *
 * Produces a prompt that instructs the client LLM to generate evaluation
 * criteria (evals) derived from a set of project rules.
 */

export function evalsFromRulesPrompt(context: Record<string, unknown>): string {
  return `You are a quality-engineering expert. Using the project rules below, create a set of \
structured evaluation criteria that can be used to verify compliance with those rules during \
code review, CI checks, or AI-assisted development sessions.

## Project Rules

${JSON.stringify(context['rules'] ?? context['generated_rules'] ?? '(no rules provided)', null, 2)}

## Project Context

Project Name: ${context['project_name'] ?? '(not provided)'}
Description: ${context['description'] ?? '(not provided)'}

## Instructions

For EACH rule, produce one or more evals. Each eval must include:
- **id**: a slug identifier (e.g., "eval-validate-input-boundary")
- **rule_ref**: the title or ID of the rule being evaluated
- **description**: what this eval checks
- **pass_criteria**: precise, observable conditions that indicate the rule is being followed
- **fail_criteria**: precise, observable conditions that indicate a violation
- **automation_hint**: whether this can be checked automatically (lint, test, static analysis) \
and how

Format the output as a YAML document with a top-level \`evals:\` list.`;
}
