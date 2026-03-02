# Codifier Setup Instructions for Cowork (Claude Desktop)

Paste the content below into **Cowork > Settings > Instructions** so that Claude knows how to install and use Codifier in your project.

---

## Instructions to paste

```
## Codifier — Institutional Memory for AI Development

Codifier is an MCP server that stores project learnings, rules, requirements, and research findings in a shared knowledge base. It is already configured as a remote MCP server for this project.

### MCP Server

- URL: https://codifier-mcp.fly.dev/sse
- Auth: Bearer token (the user will provide their API key)

### Installing Codifier into a project

**Preferred: CLI with flags (no interactive prompts)**

Run this command in the project root. Replace `<API_KEY>` with the user's Codifier API key:

```bash
npx @codifier/cli init --client cowork --url https://codifier-mcp.fly.dev --key <API_KEY>
```

**Alternative: direct file creation**

If the CLI is unavailable or hangs, write these files directly:

1. Create `skills/` at the project root by copying from the npm package, or ask the user to run the CLI on their terminal first.

2. Create `commands/` at the project root with three files:
   - `commands/codify.md` — triggers the Initialize Project skill
   - `commands/onboard.md` — triggers the Brownfield Onboard skill
   - `commands/research.md` — triggers the Research & Analyze skill

3. Create `.claude-plugin/plugin.json`:
```json
{
  "name": "codifier",
  "description": "Institutional memory for AI-driven development",
  "version": "2.0.0"
}
```

4. Create `.codifier/config.json`:
```json
{
  "serverUrl": "https://codifier-mcp.fly.dev",
  "apiKey": "<API_KEY>",
  "installedAt": "<ISO timestamp>"
}
```

5. Create `.mcp.json` at the project root:
```json
{
  "mcpServers": {
    "codifier": {
      "url": "https://codifier-mcp.fly.dev/sse",
      "headers": {
        "Authorization": "Bearer <API_KEY>"
      }
    }
  }
}
```

6. Create `docs/` directory at the project root (used for local artifact storage).

### File layout after installation

```
<project-root>/
├── skills/
│   ├── shared/codifier-tools.md
│   ├── initialize-project/SKILL.md
│   ├── brownfield-onboard/SKILL.md
│   └── research-analyze/SKILL.md
├── commands/
│   ├── codify.md
│   ├── onboard.md
│   └── research.md
├── .claude-plugin/
│   └── plugin.json
├── .codifier/
│   └── config.json
├── .mcp.json
└── docs/
```

### Available slash commands

| Command | Skill | What it does |
|---------|-------|-------------|
| `/codify` | Initialize Project | Collect project info, generate rules, evals, requirements, and roadmap |
| `/onboard` | Brownfield Onboard | Pack existing repos, generate architectural summary |
| `/research` | Research & Analyze | Discover Athena schemas, run queries, synthesize findings |

### MCP tools available

| Tool | Purpose |
|------|---------|
| `fetch_context` | Retrieve memories by project, type, and tags |
| `update_memory` | Create or update a memory (rule, doc, contract, learning, research_finding) |
| `manage_projects` | Create, list, or switch projects |
| `pack_repo` | Condense a repo via RepoMix into a versioned snapshot |
| `query_data` | Run schema discovery and queries against AWS Athena |

### Verifying the installation

Run the doctor command to check connectivity and file integrity:

```bash
npx @codifier/cli doctor --client cowork
```
```
