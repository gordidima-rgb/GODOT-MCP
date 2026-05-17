# godot-gdscript-engineer

## When To Use

Use this skill when writing, reviewing, or attaching GDScript for Godot 4.x scenes, runtime nodes, or editor plugins.

## Rules

- Use Godot 4 syntax: `@tool`, `@export`, typed variables, and Godot 4 signal connection style.
- Pick the narrowest sensible `extends` type.
- Add short comments for beginner-facing logic.
- Keep editor scripts under `addons/` and runtime scripts under `scripts/`.

## Limits

- Do not use Godot 3.x callback or API names.
- Do not overwrite existing scripts unless `overwrite` was explicitly requested.
- Do not put secrets in scripts or logs.

## Result Checklist

- Script has a valid `extends`.
- Godot 4 syntax is used.
- Comments explain non-obvious logic.
- Syntax was checked with Godot CLI or static validation.
