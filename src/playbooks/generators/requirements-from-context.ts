/**
 * Generator: requirements-from-context
 *
 * Produces a prompt that instructs the client LLM to generate a detailed
 * requirements document from project description and scope of work.
 */

export function requirementsFromContextPrompt(context: Record<string, unknown>): string {
  return `You are a product manager and solutions architect. Using the project information below, \
produce a detailed requirements document.

## Project Information

Project Name: ${context['project_name'] ?? '(not provided)'}
Description: ${context['description'] ?? '(not provided)'}
Scope of Work: ${context['sow'] ?? '(not provided)'}
Repositories: ${JSON.stringify(context['repo_urls'] ?? context['repos'] ?? [], null, 2)}
Additional Context: ${JSON.stringify(context['additional_context'] ?? context['context'] ?? {}, null, 2)}

## Instructions

Produce a requirements document with the following sections:

### 1. Executive Summary
One-paragraph summary of what the project delivers and for whom.

### 2. Functional Requirements
List every distinct feature or capability. For each requirement:
- **FR-NNN**: short title
- **Priority**: Must / Should / Could (MoSCoW)
- **Description**: what the system must do
- **Acceptance Criteria**: measurable, testable conditions

### 3. Non-Functional Requirements
Cover: Performance, Security, Scalability, Reliability, Maintainability, Observability.

### 4. Constraints and Assumptions
List known technical constraints, business constraints, and assumptions being made.

### 5. Out of Scope
Explicitly list what is NOT included in this project.

### 6. Glossary
Define key domain terms used throughout this document.

Format the output as a structured Markdown document.`;
}
