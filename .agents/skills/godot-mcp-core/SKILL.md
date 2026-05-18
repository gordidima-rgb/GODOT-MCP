# Godot MCP Core Skill

Use this skill for any task that touches the GODOT-MCP server, Godot project files, AI-agent workflow, or local MCP client setup.

## Purpose

Keep all AI-assisted Godot work safe, inspectable, and reversible.

GODOT-MCP is instruction-first:

1. The AI client understands the user's goal.
2. The AI client plans the Godot implementation.
3. MCP tools provide sandboxed project operations.
4. The agent validates changes before claiming completion.

## Required Start

Before editing project files:

1. Run `godot_doctor`.
2. Run `godot_project_scan`.
3. Read only the scenes, scripts, resources, or docs needed for the task.
4. Summarize the intended change before writing when the change is non-trivial.

## Safety Rules

- Keep all file operations inside the Godot project root.
- Prefer `res://` paths for Godot-facing references.
- Do not read or expose secrets from `.env`.
- Do not invent provider keys, endpoints, cookies, or private tokens.
- Do not delete files unless the user explicitly asks for deletion.
- Use `dry_run` for non-trivial writes.
- Use `overwrite: true` only after inspecting the existing file.
- Prefer provider `none` unless the user explicitly asks to use a configured provider.

## Default Tool Chain

```text
godot_doctor
godot_project_scan
godot_help
godot_check_errors
```

## Completion Criteria

A task is not complete until:

- changed files are listed;
- validation was attempted;
- Godot/runtime limitations are reported if validation could not run;
- any generated job files, screenshots, or provider outputs are identified.
