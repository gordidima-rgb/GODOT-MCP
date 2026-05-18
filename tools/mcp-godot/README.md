# Local Godot MCP Server

This is a local stdio MCP server for the current Godot 4 project. It works without npm installs and only uses Node.js built-ins.

The server is instruction-first. Codex, Claude, or another AI client should plan and write the project-specific solution. The JavaScript tools are safe primitives for scan/read/write/import/generation jobs/runtime validation.

For complex or unfamiliar gameplay mechanics, the AI client should use `godot_agent_instructions` with `workflow: "research_mechanic"`, search GitHub, YouTube, Godot docs, and credible web sources first, then adapt the best Godot 4 pattern.

## What It Can Do

For Codex, Claude, and other MCP clients, the full tool map lives in [`../../docs/MCP_CAPABILITIES.md`](../../docs/MCP_CAPABILITIES.md).

- Scan the project with scenes, scripts, resources, textures, materials, and models.
- List `.tscn` and `.scn` scenes.
- Read text `.tscn` scenes and summarize node structure.
- Create `.tscn` scenes with safe root node types.
- Add/update nodes in text `.tscn` scenes.
- Create and attach GDScript files.
- Install Jeh3no PlayerCharacter and create third-person character prototype scenes without capsule placeholders.
- Install Jeh3no advanced first-person PlayerCharacter and create FPS prototype scenes without capsule placeholders.
- Import project-local images and 3D models.
- Generate or queue sprite/texture/model jobs through provider interfaces, including Meshy, Tripo, and custom HTTP 3D model providers.
- Run, stop, and check the project with Godot CLI when available.
- Capture PNG game screenshots through Godot Movie Maker.
- Ask the editor bridge what is open in the current scene.

## Tool Names

- `godot_help`
- `godot_agent_instructions`
- `godot_doctor`
- `godot_codex_config`
- `godot_bridge_status`
- `godot_editor_scene_snapshot`
- `godot_project_scan`
- `godot_search_project`
- `godot_list_scenes`
- `godot_list_scripts`
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
- `godot_list_generation_jobs`
- `godot_update_generation_job_status`
- `godot_run_project`
- `godot_runtime_status`
- `godot_stop_project`
- `godot_capture_screenshot`
- `godot_capture_editor_viewport`
- `godot_check_errors`

Start with:

```text
godot_agent_instructions
godot_help
godot_project_scan
godot_bridge_status
```

Set `GODOT_MCP_READ_ONLY=true` to expose the same tool list while blocking write/run/generation tools at execution time.

## 3D Model Providers

Keep real keys in `.env`, or set them from the `AI MCP Bridge` dock:

```text
MODEL_3D_PROVIDER=meshy
MESHY_API_KEY=your_key_here
MESHY_QUALITY=preview
```

Supported 3D provider names are `none`, `meshy`, `tripo`, and `custom_http`. `none` writes a JSON job only. `meshy` and `tripo` call their text-to-3D APIs, download a GLB into `assets/generated/models/`, and save a `.glb.meta.json` sidecar with prompt, source, and license notes. `custom_http` posts `{ prompt, output_format: "glb", options }` and accepts a binary GLB, a URL field, or base64 model data.

Use `godot_help` with `category: "debug"` for mandatory validation rules:

- after gameplay script changes, run the game or target scene, inspect the Godot console, fix errors, and rerun until the latest console has no errors;
- after placing visible scene objects, capture a screenshot and inspect placement, scale, visibility, and framing before finishing.

For third-person or character prototype tasks, use `godot_install_third_person_controller` and `godot_create_third_person_prototype`. These tools use Jeh3no's `addons/PlayerCharacter` controller and avoid capsule-only player placeholders.

For first-person or FPS prototype tasks, use `godot_install_first_person_controller` and `godot_create_first_person_prototype`. These tools use scenes, scripts, input defaults, and assets from `Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller`, keep available upstream license files, and add Jeh3no attribution to generated prototype scene metadata.

## Run A Smoke Test

From the project root:

```powershell
node .\tools\mcp-godot\test\smoke.mjs
```

## Codex Config

Run `tools/install-godot-mcp.ps1` or review `tools/mcp-godot/mcp-config.example.toml`, then copy the entries into your Codex config.

On Windows, the config is usually:

```text
%USERPROFILE%\.codex\config.toml
```

Replace `<PROJECT_ROOT>` in examples with the folder that contains `project.godot`.

Restart Codex after editing MCP config so the new servers can load.

## Safety Model

The server treats `res://` as the project root. Every read and write path is resolved before use and must stay inside that root. Write tools refuse to replace existing files unless `overwrite: true` is passed.

The server does not expose arbitrary shell commands. External execution is limited to whitelisted Godot CLI shapes:

```text
godot --headless --path <project-root> --quit
godot --headless --editor --path <project-root> --quit
godot --headless --path <project-root> --import
godot --path <project-root>
godot --path <project-root> --scene <project-scene-path>
godot --path <project-root> --write-movie <project-png-path> --quit-after <frames>
godot --path <project-root> --scene <project-scene-path> --write-movie <project-png-path> --quit-after <frames>
```

Direct file editing supports text `.tscn` scenes only. Binary `.scn` scenes should be managed through the Godot editor bridge.

## Editor Bridge

Enable `addons/ai_mcp_bridge/` in Godot and press Start in the dock. Then `godot_bridge_status` checks the localhost bridge at `127.0.0.1:8765` by default.

Bridge-backed tools include editor scene snapshots, editor play/stop, and editor viewport screenshots. CLI-backed runtime tools include tracked run/stop and Movie Maker screenshots.

This follows the same broad pattern used by mature Godot MCP projects: MCP stdio for the AI client, and a local editor-side bridge for operations that are safer through Godot's own API.
