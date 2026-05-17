---
name: model-3d-generation-provider
description: Define provider interfaces for AI 3D model generation in Godot asset workflows. Use when adding model-generation adapters, GLB/GLTF output contracts, preview metadata, or deferred import steps after MCP basics are stable.
---

# Model 3D Generation Provider

## Workflow

1. Keep 3D generation behind a provider interface.
2. Prefer `.glb` output for Godot 4.
3. Store generated models under `res://assets/generated/models/` by default.
4. Record prompt, provider, license/source, and scale assumptions in sidecar metadata when possible.
5. Defer model generation until project scan, scene/script tooling, image import, and error checks work.

## Interface Shape

Provider adapters should expose:

- `name`
- `capabilities`
- `generate_model(request)`
- `validate_request(request)`

## Validation

After generation, verify the file exists, extension is supported, and Godot can import it when the editor/headless binary is available.
