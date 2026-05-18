# Instruction-First MCP Structure

GODOT-MCP should be used as an instruction-first assistant for Codex, Claude, or any other MCP-capable AI client.

That means the AI client does most of the thinking and project-specific work. The JavaScript MCP server stays small and safe: it exposes project primitives for scanning, reading, writing small files, importing assets, queueing providers, running Godot, and checking errors.

## First Call

Start every meaningful task with:

```text
godot_agent_instructions({ "client": "codex", "task": "<user task>" })
```

Use `client: "claude"` for Claude, or `client: "generic"` for another MCP client.

Then run:

```text
godot_doctor({})
godot_project_scan({})
godot_check_errors({})
```

## What The AI Client Does

Codex, Claude, or another AI client should:

- understand the user's goal;
- choose the Godot 4 scene, node, script, asset, and validation workflow;
- write GDScript and scene content using project context;
- decide when to use third-person, first-person, asset, bridge, debug, or visual-check workflow;
- inspect tool results and choose the next safe action;
- explain created or changed files to the user.

## What MCP JavaScript Tools Do

The MCP server should keep doing the parts that need a local safety boundary:

- normalize `res://` and project-local paths;
- reject paths outside the project root;
- scan, search, list, and read safe project files;
- apply small file edits only after the AI client has decided the content;
- support `dry_run` and `overwrite` guards;
- queue generation jobs when provider is `none`;
- read provider settings from `.env` without echoing secrets;
- run Godot CLI or editor bridge commands through a strict allowlist;
- return structured errors instead of guessing.

## What Should Not Move Into JS

Do not make the MCP server responsible for broad AI decisions:

- gameplay design;
- large architecture choices;
- creative writing;
- choosing visual style;
- writing complex scripts without AI-client review;
- deciding that validation can be skipped;
- inventing API keys, endpoints, or private data.

Those choices belong to Codex, Claude, or the user's chosen AI model.

## Workflows

### Inspect

Use when the AI needs context before editing.

```text
godot_agent_instructions({ "workflow": "inspect" })
godot_doctor
godot_project_scan
godot_list_scenes
godot_list_scripts
godot_check_errors
```

### Scene Or Script Work

The AI client drafts the scene/script plan and content. MCP tools apply and validate it.

```text
godot_agent_instructions({ "workflow": "create_scene", "task": "<task>" })
godot_project_scan
godot_create_script({ "dry_run": true })
godot_create_scene({ "dry_run": true })
godot_create_script
godot_create_scene
godot_read_scene
godot_check_errors
```

### Character Prototypes

Generic character prototype requests use Jeh3no third-person data. Explicit first-person/FPS requests use Jeh3no first-person data.

```text
godot_agent_instructions({ "task": "create a character prototype" })
godot_install_third_person_controller
godot_create_third_person_prototype
godot_check_errors
```

```text
godot_agent_instructions({ "task": "create a first person prototype" })
godot_install_first_person_controller
godot_create_first_person_prototype
godot_check_errors
```

Always credit Jeh3no when those controller tools are used.

### Assets And Providers

The AI client writes or refines prompts. Provider `none` is the default and saves reviewable job files.

```text
godot_agent_instructions({ "workflow": "assets", "task": "<asset task>" })
godot_generate_sprite({ "provider": "none" })
godot_generate_texture({ "provider": "none" })
godot_generate_3d_model({ "provider": "none" })
godot_list_generation_jobs
```

Use real providers only after the user configures `.env`.

### Debug And Visual Checks

If gameplay scripts changed, the AI client must run the game or target scene when Godot is available, inspect the Godot console, fix errors, and rerun until the latest console output is clean.

If visible objects were added or moved, the AI client must capture a screenshot and inspect placement, visibility, scale, materials, clipping, and camera framing.

```text
godot_agent_instructions({ "workflow": "debug" })
godot_check_errors
godot_run_project({ "dry_run": false })
godot_runtime_status
godot_stop_project
```

```text
godot_agent_instructions({ "workflow": "visual_check" })
godot_capture_screenshot
```

If Godot CLI or the editor bridge is unavailable, report that limitation clearly.

## Recommended Prompt For AI Clients

```text
Use instruction-first Godot MCP mode. You are responsible for planning, Godot 4 API choices, GDScript, scene structure, validation decisions, and user-facing explanations. Use MCP tools only as safe project primitives for scan/read/write/import/generation jobs/runtime validation. Start with godot_agent_instructions for my task, then godot_doctor, godot_project_scan, and godot_check_errors. Use dry_run before larger writes. Keep provider none unless I explicitly configure .env. If gameplay scripts changed, run the game and inspect the console. If visible scene objects changed, capture a screenshot and inspect placement.
```
