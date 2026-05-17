# mcp-server-builder

## When To Use

Use this skill when creating or changing local MCP servers, MCP tool schemas, stdio JSON-RPC handling, or Codex MCP config snippets.

## Rules

- Use stdio for local project automation unless the user asks for HTTP.
- Write only valid JSON-RPC to stdout; send logs to stderr.
- Provide explicit JSON Schemas for tool arguments.
- Return tool execution errors with `isError: true`.

## Limits

- Do not expose arbitrary shell execution.
- Do not let MCP tools read or write outside the project root.
- Do not require network dependencies for the basic skeleton.

## Result Checklist

- `initialize`, `tools/list`, and `tools/call` work.
- Unsafe paths are rejected.
- Smoke test covers at least one read tool and one safe write tool.
- Config instructions are documented.
