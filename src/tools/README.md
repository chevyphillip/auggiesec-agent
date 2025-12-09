# Auggie SDK Integration for GraphGuard

## Overview

This directory contains the Auggie SDK tool wrappers for the OWASP GraphGuard security analysis agent.

## Auggie SDK Requirements

### Package Installation

```bash
bun add @augmentcode/auggie-sdk ai
```

**Note:** The `ai` package (Vercel AI SDK) is required for the `tool` function used to define custom tools.

### SDK Pattern

The Auggie TypeScript SDK uses the Vercel AI SDK tool format:

```typescript
import { Auggie } from "@augmentcode/auggie-sdk";
import { tool } from "ai";
import { z } from "zod";

// Define a custom tool
const myTool = tool({
  name: "tool_name",
  description: "Description for the LLM to understand when to use this tool",
  inputSchema: z.object({
    param: z.string().describe("Parameter description"),
  }),
  execute: async ({ param }) => {
    // Tool implementation
    return "result";
  },
});

// Initialize Auggie with custom tools
const client = await Auggie.create({
  model: "sonnet4.5",
  workspaceRoot: "./nodejs-goof",
  tools: {
    tool_name: myTool,
  },
});

const response = await client.prompt("Analyze this code for vulnerabilities");
await client.close();
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `auggiePath` | string | Path to Auggie executable (default: "auggie") |
| `model` | string | Model to use: "sonnet4.5", "opus4.5", etc. |
| `workspaceRoot` | string | Root directory for code analysis |
| `systemPrompt` | string | Custom system prompt |
| `apiToken` | string | API token (uses env var if not provided) |
| `outputMode` | string | "string" (default), "answer-only", or streaming |
| `tools` | object | Custom tools object |

### Output Modes

1. **String Response (default)**: Returns full response as string
2. **Answer-Only Mode**: Returns only the final answer
3. **Streaming Mode**: Streams events for real-time updates

## Tools to Implement for Phase 4

### 1. `search_code` - Code Pattern Search

Search the codebase for security-relevant patterns.

```typescript
const searchCodeTool = tool({
  name: "search_code",
  description: "Search codebase for code patterns, function calls, or keywords",
  inputSchema: z.object({
    query: z.string().describe("Search query (e.g., 'exec(', 'eval(', 'User.find')"),
    filePattern: z.string().optional().describe("Glob pattern (e.g., '**/*.js')"),
  }),
  execute: async ({ query, filePattern }) => {
    // Use Auggie's built-in code search
    return JSON.stringify(results);
  },
});
```

### 2. `get_file_content` - File Reader

Read file contents for detailed analysis.

```typescript
const getFileContentTool = tool({
  name: "get_file_content",
  description: "Read the contents of a specific file",
  inputSchema: z.object({
    filePath: z.string().describe("Path to file relative to workspace root"),
    lineRange: z.object({
      start: z.number().optional(),
      end: z.number().optional(),
    }).optional().describe("Optional line range to read"),
  }),
  execute: async ({ filePath, lineRange }) => {
    // Read file contents
    return fileContent;
  },
});
```

### 3. `analyze_dependencies` - Dependency Scanner

Analyze package.json for vulnerable dependencies.

```typescript
const analyzeDependenciesTool = tool({
  name: "analyze_dependencies",
  description: "Analyze package.json for known vulnerable dependencies",
  inputSchema: z.object({
    manifestPath: z.string().default("package.json").describe("Path to package manifest"),
  }),
  execute: async ({ manifestPath }) => {
    // Parse and analyze dependencies
    return JSON.stringify(vulnerabilities);
  },
});
```

## Integration with LangGraph

The tools will be wired to LangGraph nodes in `src/graph/nodes/analyze.ts`:

```typescript
import { Auggie } from "@augmentcode/auggie-sdk";
import { searchCodeTool, getFileContentTool, analyzeDependenciesTool } from "../tools";

export async function analyzeNode(state: SecurityAnalysisState) {
  const client = await Auggie.create({
    model: "sonnet4.5",
    workspaceRoot: state.repoPath,
    tools: {
      search_code: searchCodeTool,
      get_file_content: getFileContentTool,
      analyze_dependencies: analyzeDependenciesTool,
    },
  });

  // Load prompt from Langfuse
  const prompt = await langfuse.getPrompt("owasp-a03-injection", { label: "production" });
  
  // Run analysis
  const response = await client.prompt(prompt.compile({ 
    repo_path: state.repoPath,
    target_files: state.targets.join(", "),
    code_content: state.codeContext,
  }));

  await client.close();
  return { findings: parseFindings(response) };
}
```

## Next Steps

1. Install required packages: `bun add ai`
2. Create tool implementations in `src/tools/`
3. Wire tools to LangGraph analyze node
4. Load prompts from Langfuse at runtime
5. Test against nodejs-goof vulnerabilities

