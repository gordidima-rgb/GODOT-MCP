# asset-pipeline-2d-3d

## When To Use

Use this skill when importing, organizing, or validating 2D images, textures, prompts, or 3D model files.

## Rules

- Keep generated outputs under `assets/generated/`.
- Keep prompt/source materials under `assets/source/prompts/`.
- Prefer `.png`, `.webp`, `.svg` for images and `.glb`/`.gltf` for 3D models.
- Preserve Godot `.import` files when they already exist.

## Limits

- Do not generate new images or models before the user asks.
- Do not edit binary assets as text.
- Do not import files from outside the project through unsafe paths.

## Result Checklist

- Asset path is inside the project.
- Extension is supported.
- Copy/import action did not overwrite without permission.
- Job or asset metadata is stored when useful.
