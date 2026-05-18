# MCP Capabilities For Codex And Claude

This file is the compact tool map for AI clients. It describes the MCP tools exposed by `tools/mcp-godot`, how to choose them, and what validation is required before reporting work as done.

The capabilities below are part of the Godot MCP tool itself. They are not local Codex skills.

GODOT-MCP is now instruction-first. Codex, Claude, or another AI client should do most project-specific thinking and content creation. The JavaScript MCP server provides safe primitives for project scan/read/write/import/generation/validation. See `docs/MCP_AGENT_INSTRUCTIONS.md` for the operating model.

## Start Here

For every new task, Codex, Claude, or another MCP client should begin with:

```text
godot_agent_instructions({ "client": "codex", "task": "<user task>" })
godot_help({ "category": "overview" })
godot_doctor({})
godot_project_scan({})
godot_check_errors({})
```

For a specific user request, ask the helper for a chain:

```text
godot_help({ "task": "create first person prototype" })
godot_help({ "category": "debug" })
godot_help({ "category": "generation" })
```

Use `res://` and project-local paths. Keep all changes inside the folder that contains `project.godot`.

## Capability Groups

### Discovery And Client Setup

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_help` | No | The client needs a tool map, workflow chain, category summary, safety notes, or a usage template. |
| `godot_agent_instructions` | No | Codex, Claude, or another AI client needs instruction-first guidance for a user task. |
| `godot_doctor` | No | The client needs a beginner-friendly health check for Node, Godot CLI, bridge reachability, providers, folders, and recommendations. |
| `godot_codex_config` | No | Codex needs ready-to-paste TOML for the current project root. |

### Instruction-First Split

| Owner | Responsibilities |
| --- | --- |
| AI client | Understand the user request, research complex or unfamiliar mechanics online first, choose Godot 4 architecture, write GDScript and scene content, decide workflow, review tool results, run required validation loops, explain changed files. |
| MCP JS tools | Enforce project-root sandboxing, provide scan/search/read primitives, apply small guarded writes, import assets, queue/call configured providers, run Godot/editor bridge checks, return structured errors. |

### Editor Bridge

These tools use the optional `addons/ai_mcp_bridge` Godot EditorPlugin. The bridge listens only on localhost.

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_bridge_status` | No | Check whether the Godot editor bridge is running. |
| `godot_editor_scene_snapshot` | No | Read the open editor scene tree and selected nodes. |
| `godot_capture_editor_viewport` | Yes | Save a 2D or 3D editor viewport screenshot into the project. |

### Project Inspection

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_project_scan` | No | Build a project overview: folders, scenes, scripts, resources, textures, materials, models, and assets. |
| `godot_search_project` | No | Search safe text files without reading `.env` or dotfiles. |
| `godot_list_scenes` | No | Find `.tscn` and `.scn` files. |
| `godot_list_scripts` | No | Find `.gd` scripts and summarize `extends` and `class_name`. |
| `godot_read_scene` | No | Parse a text `.tscn` scene and inspect its node tree. |
| `godot_check_errors` | No | Run static validation and, when Godot CLI is available, a headless Godot check. |

### Scene, Script, And Project Edits

Use dry runs before larger edits. Direct scene editing supports text `.tscn` files. Binary `.scn` files need the editor bridge or manual editor work.

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_create_scene` | Yes | Create a text `.tscn` scene with an allowed Godot 4 root node. Supports `dry_run`. |
| `godot_add_node` | Yes | Add a child node to a text `.tscn` scene. Supports `dry_run`. |
| `godot_update_node` | Yes | Update safe basic node properties in a text `.tscn` scene. Supports `dry_run`. |
| `godot_attach_script` | Yes | Attach an existing or new GDScript to a scene node. Supports `dry_run`. |
| `godot_create_script` | Yes | Create a beginner-readable Godot 4 GDScript file. Supports `dry_run`. |
| `godot_create_input_action` | Yes | Add or update an action in `project.godot`. |
| `godot_create_autoload` | Yes | Add or update a script autoload in `project.godot`. |
| `godot_create_material` | Yes | Create a simple text material resource. |

### Character Prototypes

For character prototypes, do not create a plain capsule player.

| Intent | Required chain |
| --- | --- |
| Generic "character prototype" or third-person prototype | `godot_install_third_person_controller`, then `godot_create_third_person_prototype`. |
| Explicit first-person, FPS, or "ot pervogo litsa" prototype | `godot_install_first_person_controller`, then `godot_create_first_person_prototype`. |

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_install_third_person_controller` | Yes | Install Jeh3no `addons/PlayerCharacter` from `Jeh3no/Godot-Third-Person-Controller`, including sibling `addons/Arts` by default. |
| `godot_create_third_person_prototype` | Yes | Create a scene that instances the installed Jeh3no third-person PlayerCharacter. |
| `godot_install_first_person_controller` | Yes | Install Jeh3no `addons/PlayerCharacter` and `addons/Arts` from `Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller`. |
| `godot_create_first_person_prototype` | Yes | Create a scene that instances `res://addons/PlayerCharacter/player_character_scene.tscn` and adds first-person input actions. |

Always mention the Jeh3no source in user-facing summaries when these controller tools are used. The MCP tool results include repository/source/license notes, and generated prototype scenes include metadata crediting Jeh3no.

### Assets And Generation

Provider `none` is the safe default. It writes a reviewable job JSON and does not call a real API.

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_import_image` | Yes | Copy a project-local image into an asset folder and optionally run a Godot import pass. |
| `godot_generate_sprite` | Yes | Generate or queue a sprite prompt. |
| `godot_generate_texture` | Yes | Generate or queue a texture prompt. |
| `godot_import_3d_model` | Yes | Copy a project-local `.glb`, `.gltf`, `.fbx`, or `.obj` model into the project. |
| `godot_generate_3d_model` | Yes | Generate or queue a 3D model prompt with `none`, `meshy`, `tripo`, or `custom_http`. |
| `godot_list_generation_jobs` | No | Review queued, completed, or failed image/model/chat jobs. |
| `godot_update_generation_job_status` | Yes | Mark a generation job as queued, in progress, done, failed, or canceled. |

Supported image providers:

- `none`
- `openai`
- `polza_ai`
- `local_comfyui`
- `custom_http`

Supported 3D model providers:

- `none`
- `meshy`
- `tripo`
- `custom_http`

Secrets must stay in `.env` or environment variables. Do not paste API keys into prompts, scene files, docs, logs, or generated metadata.

### Runtime, Debug, And Screenshots

| Tool | Mutates | Use when |
| --- | --- | --- |
| `godot_run_project` | Yes | Run the project or a scene through Godot CLI, or ask the editor bridge to play it. Defaults to `dry_run: true`. |
| `godot_runtime_status` | No | Check a tracked CLI game process and optional editor play state. |
| `godot_stop_project` | Yes | Stop a tracked CLI run or editor bridge play session. |
| `godot_capture_screenshot` | Yes | Save a runtime PNG through Godot Movie Maker. |

Required validation:

- If gameplay scripts changed, run the game or target scene, inspect the Godot console, fix errors, and rerun until the latest console output is clean.
- If visible objects were added, moved, scaled, imported, or arranged in a scene, run the scene, capture a screenshot, inspect placement, visibility, scale, and framing, then fix and repeat when needed.
- If Godot CLI or the editor bridge is unavailable, report the validation limit clearly instead of pretending the runtime check passed.

## Common Workflows

### Inspect A Project

```text
godot_doctor
godot_project_scan
godot_list_scenes
godot_list_scripts
godot_check_errors
```

### Create A Simple Scene

```text
godot_project_scan
godot_create_script({ "dry_run": true })
godot_create_scene({ "dry_run": true })
godot_create_script
godot_create_scene
godot_attach_script
godot_add_node
godot_read_scene
godot_check_errors
```

### Implement A Complex Or Unfamiliar Mechanic

```text
godot_agent_instructions({ "workflow": "research_mechanic", "task": "<complex mechanic>" })
search GitHub, YouTube, Godot docs, and credible web sources
compare source quality, Godot version, and license notes
godot_project_scan
dry-run planned writes
implement the adapted Godot 4 pattern
godot_check_errors
run the game and inspect the console when gameplay scripts changed
capture a screenshot when visible placement changed
```

### Create A Third-Person Prototype

```text
godot_doctor
godot_project_scan
godot_install_third_person_controller
godot_create_third_person_prototype
godot_read_scene
godot_check_errors
```

### Create A First-Person Or FPS Prototype

```text
godot_doctor
godot_project_scan
godot_install_first_person_controller
godot_create_first_person_prototype
godot_read_scene
godot_check_errors
```

### Generate Assets Safely

```text
godot_help({ "category": "generation" })
godot_generate_sprite({ "provider": "none" })
godot_generate_texture({ "provider": "none" })
godot_generate_3d_model({ "provider": "none" })
godot_list_generation_jobs
```

### Runtime Debug Loop

```text
godot_check_errors
godot_run_project({ "dry_run": true })
godot_run_project({ "dry_run": false, "wait_ms": 3000 })
godot_runtime_status
godot_stop_project
godot_check_errors
```

### Visual Placement Check

```text
godot_check_errors
godot_capture_screenshot
inspect the PNG
fix placement if needed
godot_capture_screenshot again
```

Use `godot_capture_editor_viewport` instead when the task specifically needs the current editor viewport.

## Safety Rules For AI Clients

- Treat the folder with `project.godot` as the project root and `res://` source of truth.
- Use Godot 4.x APIs only.
- Prefer `dry_run: true` before writing scene/script changes.
- Do not delete files or nodes unless a human gives a separate explicit command.
- Keep secrets only in `.env`.
- Never commit real keys, tokens, cookies, passwords, or private endpoints.
- Keep provider `none` as the default for image and 3D generation.
- When `GODOT_MCP_READ_ONLY=true`, write/run/generation tools still appear in `tools/list`, but execution is blocked.
- Report every created or changed file after edits.

## Suggested Client Prompt

Paste this into Codex, Claude, or another MCP client after connecting the server:

```text
Use docs/MCP_AGENT_INSTRUCTIONS.md and docs/MCP_CAPABILITIES.md as the Godot MCP tool map. First call godot_agent_instructions for my task, then godot_help with category overview, godot_doctor, godot_project_scan, and godot_check_errors. Plan and write the solution in the AI client; use MCP JS tools only as safe primitives. For complex or unfamiliar mechanics, search GitHub, YouTube, Godot docs, and credible web sources before implementing, then cite source links/licenses. Use dry runs before scene/script writes. If gameplay scripts changed, run the game and inspect the Godot console. If visible objects changed, capture a screenshot and inspect placement. Keep provider none unless I explicitly configure a provider in .env.
```
