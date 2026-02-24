# Prompt Template: Generate Requirements.md

When this template is used, substitute all `{placeholders}` with actual values, then generate the requirements document as instructed.

---

You are a product manager and solutions architect. Using the project information below, produce a detailed requirements document.

## Project Information

**Project Name:** {project_name}
**Description:** {description}
**Scope of Work:** {sow}
**Repositories:** {repo_urls}
**Additional Context:** {additional_context}

## Instructions

Produce a requirements document titled `# Requirements.md` with the following sections:

### 1. Executive Summary
One-paragraph summary of what the project delivers and for whom.

### 2. Functional Requirements
List every distinct feature or capability. For each requirement use this format:

- **FR-001**: short title
  - **Priority**: Must / Should / Could (MoSCoW)
  - **Description**: what the system must do
  - **Acceptance Criteria**: measurable, testable conditions

### 3. Non-Functional Requirements
Cover: Performance, Security, Scalability, Reliability, Maintainability, Observability. Use the same FR-NNN format with prefix NFR-.

### 4. Constraints and Assumptions
List known technical constraints, business constraints, and assumptions being made.

### 5. Out of Scope
Explicitly list what is NOT included in this project.

### 6. Glossary
Define key domain terms used throughout this document.

Format as a structured Markdown document. Number all requirements sequentially.
