# AI Agent Instructions

Selected client: Codex / Claude

Project root: the folder that contains `project.godot`.

Work with this Godot 4.x project through the safe MCP tools.
Use `docs/MCP_CAPABILITIES.md` as the full tool map for Codex, Claude, and any other MCP client.
Use `docs/MCP_AGENT_INSTRUCTIONS.md` for instruction-first mode: the AI client plans and writes Godot-specific content; MCP JS tools are safe primitives for scan/read/write/import/generation/validation.
First inspect the project, list scenes and scripts, then make small scoped changes.
Do not delete existing files unless the user explicitly asks for it.
When creating scripts, add short comments that help a beginner understand the code.
If image or 3D generation providers are set to none, save generation jobs instead of calling external APIs.

## Recommended First Steps

1. Run `godot_help`.
2. Run `godot_agent_instructions` with the user task and client name.
3. Run `godot_doctor`.
4. Run `godot_project_scan`.
5. Run `godot_list_scenes` and `godot_list_scripts`.
6. Run `godot_check_errors`.
7. Make the smallest useful change and report created or modified files.

## Capability Map

- Discovery/setup: `godot_help`, `godot_doctor`, `godot_codex_config`.
- Instruction-first guidance: `godot_agent_instructions`.
- Bridge: `godot_bridge_status`, `godot_editor_scene_snapshot`, `godot_capture_editor_viewport`.
- Inspect: `godot_project_scan`, `godot_search_project`, `godot_list_scenes`, `godot_list_scripts`, `godot_read_scene`, `godot_check_errors`.
- Edit: `godot_create_scene`, `godot_add_node`, `godot_update_node`, `godot_attach_script`, `godot_create_script`, `godot_create_input_action`, `godot_create_autoload`, `godot_create_material`.
- Character prototypes: use Jeh3no controller tools, not capsule placeholders. Generic character prototypes use `godot_install_third_person_controller` and `godot_create_third_person_prototype`. Explicit first-person/FPS requests use `godot_install_first_person_controller` and `godot_create_first_person_prototype`.
- Assets/generation: `godot_import_image`, `godot_generate_sprite`, `godot_generate_texture`, `godot_import_3d_model`, `godot_generate_3d_model`, `godot_list_generation_jobs`, `godot_update_generation_job_status`.
- Runtime: `godot_run_project`, `godot_runtime_status`, `godot_stop_project`, `godot_capture_screenshot`.

## Required Debug Workflow

- If gameplay scripts changed, run the game or target scene, inspect the Godot console output, fix project errors, and rerun until the latest console has no errors.
- If visible objects were added or placed in a scene, run the scene, capture a screenshot, inspect placement/visibility/scale/framing, fix issues, and repeat the screenshot check until it looks correct.
- If Godot cannot run or screenshots cannot be captured in the current environment, report that validation limit clearly.
