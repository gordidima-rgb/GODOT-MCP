---
name: godot-testing-and-validation
description: Validate Godot 4 projects, scenes, scripts, imports, and local MCP tools. Use when checking errors, running Godot headless, smoke-testing MCP JSON-RPC, or reporting validation limits.
---

# Godot Testing And Validation

## Workflow

1. Detect whether `godot` or `godot4` is available.
2. If available, prefer headless checks with the project path.
3. If unavailable, run static validation: project file exists, scene text parses enough for headers, scripts have plausible `extends`, paths are safe, and MCP smoke tests pass.
4. Report validation limits clearly.

## MCP Smoke Test

Verify at minimum:

- `initialize`
- `tools/list`
- `project_scan`
- path rejection for unsafe input

## Error Reporting

Return concise structured summaries: `ok`, `warnings`, `errors`, and `details`.
