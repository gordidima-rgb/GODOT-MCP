# image-generation-provider

## When To Use

Use this skill when adding or using image generation provider interfaces for sprites, textures, references, or prompt jobs.

## Rules

- Supported providers: `none`, `openai`, `polza_ai`, `local_comfyui`, `custom_http`.
- Default to `none`.
- If provider is `none`, write a prompt job into `generation_jobs/images/`.
- Keep generated image outputs under `assets/generated/sprites/` or `assets/generated/textures/`.

## Limits

- Do not call network providers without explicit user approval and credentials in `.env`.
- Do not print API keys.
- Do not commit real provider secrets.

## Result Checklist

- Provider value is valid.
- `none` provider created a job file instead of generating.
- Secrets were not logged.
- Output or job path is reported.
