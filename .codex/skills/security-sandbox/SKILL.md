---
name: security-sandbox
description: Enforce project file safety for local automation. Use when building tools that read/write files, copy assets, run commands, or expose MCP tools over a project workspace.
---

# Security Sandbox

## Rules

1. Resolve every input path to an absolute path before reading or writing.
2. Reject paths outside the Godot project root.
3. Reject absolute destination paths unless explicitly allowed and still inside the root.
4. Do not follow user input into destructive deletes, moves, or overwrites by default.
5. Keep write tools idempotent where practical and require `overwrite: true` for replacing files.
6. Log diagnostics to stderr for MCP servers, never stdout.

## Sensitive Operations

Treat these as high risk:

- Recursive deletion or moves.
- Running external executables with user-provided arguments.
- Network calls or provider credentials.
- Editing global Codex config outside the workspace.

Ask for approval when sandbox rules or user trust boundaries require it.
