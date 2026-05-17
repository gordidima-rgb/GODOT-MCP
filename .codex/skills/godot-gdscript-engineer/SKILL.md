---
name: godot-gdscript-engineer
description: Write and review Godot 4.x GDScript code. Use for creating scripts, validating extends/class_name choices, connecting scene scripts, and keeping generated GDScript compatible with Godot 4 APIs.
---

# Godot GDScript Engineer

## Workflow

1. Choose the narrowest correct base type in `extends`.
2. Use Godot 4 syntax: `@export`, `@onready`, typed variables where useful, and signal syntax compatible with 4.x.
3. Keep scripts small and attach them from scenes through `ExtResource` only after the file exists.
4. Avoid editor-only APIs in runtime scripts. Put editor automation under `addons/` or `tools/`.
5. After writing scripts, run available validation: Godot headless when present, otherwise static checks from the MCP server.

## Defaults

- Runtime Node script:

```gdscript
extends Node

func _ready() -> void:
    pass
```

- Editor/plugin script must use `@tool` only when it truly needs editor-time execution.

## Safety

Do not overwrite a non-empty script unless the task explicitly requires it or the caller passes an overwrite flag.
