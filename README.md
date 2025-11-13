# CodifierMcp

**Institutional Memory for AI-Driven Development**

CodifierMcp is an MCP (Model Context Protocol) server that enables AI assistants like Claude to access and update stored organizational knowledge. It creates a self-reinforcing feedback loop where AI assistants learn from your team's development patterns, architectural decisions, and best practices.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.5.3-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.21.1-purple)](https://modelcontextprotocol.io/)

---

## Table of Contents

- [Overview](#overview)
  - [Key Features](#key-features)
  - [Architecture](#architecture)
  - [Use Cases](#use-cases)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Confluence Setup](#confluence-setup)
  - [MCP Client Configuration](#mcp-client-configuration)
- [Testing Instructions](#testing-instructions)
  - [Test 1: Verify Build](#test-1-verify-build)
  - [Test 2: Verify Configuration](#test-2-verify-configuration)
  - [Test 3: Test Confluence Connection](#test-3-test-confluence-connection)
  - [Test 4: Configure MCP Client](#test-4-configure-mcp-client-claude-desktop)
  - [Test 5: Restart Claude Desktop](#test-5-restart-claude-desktop)
  - [Test 6: Verify MCP Server Connection](#test-6-verify-mcp-server-connection)
  - [Test 7: Test fetch_context Tool](#test-7-test-fetch_context-tool)
  - [Test 8: Test update_memory Tool](#test-8-test-update_memory-tool)
  - [Test 9: Verify in Confluence](#test-9-verify-in-confluence)
  - [Test 10: Check Logs](#test-10-check-logs)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Architecture Details](#architecture-details)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

CodifierMcp bridges the gap between AI assistants and your organization's institutional knowledge. Instead of repeatedly explaining your team's conventions, security patterns, or architectural decisions, CodifierMcp allows AI assistants to:

1. **Fetch Context**: Retrieve relevant rules, guidelines, and best practices from your knowledge base
2. **Update Memory**: Save new insights, learnings, and patterns discovered during development

This creates a virtuous cycle where your AI assistant becomes increasingly familiar with your organization's way of working.

### Key Features

- **Semantic Rule Retrieval**: Find relevant organizational rules using text matching and relevance scoring
- **Context Filtering**: Filter rules by category (security, testing, architecture, etc.)
- **Automatic Metadata Enrichment**: Insights are automatically tagged with timestamps and cross-references
- **Production-Ready**: Built with comprehensive error handling, logging, and validation
- **Clean Architecture**: Interface-based design enables future migration to advanced backends (vector search, knowledge graphs)

### Architecture

```
┌─────────────────────────────────────────┐
│   MCP Clients                           │
│   (Claude Desktop, GitHub Copilot, etc.)│
└──────────────┬──────────────────────────┘
               │ stdio transport (MCP protocol)
               ↓
┌─────────────────────────────────────────┐
│   CodifierMcp Server                    │
│   ├── ContextService (rule retrieval)   │
│   ├── MemoryService (insight storage)   │
│   └── AtlassianDataStore                │
└──────────────┬──────────────────────────┘
               │ REST API (Basic Auth)
               ↓
┌─────────────────────────────────────────┐
│   Confluence Cloud                      │
│   (Institutional memory storage)        │
└─────────────────────────────────────────┘
```

**Core Components:**

- **MCP Server**: Implements the Model Context Protocol for standardized AI integration
- **ContextService**: Advanced rule retrieval with relevance scoring and filtering
- **MemoryService**: Insight storage with automatic metadata enrichment
- **AtlassianDataStore**: Confluence REST API integration with YAML parsing
- **ConfluenceClient**: HTTP client with authentication and error handling

### Use Cases

- **Onboarding AI Assistants**: New AI sessions automatically learn your team's conventions
- **Code Review Augmentation**: AI reviewers check code against your established patterns
- **Documentation Generation**: AI assistants reference your architectural decisions when creating docs
- **Pattern Recognition**: Capture recurring solutions and anti-patterns as institutional knowledge
- **Knowledge Preservation**: Build a living knowledge base that grows with your team

---

## Prerequisites

Before installing CodifierMcp, ensure you have:

1. **Node.js 18 or higher** (required for native `fetch` API)
   - Check your version: `node --version`
   - Download from: [nodejs.org](https://nodejs.org/)

2. **Confluence Cloud Account**
   - Free tier or paid subscription
   - Sign up at: [atlassian.com/software/confluence](https://www.atlassian.com/software/confluence)

3. **Confluence Space with Appropriate Permissions**
   - View space permission (to read rules)
   - Create page permission (to save insights)
   - Edit page permission (to update insights)

4. **Confluence API Token**
   - Generate at: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Keep this token secure - it provides access to your Confluence space

5. **MCP-Compatible AI Client** (one of):
   - Claude Desktop (recommended for testing)
   - GitHub Copilot with MCP support
   - Any other MCP-compatible AI assistant

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/codifierMcp.git
cd codifierMcp
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `zod`: Runtime validation for configuration and data
- `js-yaml`: YAML parsing for rules
- TypeScript and type definitions

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript source files from `src/` to JavaScript in `dist/`.

**Expected output:**
```
> codifierMcp@0.1.0 build
> tsc

# (no output if successful)
```

**Verify build:**
```bash
ls -la dist/
```

You should see:
- `index.js` (main entry point)
- `config/`, `datastore/`, `services/`, `utils/` directories

---

## Configuration

### Environment Variables

CodifierMcp uses environment variables for configuration. These should never be committed to version control.

#### Step 1: Create .env File

```bash
cp .env.example .env
```

#### Step 2: Edit .env with Your Values

Open `.env` in your preferred editor and fill in your Confluence details:

```bash
# macOS/Linux
nano .env

# Windows
notepad .env

# VS Code
code .env
```

#### Step 3: Configure Variables

```bash
# Confluence Cloud Authentication
# Your Confluence Cloud base URL (e.g., https://yoursite.atlassian.net)
CONFLUENCE_BASE_URL=https://yoursite.atlassian.net

# Your Confluence username (email address)
CONFLUENCE_USERNAME=your-email@example.com

# Your Confluence API token
# Generate one at: https://id.atlassian.com/manage-profile/security/api-tokens
CONFLUENCE_API_TOKEN=your-api-token-here

# Confluence Space and Page Settings
# The space key for your Confluence workspace (e.g., "TT" for Triple Threat)
CONFLUENCE_SPACE_KEY=TT

# The title of the page containing your rules (in YAML format)
RULES_PAGE_TITLE=Rules

# The title of the parent page where insights will be saved
# This page will be auto-created if it doesn't exist
INSIGHTS_PARENT_PAGE_TITLE=Memory Insights

# Application Settings
# Logging Level: debug, info, warn, error
LOG_LEVEL=info
```

#### Variable Descriptions

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CONFLUENCE_BASE_URL` | Yes | Your Confluence Cloud instance URL | `https://mycompany.atlassian.net` |
| `CONFLUENCE_USERNAME` | Yes | Your Confluence account email | `jane.doe@company.com` |
| `CONFLUENCE_API_TOKEN` | Yes | API token for authentication | `ATATT3xFfGF0...` |
| `CONFLUENCE_SPACE_KEY` | Yes | Space key (visible in space URL) | `DEV` or `TT` |
| `RULES_PAGE_TITLE` | Yes | Page title containing rules | `Rules` |
| `INSIGHTS_PARENT_PAGE_TITLE` | Yes | Parent page for saved insights | `Memory Insights` |
| `LOG_LEVEL` | No | Logging verbosity | `info` (default), `debug`, `warn`, `error` |

**Security Note:** Never commit your `.env` file to version control. It's already included in `.gitignore`.

---

### Confluence Setup

This section walks you through setting up your Confluence space to work with CodifierMcp.

#### Step 1: Create or Select a Space

1. Log into your Confluence Cloud instance
2. Navigate to **Spaces** (left sidebar)
3. Either:
   - Select an existing space, OR
   - Click **Create space** to create a new one

**Note the Space Key:**
- Visible in the space URL: `https://yoursite.atlassian.net/wiki/spaces/YOUR_KEY/...`
- Usually 2-4 uppercase letters (e.g., `DEV`, `TT`, `TEAM`)
- Use this value for `CONFLUENCE_SPACE_KEY` in your `.env` file

#### Step 2: Create the Rules Page

This page will store your institutional knowledge in YAML format.

1. Navigate to your space
2. Click **Create** (top right)
3. Title the page exactly as specified in `RULES_PAGE_TITLE` (default: `Rules`)
4. Add a YAML code block with your rules:

**Click the "+" button → Code block → Language: YAML**

Paste this example structure:

```yaml
rules:
  - id: R001
    category: code-quality
    title: Always Use Try-Catch for Async Operations
    description: Wrap all async/await calls in try-catch blocks to handle potential errors gracefully and provide meaningful error messages.
    context_type: error-handling
    patterns:
      - "Use try-catch around all async/await operations"
      - "Provide specific error messages for different failure scenarios"
      - "Log errors before re-throwing or handling"
    antipatterns:
      - "Bare async/await without error handling"
      - "Empty catch blocks that swallow errors"
      - "Generic error messages without context"
    examples:
      - |
        // Good: Proper error handling
        async function fetchData() {
          try {
            const response = await fetch('/api/data');
            const data = await response.json();
            return data;
          } catch (error) {
            logger.error('Failed to fetch data:', error);
            throw new DataFetchError('Unable to retrieve data', error);
          }
        }
    metadata:
      created: "2025-01-13"
      priority: high
      tags: ["async", "error-handling", "typescript"]

  - id: R002
    category: security
    title: Validate All User Inputs
    description: Use schema validation (like Zod) for all user inputs, API payloads, and external data to prevent injection attacks and ensure data integrity.
    context_type: security
    patterns:
      - "Define Zod schemas for all input types"
      - "Validate before processing or storing data"
      - "Return clear validation error messages"
    antipatterns:
      - "Direct use of unvalidated input"
      - "Trusting client-side validation alone"
      - "Using inputs in SQL/commands without sanitization"
    examples:
      - |
        // Good: Schema validation
        import { z } from 'zod';

        const UserSchema = z.object({
          email: z.string().email(),
          age: z.number().min(0).max(120)
        });

        function processUser(input: unknown) {
          const user = UserSchema.parse(input); // Throws if invalid
          // Safe to use validated data
        }
    metadata:
      created: "2025-01-13"
      priority: critical
      tags: ["security", "validation", "zod"]

  - id: R003
    category: testing
    title: Write Tests Before Refactoring
    description: Always write tests that verify current behavior before refactoring code. This ensures refactoring doesn't introduce regressions.
    context_type: testing
    patterns:
      - "Write characterization tests for existing behavior"
      - "Ensure all tests pass before starting refactor"
      - "Run tests continuously during refactoring"
    antipatterns:
      - "Refactoring without test coverage"
      - "Writing tests after refactoring (too late)"
      - "Skipping tests because 'it works'"
    examples:
      - |
        // Good: Test-first refactoring workflow
        // 1. Write test for current behavior
        test('calculateTotal adds item prices', () => {
          expect(calculateTotal([10, 20, 30])).toBe(60);
        });

        // 2. Ensure test passes
        // 3. Refactor the implementation
        // 4. Ensure test still passes
    metadata:
      created: "2025-01-13"
      priority: high
      tags: ["testing", "refactoring", "tdd"]
```

5. Click **Publish**

**YAML Structure Requirements:**

- Top-level `rules:` array is required
- Each rule must have: `id`, `category`, `title`, `description`
- Optional but recommended: `context_type`, `patterns`, `antipatterns`, `examples`, `metadata`
- IDs should be unique (e.g., R001, R002, R003...)
- Categories help organize rules (code-quality, security, testing, architecture, etc.)

#### Step 3: Verify Space Permissions

Ensure your account has the necessary permissions:

1. Go to **Space settings** (gear icon in space sidebar)
2. Click **Permissions**
3. Verify your account or group has:
   - **View** permission (to read rules)
   - **Add** permission (to create insight pages)
   - **Edit** permission (to update pages)

If you're a space admin, you automatically have all permissions.

#### Step 4: (Optional) Create Memory Insights Page

The `Memory Insights` parent page will be auto-created on first use, but you can create it manually:

1. Navigate to your space
2. Click **Create**
3. Title: `Memory Insights` (or whatever you set in `INSIGHTS_PARENT_PAGE_TITLE`)
4. Content: "This page contains insights captured by AI assistants."
5. Click **Publish**

Child pages will be created under this parent page when AI assistants save insights.

---

### MCP Client Configuration

CodifierMcp works with any MCP-compatible client. This section shows Claude Desktop configuration as an example.

#### Claude Desktop Configuration

Claude Desktop is the recommended client for testing CodifierMcp.

##### Step 1: Locate Claude Desktop Config File

The config file location depends on your operating system:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

**Quick access (macOS/Linux):**
```bash
# macOS
open ~/Library/Application\ Support/Claude/

# Linux
cd ~/.config/Claude/
```

##### Step 2: Get Absolute Path to CodifierMcp

You need the absolute path to your `dist/index.js` file:

```bash
cd /path/to/codifierMcp
pwd
```

Copy the output (e.g., `/Users/username/projects/codifierMcp`)

The full path will be: `/Users/username/projects/codifierMcp/dist/index.js`

##### Step 3: Edit Claude Desktop Config

Open `claude_desktop_config.json` in your preferred editor:

```bash
# macOS/Linux
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Or use VS Code
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

##### Step 4: Add CodifierMcp Configuration

Add the following configuration to the `mcpServers` object:

```json
{
  "mcpServers": {
    "codifier": {
      "command": "node",
      "args": ["/absolute/path/to/codifierMcp/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://yoursite.atlassian.net",
        "CONFLUENCE_USERNAME": "your-email@example.com",
        "CONFLUENCE_API_TOKEN": "your-api-token",
        "CONFLUENCE_SPACE_KEY": "TT",
        "RULES_PAGE_TITLE": "Rules",
        "INSIGHTS_PARENT_PAGE_TITLE": "Memory Insights",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**Important:**
- Replace `/absolute/path/to/codifierMcp` with the actual absolute path from Step 2
- Replace all `env` values with your actual Confluence credentials
- Use `LOG_LEVEL: "debug"` for initial testing to see detailed logs
- **DO NOT use relative paths** - MCP requires absolute paths

**Example (complete config file):**

```json
{
  "mcpServers": {
    "codifier": {
      "command": "node",
      "args": ["/Users/janedoe/projects/codifierMcp/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://mycompany.atlassian.net",
        "CONFLUENCE_USERNAME": "jane.doe@company.com",
        "CONFLUENCE_API_TOKEN": "ATATT3xFfGF0T8...",
        "CONFLUENCE_SPACE_KEY": "DEV",
        "RULES_PAGE_TITLE": "Rules",
        "INSIGHTS_PARENT_PAGE_TITLE": "Memory Insights",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

##### Step 5: Save and Close

Save the file and close your editor.

---

## Testing Instructions

Follow these tests in order to verify your CodifierMcp installation.

### Test 1: Verify Build

Ensure the TypeScript compilation succeeds and generates JavaScript files.

```bash
# Step 1: Navigate to project directory
cd /path/to/codifierMcp

# Step 2: Install dependencies (if not already done)
npm install

# Step 3: Build the project
npm run build

# Step 4: Verify output
ls -la dist/
```

**Expected output:**
```
dist/
├── index.js
├── config/
│   └── index.js
├── datastore/
│   ├── atlassian-datastore.js
│   ├── confluence-client.js
│   ├── content-parser.js
│   └── interface.js
├── services/
│   ├── context-service.js
│   └── memory-service.js
└── utils/
    ├── errors.js
    └── logger.js
```

**Troubleshooting:**
- If compilation fails, check for TypeScript errors
- Ensure TypeScript is installed: `npm list typescript`
- Check `tsconfig.json` is present and valid

---

### Test 2: Verify Configuration

Ensure your environment variables are properly set.

```bash
# Step 1: Verify .env file exists
ls -la .env

# Step 2: Check .env contents (without exposing secrets in terminal history)
cat .env | grep -v "API_TOKEN"

# Step 3: Verify no placeholder values remain
cat .env
```

**Expected output:**
```
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_USERNAME=jane.doe@company.com
CONFLUENCE_API_TOKEN=*** (should be real token, not placeholder)
CONFLUENCE_SPACE_KEY=DEV
RULES_PAGE_TITLE=Rules
INSIGHTS_PARENT_PAGE_TITLE=Memory Insights
LOG_LEVEL=info
```

**Checklist:**
- [ ] `.env` file exists
- [ ] `CONFLUENCE_BASE_URL` is your actual Confluence URL
- [ ] `CONFLUENCE_USERNAME` is your email address
- [ ] `CONFLUENCE_API_TOKEN` is a real token (not `your-api-token-here`)
- [ ] `CONFLUENCE_SPACE_KEY` matches your space key
- [ ] No placeholder values remain

**Troubleshooting:**
- If API token is still placeholder, generate one at: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- Space key must match exactly (case-sensitive)

---

### Test 3: Test Confluence Connection

Verify your credentials work with Confluence API before integrating with MCP.

#### Option A: Using curl (Command Line Test)

```bash
# Test authentication and space access
curl -u "your-email@example.com:your-api-token" \
  "https://yoursite.atlassian.net/wiki/rest/api/space/YOUR_SPACE_KEY" | jq
```

**Replace:**
- `your-email@example.com` with your Confluence username
- `your-api-token` with your API token
- `YOUR_SPACE_KEY` with your space key
- `yoursite.atlassian.net` with your Confluence base URL

**Expected output:**
```json
{
  "id": 123456,
  "key": "DEV",
  "name": "Development Team",
  "type": "global",
  "status": "current",
  "_links": { ... }
}
```

**Troubleshooting:**
- **401 Unauthorized**: Invalid credentials or API token
  - Verify username is your full email address
  - Check API token hasn't expired
  - Ensure no extra spaces in credentials
- **404 Not Found**: Space doesn't exist or space key is wrong
  - Verify space key in Confluence UI
  - Check space permissions
- **403 Forbidden**: No permission to access space
  - Contact space admin for access

#### Option B: Test with Node.js Script

Create a simple test script to verify connectivity:

```bash
# Create test script
cat > test-confluence.js << 'EOF'
import fetch from 'node-fetch';

const baseUrl = process.env.CONFLUENCE_BASE_URL;
const username = process.env.CONFLUENCE_USERNAME;
const token = process.env.CONFLUENCE_API_TOKEN;
const spaceKey = process.env.CONFLUENCE_SPACE_KEY;

const auth = Buffer.from(`${username}:${token}`).toString('base64');

async function testConnection() {
  try {
    const response = await fetch(
      `${baseUrl}/wiki/rest/api/space/${spaceKey}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connection successful!');
      console.log(`Space: ${data.name} (${data.key})`);
    } else {
      console.error('❌ Connection failed:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();
EOF

# Load environment variables and run test
# Note: Requires Node 18+ for native fetch
export $(cat .env | xargs) && node test-confluence.js

# Clean up
rm test-confluence.js
```

**Expected output:**
```
✅ Connection successful!
Space: Development Team (DEV)
```

---

### Test 4: Configure MCP Client (Claude Desktop)

Set up Claude Desktop to connect to your CodifierMcp server.

```bash
# Step 1: Get absolute path to your project
cd /path/to/codifierMcp
pwd
# Copy the output (e.g., /Users/jane/projects/codifierMcp)

# Step 2: Verify dist/index.js exists
ls -la dist/index.js
# Should show: -rw-r--r--  1 user  group  size  date  dist/index.js

# Step 3: Open Claude Desktop config
# macOS:
open ~/Library/Application\ Support/Claude/

# Linux:
cd ~/.config/Claude/

# Windows:
# Navigate to: %APPDATA%\Claude\

# Step 4: Edit claude_desktop_config.json
# Use your preferred editor (nano, vim, code, etc.)
```

**Add this configuration:**

```json
{
  "mcpServers": {
    "codifier": {
      "command": "node",
      "args": ["/Users/jane/projects/codifierMcp/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://mycompany.atlassian.net",
        "CONFLUENCE_USERNAME": "jane.doe@company.com",
        "CONFLUENCE_API_TOKEN": "ATATT3xFfGF0...",
        "CONFLUENCE_SPACE_KEY": "DEV",
        "RULES_PAGE_TITLE": "Rules",
        "INSIGHTS_PARENT_PAGE_TITLE": "Memory Insights",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**Critical points:**
- [ ] `args` contains **absolute path** to `dist/index.js`
- [ ] All `env` values are **real credentials** (not placeholders)
- [ ] Path uses forward slashes `/` even on Windows
- [ ] No trailing commas in JSON

**Verify your config:**
```bash
# macOS/Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq
```

If `jq` command works, your JSON is valid. If it errors, you have a syntax issue.

---

### Test 5: Restart Claude Desktop

Changes to config require a full restart (not just window close).

**macOS:**
```bash
# Quit Claude Desktop completely
# Option 1: Press Cmd+Q while Claude is active
# Option 2: Right-click Claude in Dock → Quit

# Verify it's closed
ps aux | grep Claude

# Reopen from Applications folder or Spotlight
open -a Claude
```

**Linux:**
```bash
# Kill Claude process
pkill -9 claude

# Or if that doesn't work, find and kill manually
ps aux | grep claude
kill -9 <PID>

# Reopen Claude
claude &
```

**Windows:**
```
1. Close all Claude windows
2. Right-click taskbar → Task Manager
3. Find "Claude" process
4. Click "End task"
5. Reopen from Start menu
```

**Wait for startup:**
- Claude may take 10-30 seconds to initialize MCP servers
- Watch for any startup error messages

---

### Test 6: Verify MCP Server Connection

Check that Claude Desktop successfully connected to CodifierMcp.

**In Claude Desktop:**

1. **Look for MCP indicator** (usually a plug icon 🔌 or tools icon 🔧)
   - Location varies by Claude Desktop version
   - May be in sidebar, toolbar, or status bar

2. **Click the MCP indicator**
   - Should show list of connected MCP servers
   - Look for "codifier" in the list

3. **Check connection status**
   - Should show "Connected" or green indicator
   - If disconnected, shows "Error" or red indicator

**Expected state:**
```
MCP Servers:
  ✅ codifier (Connected)
     - fetch_context
     - update_memory
```

**If not connected:**

1. **Check Claude Desktop logs**
   - macOS: Open Console.app → Search for "Claude"
   - Windows: Event Viewer → Application logs
   - Linux: `journalctl -f | grep claude`

2. **Look for error messages like:**
   - `Cannot find module` → Build failed or wrong path
   - `ENOENT` → Absolute path is incorrect
   - `Configuration error` → Invalid .env values
   - `401 Unauthorized` → Confluence credentials wrong

3. **Common fixes:**
   - Verify absolute path in config is correct
   - Run `npm run build` again
   - Check .env file has valid credentials
   - Restart Claude Desktop again
   - Check file permissions on dist/index.js

4. **Enable debug logging:**
   - In claude_desktop_config.json, set `"LOG_LEVEL": "debug"`
   - Restart Claude Desktop
   - Check logs for detailed error messages

---

### Test 7: Test fetch_context Tool

Verify that Claude can retrieve rules from your Confluence space.

**In Claude Desktop, try these test prompts:**

#### Test 7.1: Basic Fetch (All Rules)

**Prompt:**
```
Use the fetch_context tool to retrieve all rules from my institutional memory.
```

**Expected behavior:**
- Claude calls the `fetch_context` tool
- Tool returns rules from your Confluence Rules page
- Claude presents the rules in a readable format

**Expected response structure:**
```
I've retrieved X rules from your institutional memory:

1. R001: [Title]
   - Category: [category]
   - Description: [description]
   - Context Type: [context_type]

2. R002: [Title]
   ...
```

**Troubleshooting:**
- **"No rules found"**: Verify Rules page exists with YAML content
- **"Page not found"**: Check `RULES_PAGE_TITLE` matches exactly
- **YAML parse error**: Validate YAML syntax in Confluence page
- **401/403 errors**: Verify Confluence credentials and permissions

#### Test 7.2: Filtered Fetch (Text Search)

**Prompt:**
```
Use fetch_context to find rules related to "error handling".
```

**Expected behavior:**
- Tool searches for "error handling" in rule titles, descriptions, and patterns
- Returns rules with relevance scores
- Higher-scoring rules appear first

**Expected response:**
```
I found 3 rules related to "error handling":

1. R006: Comprehensive Error Handling Standards (Relevance: 95%)
   - Category: error-handling
   - Description: Use custom error classes with clear hierarchy...

2. R001: Production-Ready Code Only (Relevance: 78%)
   - Category: code-quality
   - Description: Implement complete error handling...
```

#### Test 7.3: Category Filter

**Prompt:**
```
Fetch rules with context_type='security'.
```

**Expected behavior:**
- Tool filters to only rules where `context_type` field equals "security"
- Returns all matching rules

**Expected response:**
```
I found 2 security rules:

1. R002: Validate All User Inputs
   - Category: security
   - Context Type: security
   ...
```

#### Test 7.4: Limit Results

**Prompt:**
```
Get the top 3 most relevant rules about "testing".
```

**Expected behavior:**
- Tool searches for "testing"
- Ranks by relevance score
- Returns only top 3 results

**Expected response:**
```
Here are the top 3 rules about testing:

1. R003: Write Tests Before Refactoring (Relevance: 92%)
2. R010: Test-Friendly Design Patterns (Relevance: 85%)
3. R002: Lean and Concise Implementations (Relevance: 45%)
```

#### Test 7.5: Combined Filters

**Prompt:**
```
Find rules about "validation" in the "security" category, limit to 5 results.
```

**Expected behavior:**
- Text search for "validation"
- Filter to security category
- Limit to 5 results
- Sort by relevance

---

### Test 8: Test update_memory Tool

Verify that Claude can save insights back to Confluence.

**In Claude Desktop, try these test prompts:**

#### Test 8.1: Save Simple Insight

**Prompt:**
```
Use update_memory to save this insight: "Always use try-catch blocks for async operations to prevent unhandled promise rejections."
```

**Expected behavior:**
- Claude calls `update_memory` tool
- Tool creates new page under "Memory Insights" in Confluence
- Page contains the insight text
- Response includes confirmation and Confluence URL

**Expected response:**
```
✅ I've saved that insight to your institutional memory.

Title: Insight - 2025-01-13 10:30:45
URL: https://yoursite.atlassian.net/wiki/spaces/DEV/pages/123456789/...

The insight has been recorded for future reference.
```

#### Test 8.2: Save with Metadata

**Prompt:**
```
Save an insight about code reviews:
- Insight: "Code reviews should focus on logic and architecture, not style"
- Category: best-practices
- Tags: code-quality, review
```

**Expected behavior:**
- Tool extracts metadata from prompt
- Creates page with enriched metadata
- Formats metadata as front matter or structured section

**Expected response:**
```
✅ Insight saved successfully.

Title: Insight - 2025-01-13 10:32:15
Category: best-practices
Tags: code-quality, review
URL: https://yoursite.atlassian.net/wiki/spaces/DEV/pages/...
```

#### Test 8.3: Save with Related Rules

**Prompt:**
```
Save an insight about error handling related to rule R006:
"When implementing R006, always include stack traces in error logs for debugging but sanitize them before sending to clients."
```

**Expected behavior:**
- Tool detects rule reference (R006)
- Creates cross-reference in metadata
- Links insight to existing rule

**Expected response:**
```
✅ Insight saved with cross-reference to R006.

Title: Insight - 2025-01-13 10:35:22
Related Rules: R006
URL: https://yoursite.atlassian.net/wiki/spaces/DEV/pages/...
```

#### Test 8.4: Save Complex Insight with Code

**Prompt:**
```
Save this pattern as an insight:

"Dependency Injection Pattern for Testability:

When creating services that depend on external systems (like databases or APIs), use constructor injection to pass dependencies. This makes the service easy to test by allowing mock implementations.

Example:
```typescript
class UserService {
  constructor(private db: IDatabase) {}

  async getUser(id: string) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
}

// Easy to test:
const mockDb = { query: jest.fn() };
const service = new UserService(mockDb);
```

Category: testing
Tags: dependency-injection, testability, design-patterns"
```

**Expected behavior:**
- Tool preserves code formatting
- Creates properly formatted Confluence page
- Includes metadata

---

### Test 9: Verify in Confluence

Check that insights were actually saved to Confluence.

```bash
# Step 1: Open your Confluence space in a browser
open "https://yoursite.atlassian.net/wiki/spaces/YOUR_SPACE_KEY"

# Or navigate manually:
# 1. Go to your Confluence instance
# 2. Click on your space in the sidebar
```

**Step 2: Find Memory Insights Page**

1. In your space, look for "Memory Insights" page (or your configured title)
2. If it doesn't appear in page tree, use search: Type "Memory Insights" in Confluence search

**Step 3: Verify Insight Pages**

1. Click on "Memory Insights" parent page
2. Look for child pages with timestamps (e.g., "Insight - 2025-01-13 10:30:45")
3. Open a few insight pages

**Step 4: Check Page Content**

Each insight page should have:
- **Title**: Timestamp-based (e.g., "Insight - 2025-01-13 10:30:45")
- **Metadata section**:
  - Created timestamp
  - Category (if provided)
  - Tags (if provided)
  - Related rules (if provided)
- **Content**: The insight text, properly formatted
- **Code blocks**: Preserved if included

**Example insight page:**

```
Insight - 2025-01-13 10:30:45

---
Metadata:
- Created: 2025-01-13T10:30:45Z
- Category: best-practices
- Tags: error-handling, async
- Related Rules: R006

---

Always use try-catch blocks for async operations to prevent unhandled promise rejections.

When working with async/await, wrap calls in try-catch to handle errors gracefully:

```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    logger.error('Fetch failed:', error);
    throw new DataError('Unable to fetch data', error);
  }
}
```
```

**Step 5: Verify Permissions**

- Check that you can edit the insight pages
- Verify the "Memory Insights" parent page was created correctly
- Confirm pages are in the correct space

**Troubleshooting:**
- **Parent page not found**: Check `INSIGHTS_PARENT_PAGE_TITLE` in config
- **Pages not appearing**: Check space permissions, verify API token is valid
- **Formatting issues**: YAML parsing or Markdown rendering problem
- **Can't edit pages**: Permission issue with API token user

---

### Test 10: Check Logs

Review logs to understand what's happening behind the scenes.

#### View MCP Server Logs

CodifierMcp logs to `stderr` (standard error), which MCP clients capture.

**macOS: Check Console.app**

```bash
# Step 1: Open Console.app
open -a Console

# Step 2: Search for "Claude" in the search bar

# Step 3: Filter messages to show only Claude-related logs

# Step 4: Look for CodifierMcp log entries
```

**Expected log entries (with LOG_LEVEL=debug):**

```
[INFO] Configuration loaded successfully
[INFO] Confluence space key: DEV
[INFO] Rules page title: Rules
[INFO] Connected to Confluence space: DEV (id: 123456)
[DEBUG] MCP server started on stdio transport
[DEBUG] Tool registered: fetch_context
[DEBUG] Tool registered: update_memory
[INFO] MCP server started successfully
[INFO] Ready to accept requests

# During fetch_context call:
[DEBUG] Fetching context with query: "error handling"
[DEBUG] Retrieved 15 rules from Confluence
[DEBUG] Filtering rules by relevance
[INFO] Returning 8 relevant rules

# During update_memory call:
[DEBUG] Saving insight: "Always use try-catch..."
[DEBUG] Enriching metadata with timestamp
[INFO] Creating insight page in Confluence
[DEBUG] Page created with ID: 123456789
[INFO] Insight saved successfully
```

**Linux: Check system logs**

```bash
# Real-time log monitoring
journalctl -f | grep -i claude

# Or check stderr output if running directly
# (Not typical for MCP, but useful for debugging)
```

**Windows: Event Viewer**

```
1. Open Event Viewer (eventvwr.msc)
2. Navigate to Windows Logs → Application
3. Filter for "Claude" or "Node" events
4. Look for stderr output
```

#### Direct Testing (Advanced)

You can run the MCP server directly for debugging:

```bash
# Load environment variables
export $(cat .env | xargs)

# Run MCP server directly (stdio mode)
node dist/index.js

# The server will wait for MCP protocol messages on stdin
# You can manually send MCP messages, but this is advanced usage
# Press Ctrl+C to stop
```

**Expected output:**
```
[INFO] Configuration loaded successfully
[INFO] Connected to Confluence space: DEV
[INFO] MCP server started successfully
[INFO] Ready to accept requests
```

If you see errors here, they'll help diagnose configuration issues.

#### Common Log Messages

**Success indicators:**
- `[INFO] Configuration loaded successfully` - Config is valid
- `[INFO] Connected to Confluence space` - Authentication worked
- `[INFO] MCP server started successfully` - Server is running
- `[INFO] Returning N relevant rules` - fetch_context worked
- `[INFO] Insight saved successfully` - update_memory worked

**Warning indicators:**
- `[WARN] No rules found matching query` - Rules exist but none matched
- `[WARN] Rules page has no YAML content` - Rules page exists but empty
- `[WARN] YAML parsing warning` - Minor syntax issue in rules

**Error indicators:**
- `[ERROR] Configuration validation failed` - Invalid .env values
- `[ERROR] Failed to connect to Confluence` - Authentication or network issue
- `[ERROR] Page not found: Rules` - Rules page doesn't exist
- `[ERROR] YAML parse error` - Invalid YAML syntax in Rules page
- `[ERROR] Failed to save insight` - Confluence write failed

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Cannot find module" error

**Symptoms:**
```
Error: Cannot find module '/path/to/codifierMcp/dist/index.js'
```

**Solutions:**
1. Run `npm run build` to compile TypeScript
2. Verify `dist/` directory exists and contains files
3. Check absolute path in Claude config is correct
4. Ensure no typos in file path (case-sensitive)

---

#### Issue: "401 Unauthorized" from Confluence

**Symptoms:**
```
[ERROR] Failed to connect to Confluence: 401 Unauthorized
```

**Solutions:**
1. Verify API token is correct and not expired
   - Regenerate token at: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Check username is your full email address
3. Ensure no extra spaces in `CONFLUENCE_USERNAME` or `CONFLUENCE_API_TOKEN`
4. Try authenticating manually with curl (see Test 3)
5. Verify API token has correct permissions

---

#### Issue: "404 Space not found"

**Symptoms:**
```
[ERROR] Space not found: TT
```

**Solutions:**
1. Verify `CONFLUENCE_SPACE_KEY` matches actual space key in Confluence
   - Check URL: `https://yoursite.atlassian.net/wiki/spaces/YOUR_KEY/...`
2. Space keys are case-sensitive (usually uppercase)
3. Ensure you have permission to access the space
4. Check space isn't archived or deleted

---

#### Issue: "Page not found: Rules"

**Symptoms:**
```
[ERROR] Page not found: Rules
```

**Solutions:**
1. Verify Rules page exists in your space
2. Check `RULES_PAGE_TITLE` matches page title exactly (case-sensitive)
3. Ensure page is published (not draft)
4. Verify page is in the correct space
5. Check API token user has permission to view the page

---

#### Issue: MCP server not appearing in Claude Desktop

**Symptoms:**
- No "codifier" in MCP servers list
- MCP indicator doesn't show codifier

**Solutions:**
1. Verify `claude_desktop_config.json` syntax is valid
   - Use `jq` to validate: `cat claude_desktop_config.json | jq`
   - Check for missing commas, trailing commas, or quote issues
2. Ensure absolute path in config is correct (not relative)
3. Restart Claude Desktop completely (Cmd+Q, not just close window)
4. Check Claude Desktop logs for error messages
5. Verify build succeeded: `ls dist/index.js`
6. Try changing `LOG_LEVEL` to `"debug"` for more details

---

#### Issue: "YAML parse error"

**Symptoms:**
```
[ERROR] YAML parse error: bad indentation of a mapping entry
```

**Solutions:**
1. Validate YAML syntax using online validator: [yamllint.com](http://www.yamllint.com/)
2. Check indentation is consistent (2 spaces, not tabs)
3. Ensure strings with special characters are quoted
4. Verify all lists start with `-` and proper indentation
5. Check for missing colons after keys
6. Ensure multiline strings use proper `|` or `>` syntax

**Common YAML mistakes:**

```yaml
# Bad: Mixed indentation
rules:
  - id: R001
  title: Test  # Wrong indentation

# Good: Consistent indentation
rules:
  - id: R001
    title: Test

# Bad: Missing colon
rules
  - id: R001

# Good: Colon after key
rules:
  - id: R001
```

---

#### Issue: "No rules found"

**Symptoms:**
```
[WARN] No rules found matching query
```

**Solutions:**
1. Verify Rules page has YAML code block with `rules:` array
2. Check YAML syntax is valid (see YAML parse error section)
3. Ensure at least one rule is defined
4. Try fetching without filters: "Use fetch_context to get all rules"
5. Check rules have required fields (id, title, description)

---

#### Issue: Environment variables not loading

**Symptoms:**
```
[ERROR] Configuration validation failed: Required
```

**Solutions:**
1. Ensure `.env` file exists in project root
2. Verify all required variables are set (no placeholders)
3. Check for typos in variable names
4. In Claude Desktop config, environment variables must be in `env` object
5. Variables in Claude config override `.env` file

**Note:** When running via MCP, CodifierMcp uses environment variables from Claude Desktop config, NOT from `.env` file. The `.env` file is only for direct testing.

---

#### Issue: Logs not appearing

**Symptoms:**
- No log output visible
- Can't debug issues

**Solutions:**
1. Set `LOG_LEVEL` to `"debug"` in Claude config
2. Restart Claude Desktop after config change
3. Check Console.app (macOS) or Event Viewer (Windows)
4. Try running server directly: `node dist/index.js` to see output
5. Verify logger is using `console.error` (not `console.log`)

---

#### Issue: Insights not saving to Confluence

**Symptoms:**
```
[ERROR] Failed to save insight: 403 Forbidden
```

**Solutions:**
1. Verify API token user has "Add" permission in space
2. Check "Memory Insights" parent page exists or can be created
3. Ensure space isn't locked or restricted
4. Verify `INSIGHTS_PARENT_PAGE_TITLE` is correct
5. Try creating a page manually in Confluence to test permissions

---

#### Issue: Connection timeout

**Symptoms:**
```
[ERROR] Connection timeout: fetch timeout
```

**Solutions:**
1. Check internet connection
2. Verify Confluence base URL is correct
3. Check firewall isn't blocking Confluence API
4. Verify Confluence instance is online
5. Try accessing Confluence in browser to confirm it's reachable

---

### Getting Help

If you encounter issues not covered here:

1. **Enable debug logging**: Set `LOG_LEVEL=debug`
2. **Check logs**: Review Claude Desktop logs for detailed error messages
3. **Test components individually**: Use Test 3 (curl test) to isolate issues
4. **Verify prerequisites**: Ensure Node.js 18+, valid Confluence account
5. **Review configuration**: Double-check all environment variables
6. **Check Confluence permissions**: Verify your API token user has correct access

**When reporting issues, include:**
- Error messages from logs
- Your Node.js version: `node --version`
- Your TypeScript version: `npm list typescript`
- Steps to reproduce the issue
- Confluence space type (global, personal, etc.)

---

## Development

### Project Structure

```
codifierMcp/
├── src/                          # TypeScript source files
│   ├── index.ts                  # MCP server entry point
│   ├── config/
│   │   └── index.ts              # Configuration management (Zod validation)
│   ├── datastore/
│   │   ├── interface.ts          # IDataStore abstraction
│   │   ├── confluence-client.ts  # HTTP client for Confluence REST API
│   │   ├── atlassian-datastore.ts # IDataStore implementation for Confluence
│   │   └── content-parser.ts     # YAML parsing and content extraction
│   ├── services/
│   │   ├── context-service.ts    # Rule retrieval with relevance scoring
│   │   └── memory-service.ts     # Insight storage with metadata enrichment
│   └── utils/
│       ├── logger.ts             # Logging utility (stderr for MCP)
│       └── errors.ts             # Custom error classes hierarchy
├── dist/                         # Compiled JavaScript (generated by build)
├── docs/
│   ├── rules.yaml                # Project development rules
│   └── evals.yaml                # Rule evaluations
├── .env.example                  # Example environment configuration
├── .env                          # Your local configuration (not committed)
├── tsconfig.json                 # TypeScript compiler configuration
├── package.json                  # Node.js dependencies and scripts
└── README.md                     # This file
```

### Key Files

- **src/index.ts**: MCP server setup, tool registration, request handling
- **src/config/index.ts**: Environment validation with Zod schemas
- **src/datastore/interface.ts**: Abstraction layer for storage backends
- **src/datastore/atlassian-datastore.ts**: Confluence integration
- **src/services/context-service.ts**: Advanced rule retrieval logic
- **src/services/memory-service.ts**: Insight enrichment and storage
- **docs/rules.yaml**: Development best practices for this project

### Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Build and run (for testing)
npm run dev

# Watch mode (rebuilds on file changes)
npm run watch
```

### Adding New Features

1. **Design**: Consider the abstraction layer (IDataStore) for future migration
2. **Implement**: Follow patterns in `docs/rules.yaml`
3. **Error Handling**: Use custom error classes from `utils/errors.ts`
4. **Logging**: Use the logger from `utils/logger.ts` (stderr only)
5. **Validation**: Use Zod schemas for input validation
6. **TypeScript**: Enable strict mode, use explicit types
7. **Testing**: Design for testability (dependency injection)

### Modifying Rules

Rules are stored in Confluence, not in code:

1. Open your Confluence Rules page
2. Edit the YAML code block
3. Follow the schema:
   ```yaml
   rules:
     - id: R999
       category: your-category
       title: Your Rule Title
       description: Detailed description
       context_type: optional-context-type
       patterns:
         - "Pattern 1"
         - "Pattern 2"
       antipatterns:
         - "Antipattern 1"
       examples:
         - "Example code or text"
       metadata:
         created: "2025-01-13"
         priority: high
         tags: ["tag1", "tag2"]
   ```
4. Save and publish the page
5. Rules are immediately available via `fetch_context`

### Code Style

Follow the patterns defined in `docs/rules.yaml`:

- **R001**: Production-ready code, no placeholders
- **R002**: Lean implementations, avoid over-engineering
- **R003**: Use stderr for logging in MCP servers
- **R004**: ESM with .js extensions in imports
- **R005**: Clean abstractions for migration
- **R006**: Custom error classes with context
- **R007**: Zod validation for configuration
- **R008**: Strict TypeScript mode
- **R009**: Clear module organization
- **R010**: Test-friendly design patterns
- **R011**: JSDoc for public APIs

---

## Architecture Details

### Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│   MCP Protocol Layer                    │
│   - Tool registration                   │
│   - Request validation                  │
│   - Response formatting                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Service Layer                         │
│   - ContextService (rule retrieval)     │
│   - MemoryService (insight storage)     │
│   - Business logic                      │
│   - Relevance scoring                   │
│   - Metadata enrichment                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Data Access Layer                     │
│   - IDataStore interface                │
│   - AtlassianDataStore implementation   │
│   - ConfluenceClient (HTTP)             │
│   - Content parsing (YAML)              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Confluence Cloud (Storage)            │
│   - Rules page (YAML)                   │
│   - Memory Insights (child pages)       │
└─────────────────────────────────────────┘
```

### IDataStore Abstraction

The `IDataStore` interface enables easy migration between storage backends:

```typescript
interface IDataStore {
  // Fetch all rules from storage
  fetchRules(): Promise<Rule[]>;

  // Save an insight to storage
  saveInsight(insight: Insight): Promise<void>;

  // Optional: health check
  healthCheck?(): Promise<boolean>;
}
```

**Current Implementation:** `AtlassianDataStore`
- Uses Confluence REST API
- Parses YAML from Confluence pages
- Creates child pages for insights

**Future Implementation:** `SupabaseDataStore`
- PostgreSQL database with pgvector
- Vector embeddings for semantic search
- Knowledge graph with relationships

### MCP Protocol Flow

1. **Client Request**: MCP client (Claude) sends tool request via stdio
2. **Validation**: Server validates request against Zod schema
3. **Service Layer**: Appropriate service handles business logic
4. **Data Layer**: Service calls IDataStore methods
5. **External API**: DataStore communicates with Confluence
6. **Response**: Results flow back through layers to client

### Relevance Scoring

`ContextService` scores rules based on:

- **Title match**: 40 points (full text match)
- **Description match**: 30 points
- **Pattern match**: 20 points
- **Example match**: 10 points
- **Normalized to 0-100%**

### Metadata Enrichment

`MemoryService` enriches insights with:

- **Timestamp**: ISO 8601 format (2025-01-13T10:30:45Z)
- **Category**: Extracted from prompt or user-provided
- **Tags**: Extracted from content or user-provided
- **Related Rules**: Detected rule references (e.g., R001, R006)
- **Source**: Always "AI Assistant"

---

## Future Enhancements

### Phase 2: Supabase Migration

- **PostgreSQL database** with structured tables
- **Vector storage** (pgvector) for embeddings
- **Semantic search** using similarity queries
- **Migration tooling** from Confluence to Supabase

### Phase 3: Advanced Features

- **Knowledge graph** with relationship mapping
- **RAG architecture** for context-aware retrieval
- **Pattern extraction** from code and conversations
- **Learning algorithms** to refine rules over time
- **Confidence scoring** based on usage and outcomes

### Phase 4: Integration & UX

- **IDE plugins** (VS Code, IntelliJ)
- **CI/CD hooks** for automated knowledge capture
- **Code review augmentation** with rule checking
- **Query interface** for exploring knowledge graph
- **Administrative dashboard** for rule management

### Potential Enhancements

- **Multi-space support**: Aggregate rules from multiple Confluence spaces
- **Rule versioning**: Track changes to rules over time
- **Collaborative editing**: Multiple AI assistants contribute insights
- **Analytics**: Track which rules are most useful
- **Export/import**: Backup and restore institutional memory
- **Conflict resolution**: Merge insights from different sources

---

## Contributing

We welcome contributions to CodifierMcp!

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make changes**: Follow patterns in `docs/rules.yaml`
4. **Test thoroughly**: Verify all 10 test cases pass
5. **Commit**: Use descriptive commit messages
6. **Push**: `git push origin feature/your-feature`
7. **Pull Request**: Submit PR with detailed description

### Testing Requirements

Before submitting a PR:

- [ ] All 10 test cases pass
- [ ] Build completes without errors
- [ ] TypeScript strict mode enabled
- [ ] Code follows rules in `docs/rules.yaml`
- [ ] New features have JSDoc documentation
- [ ] Error handling is comprehensive
- [ ] Logging uses stderr (not stdout)
- [ ] ESM imports use .js extensions

### Code Review

We review PRs for:

- **Code quality**: Follows established patterns
- **Error handling**: Comprehensive and actionable
- **Documentation**: JSDoc for public APIs
- **Testing**: Testable design patterns
- **Security**: No exposed secrets or vulnerabilities
- **Performance**: No obvious bottlenecks

### Reporting Issues

When reporting issues, please include:

- **Description**: Clear description of the problem
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Node version, OS, etc.
- **Logs**: Relevant error messages or logs
- **Configuration**: Sanitized config (no secrets)

### Feature Requests

For feature requests:

1. Check existing issues to avoid duplicates
2. Describe the use case clearly
3. Explain expected behavior
4. Consider architectural implications
5. Be open to feedback and discussion

---

## License

Copyright 2025 CodifierMcp Contributors

Licensed under the MIT License. See LICENSE file for details.

---

## Additional Resources

- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Confluence REST API**: [developer.atlassian.com/cloud/confluence/rest](https://developer.atlassian.com/cloud/confluence/rest/)
- **TypeScript Handbook**: [typescriptlang.org/docs](https://www.typescriptlang.org/docs/)
- **Zod Documentation**: [zod.dev](https://zod.dev/)

---

**Built with Claude Code**

CodifierMcp is developed with assistance from Claude, demonstrating the power of AI-human collaboration in software development.

---

**Questions or Need Help?**

- Check the [Troubleshooting](#troubleshooting) section
- Review [Test Instructions](#testing-instructions) step by step
- Enable debug logging: `LOG_LEVEL=debug`
- Open an issue on GitHub with detailed information

---

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Confluence Cloud account created
- [ ] Confluence space with Rules page (YAML format)
- [ ] API token generated
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Project built (`npm run build`)
- [ ] .env file created and configured
- [ ] Confluence connection tested
- [ ] Claude Desktop configured
- [ ] MCP server connected
- [ ] fetch_context tested
- [ ] update_memory tested
- [ ] Insights verified in Confluence

**Congratulations!** You're now ready to use CodifierMcp to build institutional memory for your team.
