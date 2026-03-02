# Skill: Capture Session

**Role:** Any
**Purpose:** Capture session learnings — gotchas, conventions, insights, what-to-do, what-not-to-do — into the local `docs/MEMORY.md` file for later review and optional KB sync.

See `../shared/codifier-tools.md` for full MCP tool reference.

---

## Prerequisites

- A `docs/MEMORY.md` file (created by `npx codifier init`; if missing, this skill will create it with a placeholder header)
- Optionally an active MCP connection (only needed if the user wants to confirm the `project_id`)

---

## When to Use / When NOT to Use

**Use this skill when:**
- You've learned something during a session worth remembering — a debugging insight, an API behavior, a convention, a gotcha, or a team decision
- You are at the end of any Codifier workflow and want to capture what you learned along the way

**Do NOT use this skill when:**
- You want to persist structured project artifacts such as rules, requirements, or architecture docs — use `/codify`, `/onboard`, or `/research` instead
- You want to push memories to the shared KB for the team to access — use `/push-memory` instead

---

## Workflow

Follow these steps conversationally. You are the state machine — write to the local file only; do not call `update_memory` during this skill.

### Step 1 — Confirm Project Context

Read `docs/MEMORY.md`.

- If the file **exists**: extract the project name and ID from the header and present them to the user for confirmation.
- If the file **does not exist**: create it with the following placeholder header, substituting today's date for `<today's date>`:

```markdown
# Project Memory
_Last updated: <today's date>_

```

Ask the user: **"What project are these learnings for?"** to confirm or set the project context. Update the header with the confirmed project name if it is not already present.

### Step 2 — Elicit Learnings

Ask the user:

**"What did you learn during this session? Think about: gotchas, surprises, conventions you discovered, things to do or avoid, insights about the codebase or tools."**

Let the user respond in any format — bullet points, paragraphs, or freeform prose. Collect everything before structuring. Do not interrupt to ask for clarification mid-response; wait until the user has finished providing input.

### Step 3 — Structure and Dedup

For each learning the user provided:

1. Assign a category from the following list, or ask the user if the right category is unclear:
   - `architecture` — structural decisions, component relationships, design patterns
   - `gotcha` — surprising behaviors, footguns, things that went wrong
   - `convention` — naming, formatting, file organisation, team norms
   - `tooling` — build tools, CLIs, libraries, dev environment
   - `data` — schema details, query behaviors, data quirks
   - `process` — workflow, review conventions, deployment steps
2. Distill the learning into a concise, actionable bullet point (one line)
3. Check for exact string matches against existing bullet points already in `docs/MEMORY.md` — skip any entry whose text is identical to an existing entry

Present the structured candidates to the user grouped by category. For example:

```
**gotcha**
- Supabase RLS blocks inserts when no matching policy exists; always test with service role key first

**convention**
- Use kebab-case for all slug fields; snake_case is reserved for database column names
```

Ask: **"Here are the learnings I've structured. Any to add, remove, or recategorize?"**

Incorporate the user's feedback before proceeding.

### Step 4 — Append to Local File

Append the confirmed learnings to `docs/MEMORY.md`:

- For each category with new entries, find the matching `## <Category>` heading in the file.
  - If the heading already exists: append new bullet points beneath it.
  - If the heading does not exist yet: create it at the end of the file.
- Update the `_Last updated_` date in the header to today's date.

Do NOT call `update_memory`. This step writes only to the local `docs/MEMORY.md` file.

### Step 5 — Next Steps

Inform the user:

- "Learnings saved to docs/MEMORY.md"
- "You can edit the file directly to refine, recategorize, or remove entries"
- "When ready to share with your team, run /push-memory to sync to the shared KB"

---

## Error Handling

- If `docs/MEMORY.md` **cannot be written** (e.g., permission error): present the full structured learnings as a fenced Markdown code block the user can copy-paste into the file manually.
- If the user **provides no learnings**: ask 2–3 targeted questions to help surface implicit learnings. Example prompts:
  - "What was the hardest part of what you worked on today?"
  - "Did anything behave differently than you expected?"
  - "Is there anything you'd tell a teammate before they touched this area of the code?"
