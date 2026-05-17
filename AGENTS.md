# Project Agent Rules

This repository is a Godot 4.x project. Treat `project.godot` and `res://` as the source of truth for project paths.

## Permanent Rules

- Use Godot 4.x APIs only. Do not use Godot 3.x API names or patterns.
- Do not delete existing files unless the user gives a separate explicit command.
- Keep all project changes inside this project folder.
- Store API keys and provider secrets only in `.env`.
- Never commit real keys, tokens, passwords, cookies, or private endpoints.
- After changes, report the files that were created or changed.
- Write code with short beginner-friendly comments where they help explain the intent.
- Prefer safe, small, reversible changes over broad rewrites.
- Use provider `none` as the default for image and 3D generation. When provider is `none`, save a job file instead of calling a real generator.

## Godot Conventions

- Use `res://` paths for Godot-facing references.
- Put scenes in `scenes/`, scripts in `scripts/`, editor plugins in `addons/`, generated assets in `assets/generated/`, and source prompts in `assets/source/prompts/`.
- Keep editor tooling in `addons/` or `tools/`; keep runtime gameplay scripts separate.
- Validate with Godot CLI when available; otherwise run static checks and clearly say what could not be verified.
