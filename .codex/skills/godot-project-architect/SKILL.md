---
name: godot-project-architect
description: Plan and maintain Godot 4.x project structure, scenes, autoloads, folders, and architecture. Use when scanning a Godot project, listing or creating scenes, choosing node hierarchy, defining safe file layout, or deciding what should be editor automation versus source files.
---

# Godot Project Architect

## Workflow

1. Read `project.godot` first and confirm `config/features` targets Godot 4.x.
2. Scan only inside the project root. Treat `res://` as the project root and reject paths that escape it.
3. List scenes from `*.tscn` and scripts from `*.gd` before creating new files.
4. Prefer small, readable scenes with explicit root node types.
5. Keep generated files in conventional folders: `scenes/`, `scripts/`, `assets/`, `addons/`, and `tools/`.
6. Avoid asset generation until the MCP file and scene foundation is stable.

## Scene Rules

- Use Godot 4 text scenes with `format=3`.
- Use `uid://` only when Godot generates it; do not invent stable UIDs manually.
- Keep prototype scenes minimal: a root node, optional child nodes, and `script` ext_resources when needed.
- Do not edit binary Godot assets directly.

## Output Expectations

Report what was found, what changed, and what still needs the Godot editor to verify.
