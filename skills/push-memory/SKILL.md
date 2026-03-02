# Skill: Push Memory

**Role:** Any (cross-functional)
**Purpose:** Sync local session learnings from `docs/MEMORY.md` to the shared Codifier knowledge base via `update_memory`. Supports idempotent re-sync via per-entry `[kb:<uuid>]` annotations — entries already pushed are skipped automatically.

See `../shared/codifier-tools.md` for full MCP tool reference.

---

## Prerequisites

- Active MCP connection to the Codifier server
- A `docs/MEMORY.md` file with at least one entry (run `/remember` to capture learnings if this file does not exist)
- A project in the Codifier KB (confirmed in Step 1)

---

## Workflow

Follow these steps in order. You are the state machine — call MCP tools only for data operations.

### Step 1 — Confirm Project

Read `docs/MEMORY.md`. Check this location first, then `.codifier/docs/MEMORY.md`.

Inspect the file header for a `project_id` field. The header follows this format:

```
# Session Memory

_Project:_ <project_name>
_Project ID:_ <uuid>
_Last updated:_ <date>
```

- If a `project_id` is present in the header: use it for all subsequent MCP calls. Inform the user which project will be used.
- If no `project_id` is in the header: call `manage_projects` with `operation: "list"` and present the results to the user. Ask: **"Which project should these learnings be pushed to?"** If they need a new project, call `manage_projects` with `operation: "create"`. Store the resolved `project_id`.

### Step 2 — Identify Unsynced Entries

Parse `docs/MEMORY.md` and collect all bullet-point entries across all category sections.

Entries follow one of two formats:

- **Synced** (already in the KB): `- [kb:<uuid>] The learning text`
- **Unsynced** (local-only): `- The learning text`

Classify every entry. Entries with a `[kb:<uuid>]` prefix are already synced — do not push them again.

If all entries are already synced, inform the user:

> "All entries in docs/MEMORY.md are already synced to the shared KB. Nothing to push."

Then exit — do not proceed further.

### Step 3 — Preview and Confirm

Show the user all unsynced entries grouped by category. Use this format:

```
Unsynced entries to push:

## <category>
- <entry text>
- <entry text>

## <category>
- <entry text>

Push these N entries to the shared KB? [confirm]
```

Wait for the user to confirm before proceeding. If they decline or ask to skip specific entries, respect their choice and adjust the push set accordingly.

### Step 4 — Push Each Entry

For each confirmed unsynced entry, call `update_memory` with:

```json
{
  "project_id": "<from Step 1>",
  "memory_type": "learning",
  "title": "<category>: <first ~60 chars of bullet text>",
  "content": {
    "text": "<full bullet text>",
    "category": "<category>"
  },
  "tags": ["session-context", "<category>"],
  "description": "<full bullet text>"
}
```

Where `<category>` is the section heading under which the entry appears in `docs/MEMORY.md` (e.g., `gotcha`, `convention`, `decision`).

After each successful `update_memory` call:

1. Take the `id` returned in the response.
2. Immediately rewrite that entry in `docs/MEMORY.md` to prepend the `[kb:<uuid>]` annotation:

   Before: `- The actual learning text`
   After:  `- [kb:a1b2c3d4-e5f6-7890-abcd-ef1234567890] The actual learning text`

This makes the push resumable. If the process fails partway through, already-pushed entries are marked and will be skipped on the next run.

Push entries one at a time. Do not batch. Write the annotation back to the file after each individual success before moving to the next entry.

### Step 5 — Update Header and Summarize

Update the `_Last updated:_ <date>` line in the `docs/MEMORY.md` header to today's date.

Report the final summary to the user:

- How many entries were pushed successfully
- How many entries were skipped (already synced or user-excluded)
- How many entries failed (if any)
- The project they were pushed to (name and ID)

Then tell the user:

> "These learnings are now available to your team via fetch_context with tags: ['session-context']"

> "Any new learnings captured via /remember will appear without a [kb:...] prefix and can be pushed next time."

---

## Error Handling

- **`update_memory` fails for a specific entry**: Log the error, skip that entry, and continue with the remaining entries. Report all failures in the Step 5 summary. Do not write a `[kb:...]` annotation for failed entries — they will be retried on the next push.
- **`docs/MEMORY.md` does not exist**: Inform the user: "No local memory file found. Run `/remember` to capture session learnings first, or `npx @codifier/cli init` to set up your project."
- **MCP connection not available**: Inform the user: "Push requires an active MCP connection to the Codifier server. Verify your MCP config and try again."
- **File write fails after successful `update_memory`**: Inform the user of the annotation that could not be written (entry text + returned UUID) so they can manually add it. The KB push itself succeeded — only the local annotation is missing.
