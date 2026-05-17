---
name: asset-pipeline-2d-3d
description: Manage 2D and 3D assets for Godot projects. Use when importing images, models, materials, textures, or organizing generated assets after project/MCP foundations are stable.
---

# Asset Pipeline 2D 3D

## Workflow

1. Do not generate assets before project scan, scene operations, script creation, import image, and error checks are working.
2. Import source assets into `assets/` or a more specific child folder.
3. Keep generated and source assets clearly named.
4. Preserve Godot `.import` files when they already exist.
5. Never modify binary files with text tools.

## Image Imports

Accept common image formats (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) and copy them into `res://assets/...` through a safe path resolver.

## 3D Imports

Prefer `.glb`/`.gltf` for Godot 4 compatibility. Use `.blend` only when the local project/editor setup supports it.
