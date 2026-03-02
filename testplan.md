# Codifier v2.0 — Test Plan

This document contains step-by-step instructions to verify every unchecked item from `docs/implementation-plan.md`. Tests are grouped by phase. Run them in order — earlier sections establish prerequisites that later sections depend on.

---

## Prerequisites

Before running any test, confirm the following are in place:

- Docker Desktop is running locally
- Node.js 20+ is installed (`node --version`)
- The repository is built: `npm run build` exits with code 0 from `/Users/jeff.akpunonu/dev/nodejs/codifierMcp`
- The Codifier MCP server is deployed at `https://codifier-mcp.fly.dev` and reachable
- You have a valid Codifier API key (used throughout as `$CODIFIER_API_KEY`)
- AWS credentials are available if running Athena tests: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ATHENA_S3_OUTPUT_LOCATION`
- Two test machines or user accounts are available for the persistence demo (Section 5)

---

## Section 0 — Accessing the Fly.io Deployed Environment

Some tests (particularly Docker smoke tests and server-side verification) need to be run from or against the deployed Fly.io environment. Use the following steps to connect.

### 0.1 Install the Fly CLI

If you don't already have the `flyctl` CLI installed:

```
curl -L https://fly.io/install.sh | sh
```

Or on macOS with Homebrew:

```
brew install flyctl
```

### 0.2 Authenticate with Fly.io

```
fly auth login
```

This opens a browser for OAuth login. After authenticating, verify access to the app:

```
fly status -a codifier-mcp
```

Expected: output showing the app name `codifier-mcp`, region `iad`, and at least one running machine.

### 0.3 Open a remote shell on the running machine

To get an interactive shell inside the deployed container:

```
fly ssh console -a codifier-mcp
```

This drops you into a shell in the `/app` directory of the running `node:20-alpine` container. From here you can run commands like `node -e "..."`, `python3 -c "..."`, inspect environment variables, and verify runtime dependencies.

### 0.4 View deployed environment variables (names only)

```
fly secrets list -a codifier-mcp
```

This lists the secret names (not values) configured on the app. Verify that `CODIFIER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and any AWS credentials are present.

### 0.5 View application logs

```
fly logs -a codifier-mcp
```

Use this to tail live logs during testing. Add `--region iad` to filter to the primary region.

### 0.6 Proxy a port for local testing against the deployed container

If you need to test the server locally without going through the public URL:

```
fly proxy 3000 -a codifier-mcp
```

This forwards `localhost:3000` to the deployed container's port 3000.

### 0.7 When to use the remote shell vs. local Docker

| Scenario | Use |
|---|---|
| Verifying production dependencies are installed (Section 1.2, 1.3) | `fly ssh console` or local `docker run` — both work |
| Testing against real AWS credentials / Supabase | `fly ssh console` (secrets are available in the environment) |
| Testing the SSE/health endpoints (Section 4.7) | `curl` from your local machine against `https://codifier-mcp.fly.dev` |
| Debugging startup failures or crashes | `fly logs` + `fly ssh console` |
| Running the CLI installer tests (Section 2) | Local machine only (tests the npm package, not the container) |

---

## Section 1 — Docker Smoke Tests

These tests verify that the Docker image contains all required runtime dependencies and that both integration sidecars start correctly inside the container. Run these tests against the image built locally before deploying.

### 1.1 Build the Docker image

1. From the repository root, run:
   ```
   docker build -t codifier-mcp-test .
   ```
2. Expected outcome: the build completes with exit code 0. Both build stages (builder and runner) should complete without errors. The final image should be present when you run `docker images | grep codifier-mcp-test`.

---

### 1.2 Phase 1d — RepoMix included via `npm ci` and `pack()` executes

This test verifies that `repomix` is installed in the production image (runner stage uses `npm ci --omit=dev`) and that the programmatic `pack()` API can execute a clone-and-pack operation against a known public repository.

**Step 1 — Verify `repomix` is in the production node_modules:**

1. Run:
   ```
   docker run --rm codifier-mcp-test node -e "import('repomix').then(m => console.log('repomix loaded:', typeof m.pack)).catch(e => { console.error(e.message); process.exit(1); })"
   ```
2. Expected output: a line beginning with `repomix loaded: function`. Any error or `process.exit(1)` means the package is missing from the production image.

**Step 2 — Verify `pack()` executes against a known public repo:**

1. Run the following one-shot container. It imports repomix and packs `https://github.com/modelcontextprotocol/servers` (a small, stable public repo):
   ```
   docker run --rm codifier-mcp-test node --input-type=module - <<'EOF'
   import { pack } from 'repomix';
   try {
     const result = await pack(['https://github.com/modelcontextprotocol/servers'], {
       output: { filePath: '/tmp/repomix-smoke.txt' },
     });
     console.log('pack() succeeded. Token count:', result?.totalTokens ?? 'n/a');
     process.exit(0);
   } catch (e) {
     console.error('pack() failed:', e.message);
     process.exit(1);
   }
   EOF
   ```
2. Expected outcome: exit code 0 and a line such as `pack() succeeded. Token count: <number>`. Any non-zero exit code or stack trace is a failure.

Note: if the repo is large, pack may take up to 60 seconds. If the container needs network access behind a proxy, pass `--network=host` or appropriate proxy environment variables.

---

### 1.3 Phase 1e — `python -m athena_mcp.server` starts and responds to `list_tables`

This test verifies that the `aws-athena-mcp` Python package was installed correctly in the runner stage and that the MCP server process starts and handles an MCP `tools/call` request for `list_tables` over stdio.

**Step 1 — Verify Python and aws-athena-mcp are installed:**

1. Run:
   ```
   docker run --rm codifier-mcp-test python3 -c "import athena_mcp; print('athena_mcp imported successfully')"
   ```
2. Expected output: `athena_mcp imported successfully`. A `ModuleNotFoundError` means the pip install in the Dockerfile did not succeed.

**Step 2 — Verify the server process starts:**

1. Run:
   ```
   docker run --rm codifier-mcp-test timeout 5 python3 -m athena_mcp.server; echo "Exit: $?"
   ```
2. Expected outcome: the process starts (no `ModuleNotFoundError`, no Python import traceback). It will exit after 5 seconds because no stdio client connected — that is expected. A Python traceback on startup is a failure.

**Step 3 — Verify `list_tables` responds over stdio:**

The Codifier server spawns `python3 -m athena_mcp.server` as a sidecar and communicates over stdio using the MCP JSON-RPC protocol. To simulate this without real AWS credentials, send the MCP initialize handshake and a `tools/call` for `list_tables` and verify a JSON-RPC response is returned (even an error response from Athena itself confirms the server is running and handling the protocol).

1. Create a test input file locally:
   ```
   cat > /tmp/athena-smoke-input.jsonl <<'EOF'
   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}
   {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tables","arguments":{}}}
   EOF
   ```
2. Run:
   ```
   docker run --rm \
     -e AWS_REGION=us-east-1 \
     -e AWS_ACCESS_KEY_ID=test \
     -e AWS_SECRET_ACCESS_KEY=test \
     -e ATHENA_S3_OUTPUT_LOCATION=s3://test-bucket/output/ \
     -i codifier-mcp-test \
     sh -c "python3 -m athena_mcp.server" < /tmp/athena-smoke-input.jsonl | head -20
   ```
3. Expected outcome: one or more lines of JSON-RPC output appear. The `initialize` response should include `result.serverInfo`. The `list_tables` response will either return table names (with real credentials) or a JSON-RPC error object (with fake credentials). In both cases, the server is confirmed running and responding to MCP protocol messages. A blank output or Python traceback is a failure.

---

## Section 2 — CLI Installer Tests (`npx @codifier/cli init`)

These tests verify the one-time scaffolder works correctly on macOS in a Claude Code environment. Run from a fresh temporary directory to avoid affecting existing projects.

### Setup: create a clean test directory

```
mkdir /tmp/codifier-cli-test
cd /tmp/codifier-cli-test
mkdir .claude
```

The `.claude/` directory causes `detectEnvironment()` to identify this as a Claude Code project, which determines where commands and MCP config are written.

---

### 2.1 Phase 1j / Verification — `npx @codifier/cli init` completes without errors in under 30 seconds

1. From `/tmp/codifier-cli-test`, run and time the command:
   ```
   time npx @codifier/cli init
   ```
2. When prompted for the MCP server URL, enter: `https://codifier-mcp.fly.dev`
3. When prompted for the API key, enter your `$CODIFIER_API_KEY`
4. Expected outcome:
   - The command completes with exit code 0
   - Wall-clock time is under 30 seconds
   - Console output contains all of the following success lines (no errors or unhandled exceptions):
     ```
     Codifier Init — detected client: claude-code
     ✓ Skills copied to .codifier/skills/
     ✓ Commands copied to /tmp/codifier-cli-test/.claude/commands
     ✓ Config saved to .codifier/config.json
     ✓ Created docs/ for local artifact storage
     ✓ MCP config written to /tmp/codifier-cli-test/.mcp.json
     ✓ MCP server reachable
     ✅ Codifier installed successfully!
     ```
   - If the server is unreachable, the warning line is acceptable but the command must still exit 0 (connectivity is best-effort)

---

### 2.2 Verification — `.codifier/skills/` contains all 3 Skill directories with SKILL.md files

After `npx @codifier/cli init` completes from Section 2.1:

1. Run:
   ```
   ls /tmp/codifier-cli-test/.codifier/skills/
   ```
2. Expected output includes: `initialize-project`, `brownfield-onboard`, `research-analyze`, `shared`

3. Run:
   ```
   ls /tmp/codifier-cli-test/.codifier/skills/initialize-project/
   ls /tmp/codifier-cli-test/.codifier/skills/brownfield-onboard/
   ls /tmp/codifier-cli-test/.codifier/skills/research-analyze/
   ls /tmp/codifier-cli-test/.codifier/skills/shared/
   ```
4. Expected outcome: each Skill directory (`initialize-project`, `brownfield-onboard`, `research-analyze`) contains `SKILL.md`. `initialize-project` additionally contains a `templates/` subdirectory with `rules-prompt.md`, `evals-prompt.md`, `requirements-prompt.md`, and `roadmap-prompt.md`. `research-analyze` contains a `templates/` subdirectory with `query-generation-prompt.md` and `synthesis-prompt.md`. `shared/` contains `codifier-tools.md` (a reference document, not a Skill).

5. Verify no file is empty:
   ```
   find /tmp/codifier-cli-test/.codifier/skills -name "*.md" | xargs wc -l
   ```
   Expected outcome: every `.md` file has more than 0 lines.

6. Verify `docs/` directory was created:
   ```
   ls -d /tmp/codifier-cli-test/docs/
   ```
   Expected outcome: the directory exists (created by `init` for local artifact storage).

---

### 2.3 Verification — `.claude/commands/` contains the 3 slash command files

1. Run:
   ```
   ls /tmp/codifier-cli-test/.claude/commands/
   ```
2. Expected output: `codify.md`, `onboard.md`, `research.md` are all present.

3. Verify each file is non-empty and references the correct Skill path:
   ```
   grep -l "SKILL.md" /tmp/codifier-cli-test/.claude/commands/*.md
   ```
   Expected outcome: all 3 files are returned (each command file references its corresponding SKILL.md).

---

### 2.4 Verification — `.mcp.json` was written with the correct structure

1. Run:
   ```
   cat /tmp/codifier-cli-test/.mcp.json
   ```
2. Expected outcome: valid JSON with the structure:
   ```json
   {
     "mcpServers": {
       "codifier": {
         "url": "https://codifier-mcp.fly.dev/sse",
         "headers": {
           "Authorization": "Bearer <your-api-key>"
         }
       }
     }
   }
   ```
   Verify that the `url` field ends in `/sse` (not bare `/`), and that the `Authorization` header value starts with `Bearer `.

---

## Section 3 — Tool Registration Verification

These tests confirm that the MCP server exposes exactly 5 tools and that the removed tools (`run_playbook`, `advance_step`) are absent.

### 3.1 Verify tool count and names via the SSE endpoint

This test sends an MCP `tools/list` request to the live remote server and inspects the response.

1. Run:
   ```
   curl -s -N \
     -H "Authorization: Bearer $CODIFIER_API_KEY" \
     -H "Accept: text/event-stream" \
     "https://codifier-mcp.fly.dev/sse" &
   SSE_PID=$!
   sleep 2
   kill $SSE_PID
   ```
   Note: MCP tool listing over SSE requires an MCP client. Use the alternative below if you do not have an SSE MCP client available.

2. Alternative — inspect via the health endpoint and source code audit:
   ```
   curl -s https://codifier-mcp.fly.dev/health
   ```
   Expected: `{"status":"ok"}` or similar.

3. Source code audit (always run this):
   ```
   grep -n "case '" /Users/jeff.akpunonu/dev/nodejs/codifierMcp/src/mcp/server.ts
   ```
   Expected output: exactly 5 `case` entries — `fetch_context`, `update_memory`, `manage_projects`, `pack_repo`, `query_data`. No `run_playbook` or `advance_step` lines.

4. Verify the `allTools` array in the compiled output:
   ```
   grep -c "Tool," /Users/jeff.akpunonu/dev/nodejs/codifierMcp/src/mcp/server.ts
   ```
   Expected: `5` (one entry per tool in `allTools`).

5. Confirm removed tools are absent from the entire `src/` tree:
   ```
   grep -r "run_playbook\|advance_step" /Users/jeff.akpunonu/dev/nodejs/codifierMcp/src/
   ```
   Expected outcome: no output. Any match is a failure.

---

### 3.2 Verify tool count via an MCP client connected to the remote server

If you have a local MCP client (e.g., Claude Code with Codifier configured via `.mcp.json`):

1. Open Claude Code in the test project created in Section 2.
2. In the chat, ask: "List all tools available from the Codifier MCP server."
3. Expected outcome: Claude responds with exactly 5 tool names — `fetch_context`, `update_memory`, `manage_projects`, `pack_repo`, `query_data`. No other Codifier tools should appear.

---

## Section 4 — End-to-End Demo Tests

These tests require a live Codifier MCP server, a valid API key, and an active Claude Code session connected to that server. Run them in a project where `npx @codifier/cli init` has already been completed (use the project from Section 2, or a real project).

For each demo, count the number of distinct MCP tool calls Claude makes and record them. The UX target is 5 or fewer calls for the Initialize Project flow.

---

### 4.1 Verification — `/codify` slash command triggers the Initialize Project Skill without invoking `run_playbook`

1. Open Claude Code in a project with Codifier installed.
2. Create or switch to a project context. If no project exists yet, you can let the Skill create one.
3. Type `/codify` in the chat.
4. Expected outcome:
   - Claude reads `.codifier/skills/initialize-project/SKILL.md` and begins the workflow conversationally — it asks for the project name, description, and Statement of Work (or equivalent context).
   - Claude does NOT call `run_playbook` or `advance_step` at any point. Watch the tool call panel or ask Claude afterward: "Which MCP tools did you call during this session?"
   - The flow proceeds without error messages and without Claude asking for clarification about missing tools.

---

### 4.2 Phase 1j — Developer demo: 4 artifacts generated and persisted in a single session

Continue from the `/codify` session in Section 4.1, or start a fresh one.

1. Provide the following inputs when Claude asks:
   - Project name: `codifier-demo`
   - Description: `A demo project for validating Codifier v2.0`
   - SOW or context: paste a short paragraph describing the project goals
2. When prompted, optionally skip repo packing (enter "no" or leave blank) to keep the demo fast.
3. Allow Claude to generate all 4 artifacts.
4. Expected outcome — all 4 of the following are generated inline in the conversation:
   - `Rules.md` — coding standards, constraints, architectural rules
   - `Evals.md` — evaluation criteria for the rules
   - `Requirements.md` — functional and non-functional requirements
   - `Roadmap.md` — phased delivery plan
5. Verify persistence — after Claude finishes, ask: "Fetch the memories for project `codifier-demo`."
   - Claude should call `fetch_context` with `project_id` set to the demo project.
   - Expected: at least 4 memories are returned, one for each artifact (memory type `doc` or `rule`).
6. Count the total MCP tool calls made during the session. Expected: 5 or fewer (typically: `manage_projects` to create/switch project, `pack_repo` if repo was packed, `update_memory` x4 for artifacts — the Skill should batch or sequence these efficiently).

---

### 4.3 Phase 1j — Brownfield demo: repos packed, summary generated, learnings persisted

1. Open Claude Code in the test project.
2. Type `/onboard`.
3. When prompted, provide one or two public GitHub repo URLs (e.g., `https://github.com/modelcontextprotocol/servers`).
4. Expected outcome:
   - Claude calls `pack_repo` for each provided URL.
   - Claude generates an architectural summary of the codebase.
   - Claude calls `update_memory` to persist the summary as a `learning` or `doc` memory.
   - The session completes without errors.
5. Verify in Supabase (or via `fetch_context`) that the `repositories` table contains a new row for the packed repo, with `version_label` and `file_tree` populated.

---

### 4.4 Phase 1j — Researcher demo: Athena schema discovered, queries executed, findings persisted

Note: this test requires valid AWS credentials and an accessible Athena workgroup. If AWS credentials are not available, perform steps 1-3 only and verify the error message is graceful.

1. Open Claude Code in the test project.
2. Type `/research`.
3. Provide a research objective when prompted (e.g., "Understand the distribution of user signups by month from the analytics database").
4. Expected outcome:
   - Claude calls `query_data` with `operation: "list-tables"` to discover available Athena tables.
   - Claude calls `query_data` with `operation: "describe-tables"` on relevant tables.
   - Claude generates SQL and presents it to you for confirmation before executing.
   - After confirmation, Claude calls `query_data` with `operation: "execute-query"`.
   - Claude synthesizes the results into a `ResearchFindings.md` document.
   - Claude calls `update_memory` to persist the findings as a `research_finding` memory.
5. Verify the memory was persisted: ask Claude to call `fetch_context` filtered by `memory_type: "research_finding"`. The new finding should appear.

---

### 4.5 Phase 1j — Cross-role demo: researcher's findings retrieved by a developer session

This test confirms that `research_finding` memories created in a researcher session are visible to a developer session on the same project.

Prerequisites: the researcher demo in Section 4.4 must have completed and persisted at least one `research_finding` memory to the `codifier-demo` project.

1. In a new Claude Code session (simulate a different role/user):
2. Type `/codify` and provide the same project name (`codifier-demo`) when asked.
3. During the Initialize Project flow, instruct Claude: "Before generating Requirements.md, fetch any existing research findings for this project."
4. Claude should call `fetch_context` with `project_id: "codifier-demo"` and `memory_type: "research_finding"`.
5. Expected outcome: the `research_finding` memories created in Section 4.4 are returned and Claude incorporates them into the Requirements.md it generates.
6. Confirm that the generated Requirements.md references content from the research findings (check for matching keywords or data points from the researcher session).

---

### 4.6 Phase 1j — Persistence demo: memory retrievable by a second user on a separate machine

This test requires two machines (or two distinct user accounts) both connected to `https://codifier-mcp.fly.dev` with valid API keys scoped to the same project.

**User A (Machine 1):**

1. Ensure `npx @codifier/cli init` has been completed and `.mcp.json` points to `https://codifier-mcp.fly.dev/sse`.
2. In Claude Code, call `update_memory` for project `codifier-demo` with:
   - `memory_type`: `learning`
   - `title`: `Persistence smoke test`
   - `content`: `This memory was created by User A on Machine 1 at <current timestamp>`
3. Record the memory ID returned by `update_memory`.

**User B (Machine 2):**

4. On the second machine, ensure `npx @codifier/cli init` has been completed pointing to the same server URL and a valid API key scoped to the same project.
5. In Claude Code, call `fetch_context` for project `codifier-demo` filtered by `memory_type: "learning"`.
6. Expected outcome: the memory created by User A ("Persistence smoke test") appears in the results returned to User B. The content field should match exactly.
7. This confirms end-to-end persistence via the remote Supabase datastore with no machine-local state.

---

### 4.7 Phase 1j / Verification — Remote access via SSE and API key

1. From a terminal (not the deployed container), verify the SSE endpoint is reachable with a valid API key:
   ```
   curl -s -o /dev/null -w "%{http_code}" \
     -H "Authorization: Bearer $CODIFIER_API_KEY" \
     -H "Accept: text/event-stream" \
     "https://codifier-mcp.fly.dev/sse"
   ```
2. Expected outcome: HTTP status `200`. A `401` means the API key is invalid or missing. A `000` means the server is unreachable.

3. Verify that a request without a token is rejected:
   ```
   curl -s -o /dev/null -w "%{http_code}" \
     "https://codifier-mcp.fly.dev/sse"
   ```
   Expected outcome: HTTP status `401`.

4. Verify the health endpoint is publicly accessible (no auth required):
   ```
   curl -s "https://codifier-mcp.fly.dev/health"
   ```
   Expected outcome: `{"status":"ok"}` or equivalent JSON with HTTP 200.

---

### 4.8 Verification — UX metric: Initialize Project completes with 5 or fewer MCP tool calls

This is measured during the demo in Section 4.2. To isolate and count tool calls precisely:

1. Before starting `/codify`, open the tool call log in Claude Code (visible in the sidebar or expandable tool call blocks in the chat).
2. Run the full Initialize Project flow from start (project name input) to finish (all 4 artifacts persisted).
3. Count every distinct MCP tool call made. Do not count Claude's internal reasoning or web search — only calls to Codifier MCP tools.
4. Expected outcome: total tool call count is 5 or fewer. A typical minimal flow uses:
   - 1 call to `manage_projects` (create or switch project)
   - 4 calls to `update_memory` (one per artifact)
   - Total: 5 calls
   - If `pack_repo` is used: 6 calls (acceptable with repo packing; the metric applies to the no-repo path)
5. If the count exceeds 5 on the no-repo path, review `skills/initialize-project/SKILL.md` for unnecessary intermediate tool calls.

---

## Section 4B — Cowork Client Tests (Claude Desktop)

These tests verify the Codifier experience for a non-technical user running Cowork inside Claude Desktop. There are three setup paths: (1) Cowork Settings instructions that tell Claude to write files directly, (2) CLI with `--url`/`--key` flags for non-interactive init, and (3) interactive prompts for TTY environments. All steps are performed from within the user's own project folder.

### Prerequisites

- Claude Desktop is installed with Cowork enabled
- Node.js 20+ is available (the installer uses `npx`)
- You have a project folder you want to test with (any existing project, or create a new one via Finder / your file manager)
- You have a valid Codifier API key

---

### 4B.1 Setup via Cowork Settings instructions (direct-write path)

This tests the path where a user pastes the Codifier setup instructions into Cowork > Settings > Instructions, then asks Claude to install Codifier without using the CLI at all.

1. Open `docs/cowork-setup-instructions.md` and copy the content inside the "Instructions to paste" section.
2. Open Claude Desktop > Cowork > Settings > Instructions and paste it in.
3. Start a new Cowork session pointed at a clean project folder.
4. In the chat, ask Claude: **"Install Codifier into this project. My API key is `<your-key>`."**
5. Expected outcome:
   - Claude writes the files directly (`.mcp.json`, `.codifier/config.json`, `.claude-plugin/plugin.json`, `docs/` directory) using the instructions from the Settings context
   - Claude does **not** attempt to run `npx @codifier/cli init` interactively (it may use the CLI with `--url`/`--key` flags, or write files directly — both are acceptable)
   - No TTY hang or stalled prompts occur
   - The resulting file layout matches the spec in 4B.3

---

### 4B.2 Setup via CLI with `--url` and `--key` flags (non-interactive)

This tests the CLI path that bypasses interactive prompts entirely — the primary path for sandboxed environments like Cowork.

1. Open Claude Desktop and start a Cowork session pointed at your project folder.
2. In the chat, ask Claude: **"Run `npx @codifier/cli init --client cowork --url https://codifier-mcp.fly.dev --key <your-key>` in this project."**
3. Expected outcome:
   - The command completes with exit code 0 and **no interactive prompts** appear
   - Output includes: `Codifier Init — detected client: cowork`
   - Output includes lines confirming skills, commands, config, and the plugin manifest were created
   - No errors, stack traces, or TTY hangs

4. Alternative — test with env vars instead of flags:
   ```
   CODIFIER_API_KEY=<your-key> npx @codifier/cli init --client cowork
   ```
   Expected: same result — uses env var for the key, defaults to `https://codifier-mcp.fly.dev` for the URL, no prompts.

5. Verify non-TTY error path — pipe empty stdin with no flags or env vars:
   ```
   echo "" | npx @codifier/cli init --client cowork
   ```
   Expected: prints `Error: No API key provided. Use --key <key> or set CODIFIER_API_KEY.` and exits with code 1. Does **not** hang waiting for input.

---

### 4B.3 Verify the installed file layout matches Cowork conventions

After init completes via either 4B.1 or 4B.2, inspect the created files. The Cowork plugin spec places skills and commands at the project root, with only `plugin.json` inside `.claude-plugin/`.

1. In Claude Desktop, ask: **"Show me the top-level files and folders that Codifier just created."**
2. Expected outcome — Claude confirms the following structure:
   - `skills/` folder at the project root containing: `initialize-project/`, `brownfield-onboard/`, `research-analyze/`, `shared/`
   - Each skill folder (`initialize-project`, `brownfield-onboard`, `research-analyze`) contains a `SKILL.md` file
   - `commands/` folder at the project root containing: `codify.md`, `onboard.md`, `research.md`
   - `.claude-plugin/` folder containing only `plugin.json` (no nested `skills/` or `commands/` inside it)
   - `.mcp.json` at the project root with the Codifier server URL and auth header
   - `.codifier/config.json` with the saved server URL and API key
   - `docs/` folder created for local artifact storage

3. Ask Claude: **"Open `.claude-plugin/plugin.json` and show me the contents."**
4. Expected: valid JSON with `name`, `version`, and `description` fields:
   ```json
   {
     "name": "codifier",
     "version": "2.0.5",
     "description": "Institutional memory for AI-driven development"
   }
   ```

5. Ask Claude: **"Open `.mcp.json` and confirm the server URL ends in `/sse`."**
6. Expected: the `url` field is `https://codifier-mcp.fly.dev/sse` and the `Authorization` header starts with `Bearer `.

---

### 4B.4 Health check — run `codifier doctor` from Cowork

This verifies the doctor command works in a Cowork context and confirms that the installed files pass integrity checks.

1. In Claude Desktop, ask: **"Run `npx @codifier/cli doctor --client cowork` and show me the results."**
2. Expected outcome:
   - Output begins with: `Codifier Doctor (client: cowork)`
   - All three skill files pass: `✓ initialize-project/SKILL.md`, `✓ brownfield-onboard/SKILL.md`, `✓ research-analyze/SKILL.md`
   - Plugin manifest passes: `✓ .claude-plugin/plugin.json found`
   - MCP connectivity passes: `✓ MCP server reachable` (or a graceful warning if the server is temporarily unavailable)
   - No `✗` failure lines appear

---

### 4B.5 Slash commands work — `/codify` triggers the Initialize Project skill

This is the core user experience test: a Cowork user types a slash command and the skill activates using the project-root `skills/` path.

1. In Claude Desktop (same Cowork session), type `/codify`.
2. Expected outcome:
   - Claude reads `skills/initialize-project/SKILL.md` from the project root and begins the Initialize Project workflow
   - Claude asks for a project name, description, and context (Statement of Work or equivalent)
   - Claude does **not** report "Codifier skills are not installed" or fail to find the SKILL.md file
   - The Codifier MCP tools (`manage_projects`, `update_memory`, etc.) are available and callable from the chat

3. Provide test inputs when prompted:
   - Project name: `cowork-test`
   - Description: `Testing Codifier from Cowork in Claude Desktop`
   - SOW: a short sentence about the project
4. Let Claude generate at least one artifact (e.g., Rules.md) to confirm the full pipeline works end-to-end through the Cowork interface.
5. Expected: the artifact is generated in the conversation and Claude calls `update_memory` to persist it. No tool-not-found errors.

---

### 4B.6 Re-running init is safe (idempotent)

A non-technical user may run `init` more than once. Verify it doesn't break anything.

1. In Claude Desktop, ask: **"Run `npx @codifier/cli init --client cowork --url https://codifier-mcp.fly.dev --key <your-key>` again."**
2. Expected outcome:
   - The command completes without errors
   - Existing skills and commands are overwritten with fresh copies (no duplicates or corruption)
   - `.claude-plugin/plugin.json` is regenerated
   - `.codifier/config.json` is updated
   - The project remains functional — `/codify` still works after re-init

---

## Section 5 — Verification Checklist Summary

Run through this checklist after completing the above sections. Each item maps to a specific test above.

| # | Checklist Item | Test Reference | Pass / Fail |
|---|---|---|---|
| 1 | `npx @codifier/cli init` completes without errors on macOS (Claude Code environment) | Section 2.1 | |
| 2 | `.codifier/skills/` contains all 3 Skill directories with SKILL.md files after `init` | Section 2.2 | |
| 3 | `.claude/commands/` contains `codify.md`, `onboard.md`, `research.md` after `init` on Claude Code | Section 2.3 | |
| 4 | `/codify` slash command triggers the Initialize Project Skill without invoking `run_playbook` | Section 4.1 | |
| 5 | Docker smoke test: `repomix` included via `npm ci`, `pack()` executes against a known public repo | Section 1.2 | |
| 6 | Docker smoke test: `python -m athena_mcp.server` starts and responds to `list_tables` | Section 1.3 | |
| 7 | Developer demo: 4 artifacts generated and persisted to shared KB in a single session | Section 4.2 | |
| 8 | Researcher demo: Athena schema discovered, queries executed, findings synthesized and persisted | Section 4.4 | |
| 9 | Cross-role demo: `fetch_context` returns researcher's `research_finding` memories to a developer session | Section 4.5 | |
| 10 | Persistence demo: memory created by user A is retrievable by user B on a separate machine via SSE | Section 4.6 | |
| 11 | Remote access: SSE endpoint returns 200 with valid API key, 401 without | Section 4.7 | |
| 12 | Exactly 5 tools registered — `run_playbook` and `advance_step` absent | Section 3.1 | |
| 13 | UX metric: Initialize Project flow completes with 5 or fewer MCP tool calls | Section 4.8 | |
| 14 | Cowork: setup via Cowork Settings instructions (direct-write path) produces correct file layout | Section 4B.1 | |
| 15 | Cowork: `codifier init --client cowork --url ... --key ...` completes non-interactively | Section 4B.2 | |
| 16 | Cowork: non-TTY init with no key prints error and exits (no hang) | Section 4B.2 | |
| 17 | Cowork: file layout matches spec — `skills/` and `commands/` at root, only `plugin.json` in `.claude-plugin/` | Section 4B.3 | |
| 18 | Cowork: `codifier doctor` passes all checks | Section 4B.4 | |
| 19 | Cowork: `/codify` slash command triggers the Initialize Project skill and persists artifacts | Section 4B.5 | |
| 20 | Cowork: re-running `init` is idempotent and does not break the project | Section 4B.6 | |

---

## Appendix — Common Failure Modes and Remediation

**`npx @codifier/cli init` warns "Skills source not found"**
The CLI resolves `SKILLS_SOURCE` relative to `dist/cli/bin/codifier.js` — two directories up to the package root, then `skills/`. If running from a locally built package rather than a published npm install, verify that `skills/` exists at the repository root and that `dist/` was built with `npm run build`. The path computation is: `join(__dirname, '..', '..', 'skills')` where `__dirname` is `dist/cli/`.

**Docker `pack()` fails with a network error**
The runner stage is based on `node:20-alpine`. If your Docker host is behind a proxy, pass `--build-arg` or `--network=host` as appropriate. RepoMix uses `git clone` internally — verify `git` is available in the image or that the repo URL is accessible from inside the container.

**`python -m athena_mcp.server` exits immediately with no output**
This is expected behavior when no stdio client connects — the server blocks on stdin. If it exits with a Python traceback instead, the `pydantic<2.12` pin or the `aws-athena-mcp` pip install failed. Re-run `docker build` and inspect the pip install layer for errors.

**SSE endpoint returns 401 with a valid key**
The auth middleware validates the `Authorization: Bearer <key>` header against the `CODIFIER_API_KEY` environment variable (or `CODIFIER_API_KEYS` if multiple keys are supported). Confirm the key is set correctly as a Fly.io secret: `fly secrets list`. Confirm the header format is exactly `Bearer <key>` with a single space.

**Memory created by User A is not visible to User B**
Confirm both users are using API keys scoped to the same `project_id` in the `api_keys` table. RLS policies scope all queries by project. If User B's key maps to a different project, cross-project retrieval is intentionally blocked.

**Cowork: skills installed to `.codifier/skills/` instead of project-root `skills/`**
This happens when `--client cowork` is not passed and no `.claude-plugin/` directory exists yet, causing auto-detection to fall back to `claude-code` or `generic`. For first-time Cowork setup, always ask Claude to run `npx @codifier/cli init --client cowork`. After init creates `.claude-plugin/`, subsequent runs will auto-detect correctly.

**Cowork: slash commands say "skills are not installed" even after init**
The command `.md` files check two locations in order: `skills/<name>/SKILL.md` (Cowork layout) then `.codifier/skills/<name>/SKILL.md` (Claude Code layout). If neither is found, the user sees the "not installed" message. Verify that `init --client cowork` was used (not plain `init`, which places skills in `.codifier/skills/`). Re-run with the `--client cowork` flag to fix.

**Cowork: `doctor` reports missing skills in `.claude-plugin/skills/`**
This was a bug in pre-2.0.5 versions where `doctor` checked for a duplicate `skills/` tree inside `.claude-plugin/`. As of 2.0.5, skills live at project-root `skills/` only and `.claude-plugin/` contains just `plugin.json`. Update to the latest CLI version by re-running `npx @codifier/cli@latest init --client cowork`.

**Cowork: `codifier init` hangs waiting for input (TTY stall)**
Cowork's sandbox does not provide a TTY on stdin. If `codifier init` is run without `--url`/`--key` flags and without `CODIFIER_SERVER_URL`/`CODIFIER_API_KEY` env vars, the `readline` prompt will hang indefinitely because there is no terminal to read from. Fix: always use `--url` and `--key` flags in non-TTY environments (e.g., `npx @codifier/cli init --client cowork --url https://codifier-mcp.fly.dev --key <key>`). As of the non-interactive init update, the CLI detects `!process.stdin.isTTY`, skips prompts, defaults the URL, and exits with an error if no key is provided — preventing the hang.
