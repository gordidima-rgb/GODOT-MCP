# godot-project-architect

## When To Use

Use this skill when planning or changing Godot project structure, folders, scenes, autoload layout, addon layout, or `res://` architecture.

## Rules

- Confirm the project targets Godot 4.x from `project.godot`.
- Keep files inside the project root.
- Prefer clear folders: `scenes/`, `scripts/`, `assets/`, `addons/`, `tools/`, `docs/`.
- Make small scene and script changes that a beginner can inspect.

## Limits

- Do not use Godot 3.x APIs.
- Do not delete or move existing files without a separate explicit command.
- Do not generate assets before the MCP and validation base is stable.

## Result Checklist

- Project root stayed unchanged.
- New paths use project-local or `res://` paths.
- Created/changed files are listed.
- Validation command or reason for skipping is reported.
