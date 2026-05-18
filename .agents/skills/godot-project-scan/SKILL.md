# Godot Project Scan Skill

Use this skill when the agent needs to understand an existing Godot project before editing it.

## Goal

Build a reliable mental model of the project before writing files.

## Required Flow

1. Run `godot_doctor`.
2. Run `godot_project_scan`.
3. Use `godot_list_scenes` and `godot_list_scripts` when scene/script context matters.
4. Use `godot_read_scene` for specific text `.tscn` scenes.
5. Use `godot_search_project` for targeted code or resource lookup.
6. Summarize current structure, risks, and next steps.

## What To Inspect

- `project.godot`
- main scene
- existing `scenes/`
- existing `scripts/`
- `addons/`
- generated assets
- input actions
- autoloads
- generation jobs
- relevant docs

## Rules

- Do not edit before scanning unless the task is a trivial documentation-only change.
- Do not read unrelated large files.
- Do not inspect `.env` or secret-bearing files.
- Prefer exact file references over guessing.
- When a scene is binary `.scn`, do not parse it as text; use the editor bridge or report the limitation.

## Useful Tools

```text
godot_doctor
godot_project_scan
godot_list_scenes
godot_list_scripts
godot_read_scene
godot_search_project
godot_check_errors
```

## Output Checklist

When reporting the scan, include:

- important scenes;
- important scripts;
- relevant assets/resources;
- missing folders or setup issues;
- recommended next action;
- limitations, if the project cannot be fully inspected.
