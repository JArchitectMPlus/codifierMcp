# Review Checklist

## Correctness
- Verify changed logic against expected behavior.
- Check null/empty/error-path handling.
- Check boundary conditions and off-by-one behavior.

## Security
- Validate authorization and access checks.
- Validate input sanitization and output encoding.
- Ensure no hardcoded secrets or token leakage.

## Data and State
- Verify transaction boundaries and rollback behavior.
- Check idempotency for retries and duplicated requests.
- Check concurrency safety for shared state.

## Performance
- Look for repeated queries (N+1), full scans, and unbounded loops.
- Check expensive synchronous operations on critical paths.
- Validate caching invalidation assumptions.

## Reliability and Observability
- Ensure errors are surfaced with actionable context.
- Check retry/backoff/circuit-breaker behavior where applicable.
- Confirm meaningful logs and metrics for new failure modes.

## API and Compatibility
- Check backward compatibility of contracts and schemas.
- Validate migrations and rollout order for deploy safety.
- Flag breaking changes without versioning/coordination.

## Tests
- Verify happy-path and failure-path coverage.
- Verify edge cases and regression tests for bug-prone areas.
- Confirm tests assert user-visible behavior.
