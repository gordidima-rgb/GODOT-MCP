# GODOT-MCP Beginner Recipes

These recipes assume Codex is connected to the local MCP server and the project is a Godot 4.x project.

## 1. Check The Project

Ask Codex:

```text
Run godot_doctor, then godot_project_scan. Tell me what is safe to change first.
```

Use this before bigger edits. It checks the project root, server version, Node.js, `project.godot`, Godot CLI, the editor bridge, `.env`, providers, and expected folders.

## 2. Create A Small Scene Safely

Ask Codex:

```text
Dry-run a new scene at scenes/example.tscn with a Node2D root named Example, then show plannedChanges.
```

If the plan looks right, ask:

```text
Create the scene and add a Sprite2D child named IconSprite.
```

The dry run should not change files.

## 3. Add A Beginner Script

Ask Codex:

```text
Create scripts/example.gd extending Node2D with a short beginner-friendly comment, then attach it to scenes/example.tscn.
```

The script tool refuses to overwrite existing files unless `overwrite: true` is used.

## 4. Add An Input Action

Ask Codex:

```text
Create an input action named jump with a Space key event, then run godot_check_errors.
```

This edits only the `[input]` section of `project.godot`.

## 5. Create An Autoload

Ask Codex:

```text
Create scripts/game_state.gd, then add it as an autoload named GameState.
```

Autoloads are written to the `[autoload]` section of `project.godot`.

## 6. Create A Simple Material

Ask Codex:

```text
Create a blue StandardMaterial3D at assets/materials/blue_test.tres.
```

Use text `.tres` or `.material` resources so they are easy to review.

## 7. Queue Asset Generation Without A Provider

Ask Codex:

```text
Queue a sprite prompt with provider none, then list generation jobs.
```

Provider `none` saves JSON under `generation_jobs/` instead of calling a real service.

## 8. Mark A Generation Job Done

Ask Codex:

```text
List generation jobs, pick the newest queued image job, and mark it done with a short note.
```

This only updates the selected job JSON.

## 9. Search Before Editing

Ask Codex:

```text
Search the project for third_person_capsule and summarize every file that mentions it.
```

Use search before renaming, moving, or touching shared scripts.

## 10. Use The Editor Bridge

In Godot, enable `AI MCP Bridge`, choose a port, and press `Start`.

Then ask Codex:

```text
Run godot_bridge_status and godot_editor_scene_snapshot.
```

The bridge is optional. File-based tools still work without it.
