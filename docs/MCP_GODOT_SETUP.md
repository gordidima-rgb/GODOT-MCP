# MCP Godot Setup

This project has a local Godot MCP server in `tools/mcp-godot/`. It is designed as a safe base first: scan, scene/script/node operations, imports, and validation before any real asset generation.

## Current Project Scan Notes

- `project.godot` is in the project root.
- The project declares Godot feature `4.6`, so use Godot 4.x APIs only.
- The asset folder currently exists on disk as `Assets/` because Windows paths are case-insensitive. The MCP tools accept `assets/...` paths, but do not rename folders automatically.
- Existing safe structure includes `addons/`, `tools/mcp-godot/`, `generation_jobs/`, `docs/`, and generated asset folders.

## MCP Servers

Context7 MCP is expected in Codex config as:

```powershell
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

The local Godot MCP server runs with Node.js over stdio:

```powershell
& 'C:\Users\gdima\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\gdima\Documents\learn-personal\tools\mcp-godot\src\server.mjs' --project-root 'C:\Users\gdima\Documents\learn-personal'
```

Restart Codex after changing `C:\Users\gdima\.codex\config.toml`.

## Available MCP Tools

- `godot_help`
- `godot_bridge_status`
- `godot_project_scan`
- `godot_list_scenes`
- `godot_read_scene`
- `godot_create_scene`
- `godot_add_node`
- `godot_update_node`
- `godot_attach_script`
- `godot_create_script`
- `godot_import_image`
- `godot_generate_sprite`
- `godot_generate_texture`
- `godot_import_3d_model`
- `godot_generate_3d_model`
- `godot_run_project`
- `godot_check_errors`

## Provider Defaults

Use `.env` for provider settings. The safe default is:

```text
IMAGE_PROVIDER=none
MODEL_3D_PROVIDER=none
```

When provider is `none`, no real asset generation happens. The MCP server writes a JSON prompt job into:

- `generation_jobs/images/`
- `generation_jobs/models/`

Provider notes:

- `openai` image generation reads `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL` from `.env` or environment variables.
- `custom_http` image generation posts JSON to `CUSTOM_IMAGE_HTTP_URL`.
- `polza_ai`, `local_comfyui`, `tripo`, and `meshy` are declared as provider interfaces. They queue jobs until a concrete adapter contract is configured.
- 3D model providers currently queue jobs by design unless a project-specific adapter is added.

Image adapters live in `tools/mcp-godot/src/provider_adapters/`. This keeps provider-specific HTTP/API code separate from the MCP tool definitions.

## Run The Smoke Test

```powershell
& 'C:\Users\gdima\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\tools\mcp-godot\test\smoke.mjs'
```

Expected result:

```text
mcp-godot smoke test passed
```

## Simple Safe Example

1. Run `godot_project_scan` to confirm the project is visible.
2. Run `godot_create_script` with `path: "scripts/example.gd"`.
3. Run `godot_create_scene` with `path: "scenes/example.tscn"` and `root_type: "Node2D"`.
4. Run `godot_attach_script` with `scene_path: "scenes/example.tscn"`, `node_path: "."`, and `script_path: "scripts/example.gd"`.
5. Run `godot_add_node` with a simple child like `Sprite2D`.
6. Run `godot_read_scene` for `scenes/example.tscn`.
7. Run `godot_check_errors`.

If Godot CLI is not on PATH, `check_errors` still runs static validation and reports that the editor check was skipped.

## Security Notes

- Paths are normalized and must stay inside the project root.
- Existing files are not overwritten unless `overwrite: true` is passed.
- `.env` is ignored by Git.
- Logs are sanitized for common key/token/secret values.
- Arbitrary shell commands are not exposed.
- Direct `.tscn` editing is intentionally limited. For richer editor-side scene work, enable `addons/ai_mcp_bridge/` in Godot and use its localhost bridge.
- Set `GODOT_MCP_READ_ONLY=true` to block write/run/generation tools while keeping inspection tools available.

## Editor Bridge

Enable `AI MCP Bridge` in `Project > Project Settings > Plugins`.

The dock can start a localhost TCP bridge on `127.0.0.1:8765`. It accepts small JSON commands such as:

```json
{"command":"status"}
```

The bridge uses Godot API inside the editor for safe scene/script/node operations. It is intentionally local-only and does not expose arbitrary shell commands.

## AI Instruction Panel

The same dock has a small instruction workspace:

1. Choose the client preset: `Codex`, `Visual Studio / VS Code`, or `Claude`.
2. Write the instruction for the AI agent.
3. Press `Save instruction` to write `docs/AI_AGENT_INSTRUCTIONS.md`.
4. Press `Save client setup` to write `docs/AI_CLIENT_SETUP.md`.

This lets you prepare a reusable prompt and client setup notes without leaving Godot. The saved files are plain Markdown, so they can be reviewed before giving them to any AI client.
