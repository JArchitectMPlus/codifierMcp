---
name: code-review
description: Perform rigorous code reviews focused on correctness, security, performance, maintainability, and test coverage. Use when asked to review code, PRs, commits, diffs, or implementation plans; identify bugs, regressions, risky assumptions, and missing tests; and produce severity-ranked findings with concrete file references.
---

# Code Review

Review changes by prioritizing defects and risk over style.

## Review Workflow

1. Define review scope:
- Confirm what to review (diff, PR, branch, file set, or plan).
- Gather baseline context: feature intent, constraints, and expected behavior.

2. Analyze for high-impact issues first:
- Validate logic correctness and edge cases.
- Check security boundaries, authz/authn, input validation, and secrets handling.
- Inspect data integrity and state transitions (transactions, idempotency, race conditions).
- Evaluate failure handling and observability (errors, retries, logs, metrics).

3. Analyze quality and operability:
- Evaluate performance risks (N+1, unbounded loops, expensive allocations/queries).
- Assess API/contract compatibility and migration safety.
- Verify maintainability (cohesion, coupling, dead code, naming clarity).

4. Validate test strategy:
- Confirm critical paths and regressions are covered.
- Flag missing tests for edge cases and failure paths.
- Ensure tests assert behavior, not implementation details.

5. Report findings with severity ordering:
- Start with `Critical`, then `High`, `Medium`, `Low`.
- For each finding include: impact, evidence, and recommended fix.
- Provide exact file references with line numbers when available.

## Output Format

Use this structure for review results:

```markdown
## Findings
1. [Severity: High] Short title
- File: `path/to/file.ts:42`
- Why it matters: ...
- Evidence: ...
- Suggested fix: ...

## Open Questions
1. ...

## Residual Risk
- ...
```

If no issues are found, state that explicitly and list residual risks or testing gaps.

## Resource Usage

- Use `references/review-checklist.md` as the primary checklist during analysis.
