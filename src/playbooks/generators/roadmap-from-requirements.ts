/**
 * Generator: roadmap-from-requirements
 *
 * Produces a prompt that instructs the client LLM to generate a phased
 * implementation roadmap from an existing requirements document.
 */

export function roadmapFromRequirementsPrompt(context: Record<string, unknown>): string {
  return `You are a senior engineering lead responsible for delivery planning. Using the project \
requirements below, produce a phased implementation roadmap.

## Requirements

${JSON.stringify(context['requirements'] ?? context['generated_requirements'] ?? '(no requirements provided)', null, 2)}

## Project Context

Project Name: ${context['project_name'] ?? '(not provided)'}
Description: ${context['description'] ?? '(not provided)'}
Repositories: ${JSON.stringify(context['repo_urls'] ?? context['repos'] ?? [], null, 2)}

## Instructions

Produce a roadmap structured as 3–5 phases. For EACH phase include:

- **Phase N — Name**: meaningful phase title (e.g., "Phase 1 — Foundation")
- **Goal**: one-sentence summary of what this phase achieves
- **Duration estimate**: calendar weeks or sprints
- **Deliverables**: concrete, shippable outputs
- **Functional Requirements covered**: list the FR-NNN IDs addressed in this phase
- **Technical tasks**: breakdown of engineering work (use a checklist format)
- **Dependencies**: what must be true before this phase can start
- **Success criteria**: how to know this phase is done

After the phased plan, include:
- **Critical Path**: the sequence of tasks where any delay directly delays the project
- **Risks and Mitigations**: top 5 risks with likelihood, impact, and mitigation strategy

Format the output as a Markdown document.`;
}
