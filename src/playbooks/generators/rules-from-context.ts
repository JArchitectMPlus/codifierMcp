/**
 * Generator: rules-from-context
 *
 * Produces a prompt that instructs the client LLM to generate coding rules
 * and standards from project context collected during a playbook session.
 */

export function rulesFromContextPrompt(context: Record<string, unknown>): string {
  return `You are a senior software architect. Based on the project context below, generate a \
comprehensive set of development rules and coding standards for this project.

## Project Context

Project Name: ${context['project_name'] ?? '(not provided)'}
Description: ${context['description'] ?? '(not provided)'}
Scope of Work: ${context['sow'] ?? '(not provided)'}
Repositories: ${JSON.stringify(context['repo_urls'] ?? context['repos'] ?? [], null, 2)}
Additional Context: ${JSON.stringify(context['additional_context'] ?? context['context'] ?? {}, null, 2)}

## Instructions

Generate rules covering ALL of the following areas:
1. **Code Style** — naming conventions, file organisation, formatting
2. **Architecture Patterns** — module structure, dependency direction, layering
3. **Security** — input validation, secrets management, authentication patterns
4. **Testing** — unit test structure, coverage targets, mocking strategy
5. **Documentation** — inline comments, ADR conventions, README standards
6. **Error Handling** — error propagation, logging strategy, user-facing messages

For EACH rule provide:
- **title**: short, actionable slug (e.g., "Always validate external input at the boundary")
- **description**: one-paragraph explanation
- **rationale**: why this rule matters for this specific project
- **examples**: 1-3 concrete code or configuration examples

Format the output as a Markdown document with one H2 heading per rule.`;
}
