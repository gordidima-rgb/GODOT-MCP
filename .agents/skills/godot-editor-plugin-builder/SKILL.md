# godot-editor-plugin-builder

## When To Use

Use this skill when creating or modifying Godot editor addons under `addons/`.

## Rules

- Every addon needs a `plugin.cfg` and an `EditorPlugin` script.
- Use `@tool` for scripts that run in the editor.
- Keep editor UI simple: labels, buttons, lists, and clear status text.
- Do not enable plugins automatically unless asked.

## Limits

- Do not put runtime gameplay logic into editor plugins.
- Do not call external services from editor UI without explicit user action.
- Do not log secrets.

## Result Checklist

- Addon has `plugin.cfg`.
- Main script extends `EditorPlugin`.
- UI scripts use Godot 4 syntax.
- Plugin can be enabled from Godot's Project Settings.
