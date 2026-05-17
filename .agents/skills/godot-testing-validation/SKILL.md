# godot-testing-validation

## When To Use

Use this skill when validating Godot project structure, MCP tools, scenes, scripts, imports, and Godot CLI checks.

## Rules

- Run MCP smoke tests after server changes.
- Run static project checks even when Godot CLI is missing.
- Prefer Godot headless validation when `godot` or `godot4` is available.
- Report what was validated and what could not be validated.

## Limits

- Do not hide warnings.
- Do not claim editor validation passed if Godot CLI was unavailable.
- Do not generate assets as part of validation unless explicitly asked.

## Result Checklist

- `project_scan` works.
- `list_scenes` works.
- Read/create scene and script paths are safe.
- `check_errors` reports Godot CLI status.
