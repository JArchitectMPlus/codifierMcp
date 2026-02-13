---
name: create-implementation-plan
description: Create a lean, checklist-based implementation plan document from a feature outline or plan outline
argument-hint: "[feature-name] [source-file]"
---

# Create Implementation Plan

Generate a concise, checklist-driven implementation plan document for a feature.

## Inputs

- **feature-name** (required): Short name for the feature (used in filename: `<FeatureName>ImplementationPlan.md`)
- **source-file** (optional): Path to a plan outline, PRD, or feature description to use as input context

## Steps

1. **Gather context**:
   - If a source file is provided, read it to understand the feature scope and requirements
   - If no source file is provided, ask the user what feature they want to plan
   - Explore the codebase to understand current architecture, key interfaces, existing patterns, and relevant files

2. **Identify changes**:
   - List every file that needs to be modified or created
   - Determine the natural phases/groupings of work
   - Note key technical decisions and trade-offs

3. **Generate the plan document** with this structure:

   ```markdown
   # <Feature Name> — Implementation Plan

   ## Context
   <!-- 2-3 sentences: what this feature does and why -->

   ## Key Technical Decisions
   <!-- Bulleted list of important choices made and their rationale -->

   ## Phase N: <Phase Title>
   <!-- Repeat for each phase -->

   - [ ] `path/to/file` — Description of change
   - [ ] `path/to/new-file` *(new)* — Description of new file
   ...

   ## Files Summary

   | Action | File |
   |--------|------|
   | Modify | `existing/file.ts` |
   | Create | `new/file.ts` |

   ## Verification Checklist

   - [ ] All modified files compile (`npm run build`)
   - [ ] <feature-specific verification items>
   ```

4. **Write the file** to `<FeatureName>ImplementationPlan.md` at the project root

## Guidelines

- Keep it concise — checklists over prose
- Every checklist item must reference a specific file path
- Mark new files with *(new)* to distinguish from modifications
- Group work into logical phases that can be implemented and verified independently
- Include a verification checklist at the end with concrete checks
- Do not include code snippets — the plan is a roadmap, not a tutorial
