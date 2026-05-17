---
name: godot-editor-plugin-builder
description: Create or modify Godot 4 editor plugins under `addons/`. Use when adding editor-side UI, import helpers, plugin.cfg, EditorPlugin scripts, or tools that should run inside the Godot editor instead of runtime scenes.
---

# Godot Editor Plugin Builder

## Workflow

1. Put editor plugins under `addons/<plugin_name>/`.
2. Create `plugin.cfg` and a main `EditorPlugin` script.
3. Use `@tool` for plugin scripts that run in the editor.
4. Keep editor automation separate from game runtime scripts.
5. Do not enable plugins by editing project settings unless the user asks.

## Minimal Plugin Shape

```text
addons/example_plugin/
  plugin.cfg
  example_plugin.gd
```

## Validation

Check syntax with Godot headless when available. If Godot is unavailable, verify files, required fields, and script base classes.
