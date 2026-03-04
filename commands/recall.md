---
description: Surface local and shared team learnings
---

# Recall — Surface Local and Shared Learnings

Follow these steps:

## Step 1 — Read Local Memory

Attempt to read `docs/MEMORY.md`. Check this location first, then `.codifier/docs/MEMORY.md`.

If the file exists, summarize its contents grouped by category under the heading **"Your Local Learnings"**. Include all entries regardless of sync status — entries with `[kb:...]` prefixes are synced to the shared KB; those without are local-only. Make the sync status visible: show a note next to each category indicating how many entries are synced vs. local-only.

If the file does not exist, inform the user: "No local memory file found. Run `/remember` to capture session learnings, or `npx @codifier/cli init` to set up your project."

## Step 2 — Offer Shared KB Recall

Ask the user: **"What are you working on right now?"**

Use their answer to call `fetch_context` with:

```json
{
  "project_id": "<from MEMORY.md header, or ask the user if not present>",
  "memory_type": "learning",
  "tags": ["session-context"],
  "query": "<user's current task description>",
  "limit": 10
}
```

If no `project_id` is available from the file header, ask the user to provide it or call `manage_projects` with `operation: "list"` to help them identify it.

Present KB results under a separate heading **"Shared Team Learnings"** — distinct and clearly separated from the local section. Never merge or deduplicate local and KB results — they are different sources and must remain visually distinct.

If the user declines to answer the question or states they only want local results, skip the `fetch_context` call and omit the "Shared Team Learnings" section entirely.

## Step 3 — Summary

Tell the user:

- How many local learnings were found in total (and how many are unsynced, i.e., missing a `[kb:...]` prefix)
- How many shared team learnings were retrieved from the KB (if the call was made)
- "Run /remember to capture new learnings, or /push-memory to sync local learnings to the shared KB"
