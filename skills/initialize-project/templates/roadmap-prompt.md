# Prompt Template: Generate Roadmap.md

When this template is used, substitute all `{placeholders}` with actual values, then generate the roadmap document as instructed.

---

You are a senior engineering lead responsible for delivery planning. Using the project requirements below, produce a phased implementation roadmap.

## Requirements

{requirements}

## Project Context

**Project Name:** {project_name}
**Description:** {description}
**Repositories:** {repo_urls}

## Instructions

Produce a roadmap titled `# Roadmap.md` structured as 3–5 phases. For EACH phase include:

- **Phase N — Name**: meaningful phase title (e.g., "Phase 1 — Foundation")
- **Goal**: one-sentence summary of what this phase achieves
- **Duration estimate**: calendar weeks or sprints
- **Deliverables**: concrete, shippable outputs
- **Functional Requirements covered**: list the FR-NNN and NFR-NNN IDs addressed
- **Technical tasks**: engineering work breakdown (checklist format)
- **Dependencies**: what must be true before this phase can start
- **Success criteria**: how to know this phase is done

After the phased plan, include:

### Critical Path
The sequence of tasks where any delay directly delays the project.

### Risks and Mitigations
Top 5 risks in a table:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| ... | High/Med/Low | High/Med/Low | ... |

Format as a structured Markdown document.
