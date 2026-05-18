# GODOT-MCP Agent Rules

This repository is a Godot 4.x MCP bridge and local AI-agent tool layer. Treat `project.godot`, `res://` paths, and the MCP tool responses as the source of truth for project context.

## Operating Model

GODOT-MCP is **instruction-first**:

1. The AI client plans the Godot work.
2. The AI client writes or reviews Godot-specific content.
3. MCP tools provide safe project primitives for reading, writing, importing, running, and validating.
4. The agent must inspect before editing and validate after editing.

Use the canonical universal skills in `.agents/skills/`. Client-specific notes live in `.agents/clients/`. Codex compatibility wrappers live in `.codex/skills/`.

## Permanent Rules

- Use Godot 4.x APIs only. Do not use Godot 3.x API names or patterns unless explicitly adapting legacy code and explaining the conversion.
- Start with `godot_doctor` and `godot_project_scan` before making project changes.
- Use `dry_run` before non-trivial scene, script, input, asset, or prototype changes.
- Do not delete existing files unless the user gives a separate explicit command.
- Keep all project changes inside this project folder.
- Store API keys and provider secrets only in `.env` or environment variables.
- Never commit real keys, tokens, passwords, cookies, private endpoints, or paid-provider credentials.
- Prefer provider `none` for image and 3D generation unless the user explicitly wants a configured real provider.
- When provider is `none`, save a reviewable job file instead of calling a real generator.
- After changes, report every file created or changed.
- Prefer safe, small, reversible changes over broad rewrites.

## Required Validation

- After changing gameplay scripts, run `godot_check_errors` and, when Godot is available, run the game or target scene.
- Inspect the latest Godot console output after runtime changes.
- Fix errors and repeat until the latest run has no project errors.
- After adding, moving, scaling, importing, or generating visible scene objects, capture a screenshot and inspect placement, visibility, scale, clipping, material/import issues, and camera framing.
- If Godot CLI, editor bridge, or screenshot capture is unavailable, state that limitation clearly.

## Godot Conventions

- Use `res://` paths for Godot-facing references.
- Put scenes in `scenes/`.
- Put gameplay scripts in `scripts/`.
- Put editor plugins in `addons/`.
- Put generated assets in `assets/generated/`.
- Put generated sprites in `assets/generated/sprites/`.
- Put generated textures in `assets/generated/textures/`.
- Put generated 3D models in `assets/generated/models/`.
- Put source prompts in `assets/source/prompts/`.
- Keep editor tooling in `addons/` or `tools/`; keep runtime gameplay scripts separate.

## Canonical Skills

Use these skills when the task matches their scope:

- `.agents/skills/godot-mcp-core/SKILL.md`
- `.agents/skills/godot-setup/SKILL.md`
- `.agents/skills/godot-project-scan/SKILL.md`
- `.agents/skills/godot-scene-editing/SKILL.md`
- `.agents/skills/godot-debug-validation/SKILL.md`
- `.agents/skills/godot-assets-generation/SKILL.md`
- `.agents/skills/godot-character-prototypes/SKILL.md`

## Client Notes

Use the client note that matches the current host application:

- `.agents/clients/codex.md`
- `.agents/clients/claude.md`
- `.agents/clients/cursor.md`
- `.agents/clients/cline.md`
- `.agents/clients/continue.md`

## Codex Compatibility

`.codex/skills/` contains thin Codex-facing wrappers. Do not duplicate the full skill logic there. Keep the canonical rules in `.agents/skills/` and only add Codex-specific setup notes in `.codex/skills/`.
