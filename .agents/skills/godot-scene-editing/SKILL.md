# Godot Scene Editing Skill

Use this skill when creating or changing Godot scenes, nodes, scripts, input actions, autoloads, or material resources.

## Required Flow

1. Inspect the project with `godot_project_scan`.
2. Read the target scene with `godot_read_scene` when it is a text `.tscn` scene.
3. Plan the node tree and script behavior before writing.
4. Use `dry_run: true` for non-trivial writes.
5. Apply the smallest useful change.
6. Read back the changed scene or script.
7. Run validation.

## Scene Rules

- Prefer text `.tscn` scenes for MCP file-based edits.
- Do not edit binary `.scn` as text.
- Keep node names clear and stable.
- Use `res://` paths for scene resources.
- Do not overwrite an existing scene without inspecting it first.
- Do not attach a script blindly; verify the node path.

## Script Rules

- Use Godot 4.x APIs.
- Add short beginner-readable comments only when they clarify intent.
- Keep generated scripts focused.
- Do not invent unavailable autoloads, input actions, or assets.
- Add missing input actions through `godot_create_input_action` when needed.

## Useful Tools

```text
godot_read_scene
godot_create_scene
godot_add_node
godot_update_node
godot_attach_script
godot_create_script
godot_create_input_action
godot_create_autoload
godot_create_material
godot_check_errors
```

## Required Validation

After scene/script edits:

```text
godot_check_errors
```

If gameplay logic changed and Godot is available:

```text
godot_run_project
godot_runtime_status
godot_stop_project
```

If visible objects changed, use screenshot validation.
