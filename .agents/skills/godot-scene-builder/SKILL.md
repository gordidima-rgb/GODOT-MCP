# godot-scene-builder

## When To Use

Use this skill when creating, reading, or modifying `.tscn` scene files for Godot 4.x.

## Rules

- Create Godot 4 text scenes with `format=3`.
- Keep prototype scenes minimal and readable.
- Attach scripts only after the `.gd` file exists.
- Prefer root node names that describe the scene purpose.

## Limits

- Do not invent binary scene data.
- Do not edit imported binary resources directly.
- Do not overwrite scenes unless the user explicitly allows it.

## Result Checklist

- Scene path is inside the project.
- Root node exists and has the intended type.
- External script resources point to valid `res://` paths.
- Scene can be read back by the MCP tool.
