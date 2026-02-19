# Codifier v2.0 Implementation Rules

These rules define the implementation guardrails that all developers must follow when building and modifying this system. Each rule is authoritative. Deviations require explicit architectural approval and must be documented in `docs/evals.md`.

---

## 1. Architecture

**1.1 Glue-Layer Principle.** This server is a coordination and retrieval layer — do not reimplement functionality that is already solved by Supabase, RepoMix, Athena, or the MCP SDK. Wrap and orchestrate; do not rebuild.

**1.2 IDataStore Abstraction.** All data access must go through the `IDataStore` interface. No component outside of a concrete `DataStore` implementation class may import or reference a Supabase client, Confluence client, or any storage SDK directly.

**1.3 Factory Pattern for Storage.** Storage backend selection must be controlled exclusively by the `createDataStore()` factory function using the `DATA_STORE` environment variable. Callers must never instantiate a data store class directly.

**1.4 Separation of Concerns.** Tool handlers are responsible for input validation and response shaping only. Business logic belongs in dedicated service modules, and all persistence belongs in data store implementations.

**1.5 No Server-Side LLM Calls.** The server must never invoke an LLM directly. All tools must return structured prompt context and retrieved data to the client, which is responsible for LLM generation. This is a non-negotiable architectural boundary.

**1.6 Stateless Request Handling.** Each incoming MCP tool call must be handled as a stateless request. All state required to process a request must be fetched from the database within that request's lifecycle.

---

## 2. API and Tool Design

**2.1 Tool Naming Convention.** All MCP tool names must use `snake_case` and follow a `verb_noun` pattern (e.g., `fetch_context`, `run_playbook`, `manage_projects`). Names must be stable across versions; breaking renames require a major version increment.

**2.2 Zod Validation on All Tool Inputs.** Every MCP tool handler must define a Zod schema for its input and validate against it before any processing begins. Validation failures must return a structured error immediately without executing any business logic.

**2.3 Uniform Error Response Format.** All error responses must include a `code` (machine-readable string), a `message` (human-readable description), and optionally a `details` field. Never return raw exception messages or stack traces to the client.

**2.4 Idempotency for Write Operations.** Tools that create or update records (`update_memory`, `manage_projects`) must be safe to retry. Implementations must use upsert semantics or explicit idempotency keys to prevent duplicate records from repeated calls.

**2.5 No Implicit Defaults for Required Fields.** Tool handlers must not silently substitute default values for required input fields. If a required field is missing, return a validation error.

---

## 3. Data and Security

**3.1 project_id Scoping on All Queries.** Every database query that reads or writes memory, repository, or session records must include a `project_id` filter. Queries without project scoping are forbidden, regardless of the calling context.

**3.2 Row-Level Security Enforcement.** All Supabase queries must be executed using a client that respects Row-Level Security policies. Service role clients that bypass RLS must never be used in request-handling code paths.

**3.3 API Key Validation on Every Request.** The API key authentication middleware must run on every inbound HTTP request before any tool handler is invoked. There must be no routes or tool endpoints that bypass this middleware.

**3.4 No Raw SQL in Application Code.** All database interactions must use the Supabase client's query builder or RPC interface. Raw SQL strings embedded in application TypeScript are forbidden.

**3.5 SQL Injection Prevention for Athena Queries.** All parameters passed to AWS Athena queries must be sanitized and bound via parameterized query patterns. User-supplied strings must never be interpolated directly into Athena query strings.

**3.6 No Secrets in Application Code or Version Control.** API keys, database URLs, tokens, and all credentials must be sourced exclusively from environment variables. Hardcoded secret values in any TypeScript, YAML, or configuration file are strictly prohibited.

---

## 4. Playbook Engine

**4.1 YAML-Only Playbook Definitions.** All playbooks must be defined as YAML files. Playbook logic must not be encoded in TypeScript outside of the `PlaybookRunner` engine itself. Embedding step logic or sequences in tool handlers is forbidden.

**4.2 Linear State Machine for MVP.** The `PlaybookRunner` must implement only a linear step progression for v2.0. Branching, conditional jumps, and parallel step execution are deferred to v2.1 and must not be introduced without a formal architectural revision.

**4.3 Session State Persisted in Database Only.** All playbook session state — including current step index, step outputs, and completion status — must be stored in the database. In-memory session state that is not persisted is forbidden.

**4.4 skip_if_empty Behavior Must Be Explicit.** Every playbook step that may skip based on empty input must declare an explicit `skip_if_empty` field in its YAML definition. The `PlaybookRunner` must not apply implicit skip logic.

**4.5 Step Outputs Must Be Typed.** Each playbook step definition must declare the expected output shape. The `PlaybookRunner` must validate step outputs before persisting session state or advancing to the next step.

---

## 5. Integrations

**5.1 Direct Invocation Pattern.** All integrations with RepoMix and AWS Athena MCP must use direct invocation. A `SkillManager` or any equivalent dynamic dispatch abstraction is explicitly out of scope until v2.1.

**5.2 Environment Variable Token Pattern.** Authentication tokens for all external services must be read from named environment variables at application startup. Variable names must be documented in `.env.example`.

**5.3 Integration Errors Must Surface to Client.** When a third-party integration call fails, the error must propagate to the MCP tool response as a structured error (per rule 2.3) with enough context to identify the failure source. Errors must not be silently swallowed.

**5.4 No Integration Logic in Tool Handlers.** Code that constructs requests to and processes responses from external services must live in dedicated integration modules, not inline within MCP tool handler functions.

---

## 6. TypeScript Standards

**6.1 Strict Mode Required.** TypeScript must be configured with `strict: true` in `tsconfig.json`. This setting must not be disabled or overridden at the file or project level.

**6.2 ESM Modules Only.** The project uses ECMAScript Modules with `"type": "module"` in `package.json`. CommonJS `require()` calls must not be introduced. All imports must use explicit `.js` extensions as required by ESM resolution.

**6.3 Zod for All External Input.** Any data crossing a trust boundary — tool inputs, environment variables, database row shapes, and external API responses — must be validated using a Zod schema before use.

**6.4 No `any` Type.** The use of `any` in TypeScript source files is forbidden. Use `unknown` for truly unknown shapes and narrow explicitly. `as any` casts are equally prohibited.

**6.5 Explicit Return Types on Public Functions.** All exported functions and class methods must declare an explicit return type.

---

## 7. Testing and Observability

**7.1 Unit Tests for All Tool Handlers.** Every MCP tool handler must have a corresponding unit test covering the happy path, at least one validation failure case, and at least one downstream error case. Tests must mock data store and integration dependencies.

**7.2 Structured JSON Logging.** All application log output must be emitted as newline-delimited JSON. Plain-text log statements are not permitted in production code paths. Every log entry must include `level`, `timestamp`, `module`, and `message`.

**7.3 Machine-Readable Error Codes.** Every client-facing error condition must have a unique, documented string error code (e.g., `PROJECT_NOT_FOUND`, `PLAYBOOK_STEP_INVALID`). Error codes must not be changed once published.

**7.4 No Silent Error Handling.** Catch blocks must either re-throw, return a structured error response, or log at `error` level before continuing. Empty catch blocks are forbidden.

---

## 8. Deployment

**8.1 Fly.io Secrets for All Credentials.** All secrets used in production must be set via `fly secrets set`. They must never be committed to version control or included in Dockerfile `ENV` instructions.

**8.2 Dockerfile Hygiene.** The production Dockerfile must use a multi-stage build to exclude development dependencies and TypeScript source files from the final image. The final image contains only compiled `dist/` output and production `node_modules`.

**8.3 Environment Parity.** The set of environment variables required to run the application must be identical across local development and production. Every variable must be documented in `.env.example`.

**8.4 Health Check Endpoint Required.** The HTTP server must expose a `/health` endpoint that returns `200 OK` with no authentication requirement, suitable for Fly.io health check configuration.

**8.5 Suspend-on-Idle Configuration.** The Fly.io deployment must be configured with `auto_stop_machines = true` and `min_machines_running = 0`. Handlers must be stateless and tolerate cold starts (see rule 1.6).