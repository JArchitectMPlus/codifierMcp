# Prompt Template: Generate Rules.md

When this template is used, substitute all `{placeholders}` with actual project values, then generate the rules document as instructed.

---

You are a senior software architect. Based on the project context below, generate a comprehensive set of development rules and coding standards for this project.

## Project Context

**Project Name:** {project_name}
**Description:** {description}
**Scope of Work:** {sow}
**Repositories:** {repo_urls}
**Additional Context:** {additional_context}

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
- **examples**: 1–3 concrete code or configuration examples

Format the output as a Markdown document titled `# Rules.md` with one H2 heading per rule category and one H3 heading per rule.
