# Local Godot MCP Server

This is a local stdio MCP server for the current Godot 4 project. It works without npm installs and only uses Node.js built-ins.

## What It Can Do

- Scan the project with scenes, scripts, resources, textures, materials, and models.
- List `.tscn` and `.scn` scenes.
- Read text `.tscn` scenes and summarize node structure.
- Create `.tscn` scenes with safe root node types.
- Add/update nodes in text `.tscn` scenes.
- Create and attach GDScript files.
- Import project-local images and 3D models.
- Generate or queue sprite/texture/model jobs through provider interfaces.
- Run dry-run project launch commands and check errors with Godot CLI when available.

## Tool Names

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

Start with:

```text
godot_help
godot_project_scan
godot_bridge_status
```

Set `GODOT_MCP_READ_ONLY=true` to expose the same tool list while blocking write/run/generation tools at execution time.

## Run A Smoke Test

From the project root:

```powershell
& 'C:\Users\gdima\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\tools\mcp-godot\test\smoke.mjs'
```

## Codex Config

Review `tools/mcp-godot/mcp-config.example.toml`, then copy the entries into:

```text
C:\Users\gdima\.codex\config.toml
```

Restart Codex after editing MCP config so the new servers can load.

## Safety Model

The server treats `res://` as the project root. Every read and write path is resolved before use and must stay inside that root. Write tools refuse to replace existing files unless `overwrite: true` is passed.

The server does not expose arbitrary shell commands. External execution is limited to whitelisted Godot CLI shapes:

```text
godot --headless --path <project-root> --quit
godot --headless --path <project-root> --import
godot --path <project-root>
godot --path <project-root> --scene <project-scene-path>
```

Direct file editing supports text `.tscn` scenes only. Binary `.scn` scenes should be managed through the Godot editor bridge.

## Editor Bridge

Enable `addons/ai_mcp_bridge/` in Godot and press Start in the dock. Then `godot_bridge_status` checks the localhost bridge at `127.0.0.1:8765` by default.

This follows the same broad pattern used by mature Godot MCP projects: MCP stdio for the AI client, and a local editor-side bridge for operations that are safer through Godot's own API.
