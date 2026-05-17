# model-3d-generation-provider

## When To Use

Use this skill when adding or using 3D model generation provider interfaces for `.glb`/`.gltf` model jobs.

## Rules

- Supported providers: `none`, `tripo`, `meshy`, `custom_http`.
- Default to `none`.
- If provider is `none`, write a prompt job into `generation_jobs/models/`.
- Prefer `.glb` for Godot 4 imports.

## Limits

- Do not call external model services without explicit approval and credentials in `.env`.
- Do not import models from unsafe paths.
- Do not log secrets or private URLs with tokens.

## Result Checklist

- Provider value is valid.
- `none` provider created a job file.
- Model output path is under `assets/generated/models/`.
- 3D import validation was run when a model file exists.
