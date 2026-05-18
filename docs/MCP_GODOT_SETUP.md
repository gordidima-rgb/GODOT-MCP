# MCP Godot Setup

This project has a local Godot MCP server in `tools/mcp-godot/`. It is designed as a safe base first: scan, scene/script/node operations, imports, and validation before any real asset generation.

## Current Project Scan Notes

- `project.godot` is in the project root.
- The project declares Godot feature `4.6`, so use Godot 4.x APIs only.
- The asset folder currently exists on disk as `Assets/` because Windows paths are case-insensitive. The MCP tools accept `assets/...` paths, but do not rename folders automatically.
- Existing safe structure includes `addons/`, `tools/mcp-godot/`, `generation_jobs/`, `docs/`, and generated asset folders.

## Install In One Command On Windows

Open PowerShell in the folder that contains your `project.godot`, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Join-Path $env:TEMP 'install-godot-mcp.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/gordidima-rgb/GODOT-MCP/main/tools/install-godot-mcp.ps1' -OutFile $s; & $s -ProjectPath (Get-Location)"
```

The installer copies:

- `addons/ai_mcp_bridge/`
- `tools/mcp-godot/`
- `.env.example`, if your project does not have one yet

It also enables the editor plugin in `project.godot`, saves a `project.godot.godot-mcp-backup-*` backup, runs the MCP smoke test when Node.js is available, and writes `godot-mcp.codex.toml` with the correct paths for your computer.

## MCP Servers

Context7 MCP is expected in Codex config as:

```powershell
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

The local Godot MCP server runs with Node.js over stdio:

```powershell
node .\tools\mcp-godot\src\server.mjs --project-root .
```

For Codex, copy the `[mcp_servers.godotMCP]` block from `godot-mcp.codex.toml` into your Codex config. On Windows, that config is usually:

```powershell
$env:USERPROFILE\.codex\config.toml
```

Restart Codex after changing the config.

## Add Godot To PATH

Installers and zipped Godot builds do not always add Godot to `PATH`. Add it before relying on MCP tools that run the editor:

```powershell
godot --version
```

If that command is not found on Windows, add the folder that contains `Godot_v4.x-stable_win64.exe` to the user `PATH`, then restart Codex, Godot, and your terminal.

Example for a downloaded Godot executable in `C:\Path\To\Godot`:

```powershell
$godotFolder = "C:\Path\To\Godot"
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";$godotFolder",
  "User"
)
```

Then either rename/copy the executable so it can be called as `godot`, or set `.env` explicitly:

```text
GODOT_CLI=C:\Path\To\Godot\Godot_v4.x-stable_win64.exe
```

After this, `godot_check_errors` can run a real headless editor check and `godot_run_project` can launch scenes. Without it, the MCP server falls back to static validation only.

## Available MCP Tools

- `godot_help`
- `godot_bridge_status`
- `godot_editor_scene_snapshot`
- `godot_project_scan`
- `godot_list_scenes`
- `godot_read_scene`
- `godot_create_scene`
- `godot_add_node`
- `godot_update_node`
- `godot_attach_script`
- `godot_create_script`
- `godot_create_input_action`
- `godot_create_autoload`
- `godot_create_material`
- `godot_install_third_person_controller`
- `godot_create_third_person_prototype`
- `godot_install_first_person_controller`
- `godot_create_first_person_prototype`
- `godot_import_image`
- `godot_generate_sprite`
- `godot_generate_texture`
- `godot_import_3d_model`
- `godot_generate_3d_model`
- `godot_run_project`
- `godot_runtime_status`
- `godot_stop_project`
- `godot_capture_screenshot`
- `godot_capture_editor_viewport`
- `godot_check_errors`

Runtime tools:

- `godot_run_project` starts the game through Godot CLI, or through the editor bridge with `mode: "editor"`.
- `godot_runtime_status` reports the tracked CLI game process and, when the dock bridge is running, whether the editor is playing a scene.
- `godot_stop_project` stops a tracked CLI launch or asks the editor bridge to stop the current play session.
- `godot_capture_screenshot` uses Godot Movie Maker with `--write-movie` and `--quit-after` to save a PNG screenshot/sequence inside `docs/assets/screenshots/runtime/`.
- `godot_editor_scene_snapshot` asks the Godot dock bridge what scene is currently open and returns the node tree.
- `godot_capture_editor_viewport` saves the current 2D or 3D editor viewport to `docs/assets/screenshots/editor/`.

Debug workflow:

- After gameplay script changes, run the game or target scene, inspect the Godot console output, fix project errors, and rerun until the latest console has no errors.
- After placing visible scene objects, run the scene, capture a screenshot, inspect placement/visibility/scale/framing, fix issues, and repeat the screenshot check until it looks correct.
- Run `godot_help` with `category: "debug"` for the exact tool chain.

Character prototype tools:

- `godot_install_third_person_controller` installs Jeh3no `addons/PlayerCharacter` from GitHub and copies sibling `addons/Arts` dependencies by default.
- `godot_create_third_person_prototype` creates a starter 3D scene that instances `res://addons/PlayerCharacter/...` instead of creating a simple capsule placeholder.
- `godot_install_first_person_controller` installs Jeh3no's advanced state-machine first-person controller from `Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller`, copies `addons/PlayerCharacter` plus `addons/Arts`, and preserves upstream license files when present.
- `godot_create_first_person_prototype` creates a starter FPS scene that instances Jeh3no `res://addons/PlayerCharacter/player_character_scene.tscn`, adds the controller input actions, and writes scene metadata crediting Jeh3no.
- Use `source_path` when you already have a project-local checkout of `Jeh3no/Godot-Third-Person-Controller` and want an offline install.
- Use `source_path` with `Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller` for offline first-person installs.

## Provider Defaults

Use `.env` for provider settings. The safe default is:

```text
IMAGE_PROVIDER=none
MODEL_3D_PROVIDER=none
AI_CHAT_PROVIDER=none
```

When provider is `none`, no real asset generation happens. The MCP server writes a JSON prompt job into:

- `generation_jobs/images/`
- `generation_jobs/models/`
- `generation_jobs/chat/`

Provider notes:

- `openai` image generation reads `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL` from `.env` or environment variables.
- `custom_http` image generation posts JSON to `CUSTOM_IMAGE_HTTP_URL`.
- `polza_ai`, `local_comfyui`, `tripo`, and `meshy` are declared as provider interfaces. They queue jobs until a concrete adapter contract is configured.
- 3D model providers currently queue jobs by design unless a project-specific adapter is added.

Image adapters live in `tools/mcp-godot/src/provider_adapters/`. This keeps provider-specific HTTP/API code separate from the MCP tool definitions.

The Godot editor chat panel reads these optional variables:

```text
AI_CHAT_PROVIDER=none
AI_CHAT_BASE_URL=http://127.0.0.1:1234/v1
AI_CHAT_API_KEY=
AI_CHAT_MODEL=
AI_CHAT_TEMPERATURE=0.2
AI_CHAT_SYSTEM_PROMPT=You are an AI assistant embedded in the Godot editor.
```

Set `AI_CHAT_PROVIDER=openai_compatible` to call a local or remote OpenAI-compatible `/chat/completions` endpoint. Leave it as `none` to save chat prompts as JSON jobs without network access.

## Run The Smoke Test

```powershell
node .\tools\mcp-godot\test\smoke.mjs
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

Useful bridge commands exposed through MCP:

- `status`
- `scene_snapshot`
- `play_project`
- `stop_project`
- `capture_editor_viewport`
- `create_script`
- `create_scene`
- `add_node`
- `update_node`
- `attach_script`

If the dock does not appear:

1. Disable and enable `AI MCP Bridge` again in `Project > Project Settings > Plugins`.
2. Check the right-side dock tabs near `Inspector`, `Signals`, and `Groups`.
3. Use `Project > Tools > AI MCP Bridge: reload dock`.
4. Open the bottom `Output` panel and look for `AI MCP Bridge plugin loaded`.
5. If the tab is still missing, restart the Godot editor so it reloads editor plugin scripts.

## AI Instruction Panel

The same dock has a small instruction workspace:

1. Choose the client preset: `Codex`, `Visual Studio / VS Code`, or `Claude`.
2. Write the instruction for the AI agent.
3. Press `Save instruction` to write `docs/AI_AGENT_INSTRUCTIONS.md`.
4. Press `Save client setup` to write `docs/AI_CLIENT_SETUP.md`.

This lets you prepare a reusable prompt and client setup notes without leaving Godot. The saved files are plain Markdown, so they can be reviewed before giving them to any AI client.

## Editor Chat Panel

The dock includes an editor chat panel for local AI/API providers.

1. Copy `.env.example` to `.env`.
2. Keep `AI_CHAT_PROVIDER=none` for offline queue mode, or set `AI_CHAT_PROVIDER=openai_compatible`.
3. Fill `AI_CHAT_BASE_URL` and `AI_CHAT_MODEL`.
4. Set `AI_CHAT_API_KEY` only if your provider requires it.
5. Press `Reload .env` in the Godot dock.
6. Write a prompt and press `Send`.

When the provider is `none`, `Send` and `Queue` save a JSON file in `generation_jobs/chat/`. The chat panel never writes secrets to logs.
