---
name: mcp-server-builder
description: Build minimal local MCP servers with safe JSON-RPC stdio tools. Use when creating or modifying `tools/mcp-*`, defining MCP tool schemas, validating initialize/tools/list/tools/call, or wiring Codex MCP config.
---

# MCP Server Builder

## Workflow

1. Prefer local stdio MCP for project automation.
2. Implement `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call`.
3. Write only valid JSON-RPC messages to stdout; send logs to stderr.
4. Define explicit JSON Schemas for every tool argument object.
5. Return tool execution failures as MCP tool results with `isError: true`.
6. Keep server dependencies minimal until the base protocol works.

## Validation

Smoke-test the server by spawning it, sending newline-delimited JSON-RPC messages, and asserting:

- `initialize` returns `capabilities.tools`.
- `tools/list` includes expected tools.
- a read-only tool call succeeds.
- unsafe paths are rejected.

## Config

For Codex, add servers under `[mcp_servers.<name>]` in `config.toml` with `command`, `args`, optional `env`, and `startup_timeout_sec`.
