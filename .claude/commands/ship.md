# Ship: Commit and Push

Stage all changes, generate a descriptive commit message, and push to the remote.

## Workflow

1. Run `git status` (never use `-uall`) and `git diff --staged` and `git diff` to understand all pending changes (staged, unstaged, and untracked).

2. If there are no changes at all (no untracked files, no modifications), tell the user "Nothing to ship — working tree is clean." and stop.

3. Run `git log --oneline -5` to see the recent commit style for this repo.

4. Stage all relevant files. Prefer `git add` with specific file paths rather than `git add -A`. Never stage files that likely contain secrets (`.env`, `credentials.json`, `*.pem`, `*.key`). If such files exist, warn the user and exclude them.

5. Draft a commit message:
   - First line: imperative mood, under 72 characters, summarizing the "why" not the "what".
   - If multiple logical changes exist, add a blank line then bullet points for each change.
   - End with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

6. Present the proposed commit message to the user and ask for approval before committing. Use the commit message in a HEREDOC format:
   ```
   git commit -m "$(cat <<'EOF'
   <message here>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

7. After a successful commit, push to the remote:
   ```
   git push origin <current-branch>
   ```
   Use the `-u` flag if the branch has no upstream set. Do NOT reset the remote URL — it is already configured correctly.

8. Report the result: commit hash, branch name, and remote URL.

## Error Handling

- If `git push` fails due to auth issues, run `gh auth setup-git` then retry the push. Do NOT change the remote URL.
- If `gh auth setup-git` also fails, tell the user to run `gh auth login` and retry.
- If `git push` fails due to diverged branches, ask the user how they want to resolve (pull + rebase, force push, etc.). Never force push without explicit confirmation.
- If a pre-commit hook fails, do NOT amend. Fix the issue, re-stage, and create a new commit.