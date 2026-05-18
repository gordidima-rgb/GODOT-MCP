#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { createGenerationJob, generateImageWithProvider, generateModelWithProvider, IMAGE_PROVIDERS, MODEL_3D_PROVIDERS } from "./providers.mjs";
import { isAllowedGodotCli, safeFilenamePart, safeTimestamp, sanitizeForLog } from "./security.mjs";
import { SERVER_VERSION } from "./version.mjs";

const SUPPORTED_PROTOCOLS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const DEFAULT_PROTOCOL = "2025-06-18";
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_MODEL_BYTES = 256 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const MODEL_EXTENSIONS = new Set([".glb", ".gltf", ".obj", ".fbx"]);
const SCREENSHOT_EXTENSIONS = new Set([".png"]);
const SCENE_EXTENSIONS = new Set([".tscn", ".scn"]);
const SCRIPT_EXTENSIONS = new Set([".gd"]);
const MATERIAL_EXTENSIONS = new Set([".material", ".tres", ".res"]);
const RESOURCE_EXTENSIONS = new Set([".tres", ".res", ".import", ".gdshader"]);
const SKIP_DIRS = new Set([".git", ".godot", ".import", ".codex", ".agents", "node_modules"]);
const ALLOWED_ROOT_NODES = new Set(["Node2D", "Node3D", "Control", "CharacterBody2D", "CharacterBody3D"]);
const THIRD_PERSON_CONTROLLER_REPO = "Jeh3no/Godot-Third-Person-Controller";
const THIRD_PERSON_CONTROLLER_REF = "main";
const THIRD_PERSON_CONTROLLER_ROOTS = {
  player: "addons/PlayerCharacter",
  dependencies: ["addons/Arts"],
  testMap: ["addons/Map/ Scenes"]
};
const FIRST_PERSON_CONTROLLER_REPO = "Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller";
const FIRST_PERSON_CONTROLLER_REF = "main";
const FIRST_PERSON_CONTROLLER_ROOTS = {
  player: "addons/PlayerCharacter",
  dependencies: ["addons/Arts"],
  testMap: ["addons/Map"]
};
const FIRST_PERSON_OPTIONAL_LICENSE_FILES = ["addons/LICENSE"];
const FIRST_PERSON_UPSTREAM_RES_PREFIX = "res://Godot-Advanced-State-Machine-First-Person-Controller/addons/";
const FIRST_PERSON_LOCAL_RES_PREFIX = "res://addons/";
const FIRST_PERSON_CREDIT = "Uses controller, scenes, scripts, and assets from Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller.";
const FIRST_PERSON_LICENSE_NOTE = "Jeh3no's advanced first-person controller is MIT licensed upstream; keep copied LICENSE files and credit Jeh3no when using these assets.";
const THIRD_PERSON_INPUT_ACTIONS = [
  { action: "play_char_move_forward_action", events: [{ type: "key", keycode: 87, physical_keycode: 87 }] },
  { action: "play_char_move_backward_action", events: [{ type: "key", keycode: 83, physical_keycode: 83 }] },
  { action: "play_char_move_left_action", events: [{ type: "key", keycode: 65, physical_keycode: 65 }] },
  { action: "play_char_move_right_action", events: [{ type: "key", keycode: 68, physical_keycode: 68 }] },
  { action: "play_char_run_action", events: [{ type: "key", keycode: 4194325, physical_keycode: 4194325 }] },
  { action: "play_char_jump_action", events: [{ type: "key", keycode: 32, physical_keycode: 32 }] },
  { action: "play_char_ragdoll_action", events: [{ type: "key", keycode: 82, physical_keycode: 82 }] },
  { action: "play_char_mouse_mode_action", events: [{ type: "key", keycode: 4194326, physical_keycode: 4194326 }] },
  { action: "play_char_aim_cam_action", events: [{ type: "mouse_button", button_index: 2 }] },
  { action: "play_char_aim_cam_side_action", events: [{ type: "key", keycode: 71, physical_keycode: 71 }] },
  { action: "play_char_cam_zoom_in_action", events: [{ type: "mouse_button", button_index: 4 }, { type: "key", keycode: 86, physical_keycode: 86 }] },
  { action: "play_char_cam_zoom_out_action", events: [{ type: "mouse_button", button_index: 5 }, { type: "key", keycode: 66, physical_keycode: 66 }] }
];
const FIRST_PERSON_INPUT_ACTIONS = [
  { action: "play_char_move_forward_action", events: [{ type: "key", keycode: 87, physical_keycode: 87 }, { type: "key", keycode: 4194320, physical_keycode: 4194320 }] },
  { action: "play_char_move_backward_action", events: [{ type: "key", keycode: 83, physical_keycode: 83 }, { type: "key", keycode: 4194322, physical_keycode: 4194322 }] },
  { action: "play_char_move_left_ation", events: [{ type: "key", keycode: 65, physical_keycode: 65 }, { type: "key", keycode: 4194319, physical_keycode: 4194319 }] },
  { action: "play_char_move_right_action", events: [{ type: "key", keycode: 68, physical_keycode: 68 }, { type: "key", keycode: 4194321, physical_keycode: 4194321 }] },
  { action: "play_char_run_action", events: [{ type: "key", keycode: 4194325, physical_keycode: 4194325 }] },
  { action: "play_char_crouch_action", events: [{ type: "key", keycode: 88, physical_keycode: 88 }] },
  { action: "play_char_jump_action", events: [{ type: "key", keycode: 32, physical_keycode: 32 }] },
  { action: "play_char_slide_action", events: [{ type: "key", keycode: 88, physical_keycode: 88 }] },
  { action: "play_char_dash_action", events: [{ type: "key", keycode: 4194328, physical_keycode: 4194328 }] },
  { action: "play_char_fly_action", events: [{ type: "key", keycode: 70, physical_keycode: 70 }] },
  { action: "play_char_zoom_action", events: [{ type: "key", keycode: 90, physical_keycode: 90 }] },
  { action: "play_char_mouse_mode_action", events: [{ type: "key", keycode: 4194326, physical_keycode: 4194326 }] }
];
const RESOURCE_PROPERTY_TYPES = new Map([
  ["script", "Script"],
  ["texture", "Texture2D"],
  ["material", "Material"]
]);

const projectRoot = await resolveProjectRoot();
const env = { ...(await loadDotEnv(projectRoot)), ...process.env };
const READ_ONLY_MODE = /^(1|true|yes)$/i.test(env.GODOT_MCP_READ_ONLY ?? env.READ_ONLY_MODE ?? "");
const BRIDGE_HOST = env.GODOT_BRIDGE_HOST || "127.0.0.1";
const BRIDGE_PORT = Number(env.GODOT_MCP_PORT || env.GODOT_BRIDGE_PORT || 8765);
const WRITE_TOOLS = new Set([
  "godot_create_scene",
  "godot_add_node",
  "godot_update_node",
  "godot_attach_script",
  "godot_create_script",
  "godot_import_image",
  "godot_generate_sprite",
  "godot_generate_texture",
  "godot_import_3d_model",
  "godot_generate_3d_model",
  "godot_install_third_person_controller",
  "godot_create_third_person_prototype",
  "godot_install_first_person_controller",
  "godot_create_first_person_prototype",
  "godot_run_project",
  "godot_stop_project",
  "godot_capture_screenshot",
  "godot_capture_editor_viewport",
  "godot_create_input_action",
  "godot_create_autoload",
  "godot_create_material",
  "godot_update_generation_job_status"
]);
let runningGame = null;

const tools = [
  tool("godot_help", "Discover available tool categories, workflows, safety modes, and usage templates.", {
    tool: { type: "string", description: "Optional exact tool name to describe." },
    category: { type: "string", description: "Optional category: overview, agent, workflows, coverage, safety, bridge, generation, debug." },
    task: { type: "string", description: "Optional task description for a suggested tool chain." }
  }),
  tool("godot_agent_instructions", "Return instruction-first guidance for Codex, Claude, or another AI client. The MCP JS tools stay as safe project primitives.", {
    client: { type: "string", enum: ["generic", "codex", "claude"], default: "generic" },
    workflow: { type: "string", enum: ["auto", "inspect", "create_scene", "research_mechanic", "third_person", "first_person", "assets", "debug", "visual_check", "provider_setup", "bridge"], default: "auto" },
    task: { type: "string", description: "Optional user task. Used to choose an instruction workflow when workflow is auto." },
    detail: { type: "string", enum: ["short", "full"], default: "full" }
  }),
  tool("godot_doctor", "Run a beginner-friendly health check for project setup, bridge connectivity, providers, and expected folders.", {
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_codex_config", "Return ready-to-paste Codex MCP TOML for this project root.", {
    server_name: { type: "string", default: "godotMCP" },
    startup_timeout_sec: { type: "integer", minimum: 1, maximum: 120, default: 20 }
  }),
  tool("godot_bridge_status", "Check whether the optional Godot EditorPlugin bridge is listening on localhost.", {
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_editor_scene_snapshot", "Ask the Godot EditorPlugin bridge for the currently edited scene tree and selected nodes.", {
    max_depth: { type: "integer", minimum: 1, maximum: 16, default: 8 },
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_project_scan", "Scan the Godot project and return folders, tree, scenes, scripts, resources, textures, materials, and models.", {
    max_files: { type: "integer", minimum: 1, maximum: 30000, default: 8000 },
    max_depth: { type: "integer", minimum: 1, maximum: 12, default: 6 }
  }),
  tool("godot_search_project", "Search safe text files in the project without reading secrets from dotfiles.", {
    query: { type: "string" },
    folder: { type: "string", default: "" },
    extensions: { type: "array", items: { type: "string" }, default: [] },
    case_sensitive: { type: "boolean", default: false },
    max_results: { type: "integer", minimum: 1, maximum: 500, default: 50 },
    max_file_bytes: { type: "integer", minimum: 1024, maximum: 1048576, default: 262144 }
  }, ["query"]),
  tool("godot_list_scenes", "List .tscn and .scn scenes.", {
    folder: { type: "string", description: "Optional project-local folder or res:// path.", default: "" }
  }),
  tool("godot_list_scripts", "List GDScript files with extends and class_name summaries.", {
    folder: { type: "string", description: "Optional project-local folder or res:// path.", default: "" },
    include_text: { type: "boolean", default: false }
  }),
  tool("godot_read_scene", "Read a text .tscn scene and return node structure. Binary .scn files are reported as unsupported for direct text parsing.", {
    path: { type: "string" },
    include_text: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_create_scene", "Create a Godot 4 text scene with an allowed root node type.", {
    path: { type: "string" },
    root_type: { type: "string", enum: [...ALLOWED_ROOT_NODES], default: "Node2D" },
    root_name: { type: "string" },
    overwrite: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_add_node", "Add a node to a .tscn scene with safe basic properties.", {
    scene_path: { type: "string" },
    parent_path: { type: "string", default: "." },
    node_type: { type: "string" },
    node_name: { type: "string" },
    properties: { type: "object", additionalProperties: true, default: {} },
    dry_run: { type: "boolean", default: false }
  }, ["scene_path", "node_type", "node_name"]),
  tool("godot_update_node", "Update safe basic properties on a node in a .tscn scene.", {
    scene_path: { type: "string" },
    node_path: { type: "string", description: "Use . for the root node, or paths like Player/Camera." },
    properties: { type: "object", additionalProperties: true },
    dry_run: { type: "boolean", default: false }
  }, ["scene_path", "node_path", "properties"]),
  tool("godot_attach_script", "Create or attach a GDScript to a node in a .tscn scene.", {
    scene_path: { type: "string" },
    node_path: { type: "string", default: "." },
    script_path: { type: "string" },
    extends: { type: "string", default: "Node" },
    content: { type: "string" },
    overwrite_script: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }, ["scene_path", "script_path"]),
  tool("godot_create_script", "Create a beginner-readable Godot 4 GDScript file.", {
    path: { type: "string" },
    extends: { type: "string", default: "Node" },
    class_name: { type: "string" },
    description: { type: "string" },
    content: { type: "string" },
    overwrite: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_create_input_action", "Add or update a Godot input action in project.godot.", {
    action: { type: "string" },
    deadzone: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
    events: { type: "array", items: { type: "object", additionalProperties: true }, default: [] },
    overwrite: { type: "boolean", default: false }
  }, ["action"]),
  tool("godot_create_autoload", "Add or update a script autoload entry in project.godot.", {
    name: { type: "string" },
    script_path: { type: "string" },
    singleton: { type: "boolean", default: true },
    overwrite: { type: "boolean", default: false }
  }, ["name", "script_path"]),
  tool("godot_create_material", "Create a simple text .tres/.material resource for StandardMaterial3D or CanvasItemMaterial.", {
    path: { type: "string" },
    material_type: { type: "string", enum: ["StandardMaterial3D", "CanvasItemMaterial"], default: "StandardMaterial3D" },
    albedo_color: { type: "array", items: { type: "number" }, default: [1, 1, 1, 1] },
    roughness: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
    metallic: { type: "number", minimum: 0, maximum: 1, default: 0 },
    overwrite: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_install_third_person_controller", "Install the Jeh3no PlayerCharacter third-person controller addon instead of making a capsule prototype.", {
    ref: { type: "string", description: "Git ref to download from the upstream repository.", default: THIRD_PERSON_CONTROLLER_REF },
    source_path: { type: "string", description: "Optional project-local checkout or fixture folder containing addons/PlayerCharacter." },
    include_dependencies: { type: "boolean", description: "Also copy sibling assets such as addons/Arts for model, animation, sounds, and particles.", default: true },
    include_test_map: { type: "boolean", description: "Also copy the upstream test map scenes.", default: false },
    overwrite: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }),
  tool("godot_create_third_person_prototype", "Create a third-person prototype scene using Jeh3no PlayerCharacter, never a plain capsule placeholder.", {
    scene_path: { type: "string", default: "scenes/third_person_prototype.tscn" },
    root_name: { type: "string", default: "ThirdPersonPrototype" },
    install_controller: { type: "boolean", description: "Install PlayerCharacter first when it is missing.", default: true },
    source_path: { type: "string", description: "Optional project-local checkout or fixture folder used for offline install." },
    include_dependencies: { type: "boolean", default: true },
    overwrite: { type: "boolean", default: false },
    overwrite_input_actions: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }),
  tool("godot_install_first_person_controller", "Install Jeh3no's advanced state-machine first-person PlayerCharacter controller instead of making a capsule prototype.", {
    ref: { type: "string", description: "Git ref to download from the upstream repository.", default: FIRST_PERSON_CONTROLLER_REF },
    source_path: { type: "string", description: "Optional project-local checkout or fixture folder containing addons/PlayerCharacter." },
    include_dependencies: { type: "boolean", description: "Also copy sibling assets such as addons/Arts for UI/crosshair resources.", default: true },
    include_test_map: { type: "boolean", description: "Also copy the upstream first-person test map scenes.", default: false },
    overwrite: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }),
  tool("godot_create_first_person_prototype", "Create a first-person prototype scene using Jeh3no's advanced PlayerCharacter, never a plain capsule placeholder.", {
    scene_path: { type: "string", default: "scenes/first_person_prototype.tscn" },
    root_name: { type: "string", default: "FirstPersonPrototype" },
    install_controller: { type: "boolean", description: "Install Jeh3no's first-person PlayerCharacter first when it is missing.", default: true },
    source_path: { type: "string", description: "Optional project-local checkout or fixture folder used for offline install." },
    include_dependencies: { type: "boolean", default: true },
    overwrite: { type: "boolean", default: false },
    overwrite_input_actions: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false }
  }),
  tool("godot_import_image", "Copy a project-local image into the project and optionally run a Godot import pass.", {
    source_path: { type: "string" },
    target_path: { type: "string", description: "Defaults to assets/generated/sprites/<source filename>." },
    kind: { type: "string", enum: ["texture", "sprite"], default: "texture" },
    overwrite: { type: "boolean", default: false },
    run_import: { type: "boolean", default: false }
  }, ["source_path"]),
  tool("godot_generate_sprite", "Generate or queue a sprite from a prompt. Provider none writes a job file.", {
    prompt: { type: "string" },
    provider: { type: "string", enum: IMAGE_PROVIDERS, default: "none" },
    target_path: { type: "string" },
    name: { type: "string" },
    size: { type: "string", default: "1024x1024" }
  }, ["prompt"]),
  tool("godot_generate_texture", "Generate or queue a texture from a prompt. Provider none writes a job file.", {
    prompt: { type: "string" },
    provider: { type: "string", enum: IMAGE_PROVIDERS, default: "none" },
    target_path: { type: "string" },
    name: { type: "string" },
    seamless: { type: "boolean", default: false },
    size: { type: "string", default: "1024x1024" }
  }, ["prompt"]),
  tool("godot_import_3d_model", "Copy a project-local .glb/.gltf/.fbx/.obj model into assets/models/ and report likely texture dependencies.", {
    source_path: { type: "string" },
    target_path: { type: "string", description: "Defaults to assets/models/<source filename>." },
    overwrite: { type: "boolean", default: false }
  }, ["source_path"]),
  tool("godot_generate_3d_model", "Queue a 3D model generation job or call a configured adapter when one exists.", {
    prompt: { type: "string" },
    provider: { type: "string", enum: MODEL_3D_PROVIDERS, default: "none" },
    target_path: { type: "string" },
    name: { type: "string" },
    quality: { type: "string", enum: ["preview", "refine"], default: "preview", description: "Meshy quality mode. preview is faster; refine creates a textured GLB and may cost more credits." }
  }, ["prompt"]),
  tool("godot_list_generation_jobs", "List queued or completed generation job JSON files.", {
    kind: { type: "string", enum: ["all", "images", "models", "chat"], default: "all" },
    status: { type: "string" },
    max_jobs: { type: "integer", minimum: 1, maximum: 1000, default: 100 }
  }),
  tool("godot_update_generation_job_status", "Update the status and optional note on a generation job JSON file.", {
    job_path: { type: "string" },
    id: { type: "string" },
    status: { type: "string", enum: ["queued", "in_progress", "done", "failed", "canceled"] },
    note: { type: "string" }
  }, ["status"]),
  tool("godot_run_project", "Run the current project with Godot CLI or ask the editor bridge to play it. Uses a strict Godot-only command whitelist.", {
    scene_path: { type: "string" },
    mode: { type: "string", enum: ["cli", "editor"], default: "cli" },
    dry_run: { type: "boolean", default: true },
    wait_ms: { type: "integer", minimum: 0, maximum: 15000, default: 0 }
  }),
  tool("godot_runtime_status", "Report whether this MCP server has a tracked Godot game process and whether the editor bridge is playing a scene.", {
    include_bridge: { type: "boolean", default: true },
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_stop_project", "Stop a Godot game launched by this MCP server or ask the editor bridge to stop the playing scene.", {
    mode: { type: "string", enum: ["auto", "cli", "editor"], default: "auto" },
    timeout_ms: { type: "integer", minimum: 200, maximum: 10000, default: 3000 }
  }),
  tool("godot_capture_screenshot", "Run the game for a few frames with Godot Movie Maker and save a PNG screenshot/sequence inside the project.", {
    scene_path: { type: "string" },
    output_path: { type: "string", description: "Project-local .png path. Defaults to docs/assets/screenshots/runtime/<timestamp>.png." },
    frames: { type: "integer", minimum: 1, maximum: 120, default: 3 },
    overwrite: { type: "boolean", default: false },
    dry_run: { type: "boolean", default: false },
    timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 }
  }),
  tool("godot_capture_editor_viewport", "Ask the editor bridge to save the current 2D or 3D editor viewport as a PNG inside the project.", {
    viewport: { type: "string", enum: ["2d", "3d"], default: "3d" },
    viewport_index: { type: "integer", minimum: 0, maximum: 3, default: 0 },
    output_path: { type: "string", description: "Project-local .png path. Defaults to docs/assets/screenshots/editor/<timestamp>.png." },
    overwrite: { type: "boolean", default: false },
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_check_errors", "Run static checks and Godot headless check when Godot CLI is available.", {
    run_godot: { type: "boolean", default: true },
    timeout_ms: { type: "integer", minimum: 1000, maximum: 60000, default: 20000 }
  })
];

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  void handleLine(line);
});

process.stderr.write(`mcp-godot ${SERVER_VERSION} ready for ${projectRoot}\n`);

async function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    sendError(null, -32700, "Parse error", sanitizeForLog(error.message ?? error, env));
    return;
  }

  if (Array.isArray(message)) {
    for (const item of message) {
      await handleMessage(item);
    }
    return;
  }
  await handleMessage(message);
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    sendError(message?.id ?? null, -32600, "Invalid Request");
    return;
  }

  if (!Object.hasOwn(message, "id")) {
    return;
  }

  try {
    switch (message.method) {
      case "initialize":
        sendResult(message.id, initializeResult(message.params ?? {}));
        break;
      case "ping":
        sendResult(message.id, {});
        break;
      case "tools/list":
        sendResult(message.id, { tools });
        break;
      case "tools/call":
        sendResult(message.id, await callTool(message.params ?? {}));
        break;
      default:
        sendError(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    if (error instanceof JsonRpcError) {
      sendError(message.id, error.code, error.message, error.data);
      return;
    }
    sendError(message.id, -32603, "Internal error", sanitizeForLog(error.stack ?? error.message ?? error, env));
  }
}

function initializeResult(params) {
  const requested = params.protocolVersion;
  const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : DEFAULT_PROTOCOL;
  return {
    protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: "mcp-godot-local",
      title: "Local Godot MCP",
      version: SERVER_VERSION
    },
    instructions: "Start with godot_help and godot_project_scan. Direct scene editing supports text .tscn files; binary .scn and richer live editor operations require the optional editor bridge."
  };
}

async function callTool(params) {
  const name = params.name;
  const args = params.arguments ?? {};
  if (!tools.some((item) => item.name === name)) {
    throw new JsonRpcError(-32602, `Unknown tool: ${name}`);
  }
  if (READ_ONLY_MODE && WRITE_TOOLS.has(name)) {
    return toolResult({
      ok: false,
      readOnlyMode: true,
      tool: name,
      suggestion: "Unset GODOT_MCP_READ_ONLY/READ_ONLY_MODE or use read-only tools such as godot_project_scan, godot_list_scenes, godot_read_scene, godot_bridge_status, and godot_check_errors."
    }, true);
  }

  try {
    const handlers = {
      godot_help: godotHelp,
      godot_agent_instructions: godotAgentInstructions,
      godot_doctor: godotDoctor,
      godot_codex_config: godotCodexConfig,
      godot_bridge_status: godotBridgeStatus,
      godot_editor_scene_snapshot: godotEditorSceneSnapshot,
      godot_project_scan: godotProjectScan,
      godot_search_project: godotSearchProject,
      godot_list_scenes: godotListScenes,
      godot_list_scripts: godotListScripts,
      godot_read_scene: godotReadScene,
      godot_create_scene: godotCreateScene,
      godot_add_node: godotAddNode,
      godot_update_node: godotUpdateNode,
      godot_attach_script: godotAttachScript,
      godot_create_script: godotCreateScript,
      godot_create_input_action: godotCreateInputAction,
      godot_create_autoload: godotCreateAutoload,
      godot_create_material: godotCreateMaterial,
      godot_install_third_person_controller: godotInstallThirdPersonController,
      godot_create_third_person_prototype: godotCreateThirdPersonPrototype,
      godot_install_first_person_controller: godotInstallFirstPersonController,
      godot_create_first_person_prototype: godotCreateFirstPersonPrototype,
      godot_import_image: godotImportImage,
      godot_generate_sprite: godotGenerateSprite,
      godot_generate_texture: godotGenerateTexture,
      godot_import_3d_model: godotImport3dModel,
      godot_generate_3d_model: godotGenerate3dModel,
      godot_list_generation_jobs: godotListGenerationJobs,
      godot_update_generation_job_status: godotUpdateGenerationJobStatus,
      godot_run_project: godotRunProject,
      godot_runtime_status: godotRuntimeStatus,
      godot_stop_project: godotStopProject,
      godot_capture_screenshot: godotCaptureScreenshot,
      godot_capture_editor_viewport: godotCaptureEditorViewport,
      godot_check_errors: godotCheckErrors
    };
    return toolResult(await handlers[name](args));
  } catch (error) {
    if (error instanceof JsonRpcError) {
      throw error;
    }
    return toolResult({ ok: false, error: sanitizeForLog(error.message ?? error, env) }, true);
  }
}

async function godotHelp(args) {
  const byName = Object.fromEntries(tools.map((item) => [item.name, item]));
  if (args.tool) {
    const selected = byName[args.tool];
    if (!selected) {
      throw new Error(`Unknown tool: ${args.tool}`);
    }
    return {
      ok: true,
      tool: selected,
      category: toolCategory(selected.name),
      mutatesProject: WRITE_TOOLS.has(selected.name),
      readOnlyModeBlocked: READ_ONLY_MODE && WRITE_TOOLS.has(selected.name),
      usage: usageTemplate(selected.name),
      agentUse: toolAgentUse(selected.name)
    };
  }

  if (args.task) {
    const workflow = selectAgentWorkflow("auto", args.task);
    return {
      ok: true,
      task: args.task,
      instructionFirst: true,
      workflow,
      suggestedChain: suggestToolChain(args.task),
      agentInstructions: buildAgentInstructions({ client: "generic", workflow, task: args.task, detail: "short" })
    };
  }

  const category = args.category ?? "overview";
  return {
    ok: true,
    serverVersion: SERVER_VERSION,
    readOnlyMode: READ_ONLY_MODE,
    bridge: { host: BRIDGE_HOST, port: BRIDGE_PORT },
    category,
    toolsByCategory: groupToolsByCategory(),
    workflows: category === "overview" || category === "workflows" ? workflowHelp() : undefined,
    agent: category === "overview" || category === "agent" ? agentHelp() : undefined,
    coverage: category === "overview" || category === "coverage" ? coverageHelp() : undefined,
    safety: category === "overview" || category === "safety" ? safetyHelp() : undefined,
    generation: category === "generation" ? generationHelp() : undefined,
    debug: category === "overview" || category === "debug" ? debugHelp() : undefined,
    bridgeNotes: category === "overview" || category === "bridge" ? bridgeHelp() : undefined
  };
}

async function godotAgentInstructions(args) {
  const client = normalizeAgentClient(args.client);
  const workflow = selectAgentWorkflow(args.workflow ?? "auto", args.task ?? "");
  const detail = args.detail === "short" ? "short" : "full";
  return {
    ok: true,
    serverVersion: SERVER_VERSION,
    mode: "instruction_first",
    client,
    workflow,
    task: args.task ?? "",
    ...buildAgentInstructions({ client, workflow, task: args.task ?? "", detail })
  };
}

async function godotDoctor(args) {
  const timeoutMs = clampInteger(args.timeout_ms ?? 1000, 200, 5000);
  const recommendations = [];
  const projectGodotPath = path.join(projectRoot, "project.godot");
  const projectFileExists = await pathExists(projectGodotPath);
  const godot = await findGodotCommand();
  const bridge = await callEditorBridge({ command: "status" }, timeoutMs);
  const envExists = await pathExists(path.join(projectRoot, ".env"));
  const folders = {};

  for (const folder of ["scenes", "scripts", "Assets", "assets", "generation_jobs"]) {
    folders[folder] = await folderStatus(path.join(projectRoot, folder));
  }

  const providers = providerStatus(env);
  if (!projectFileExists) {
    recommendations.push("Create or restore project.godot before using project tools.");
  }
  if (!godot) {
    recommendations.push("Install Godot 4.x CLI on PATH or set GODOT_CLI in .env.");
  }
  if (!bridge.connected) {
    recommendations.push("Open Godot, enable the AI MCP Bridge plugin, and press Start if editor-backed tools are needed.");
  }
  if (!envExists) {
    recommendations.push("Create .env from .env.example when you need Godot CLI or real provider settings.");
  }
  for (const [name, status] of Object.entries(folders)) {
    if (!status.exists) {
      recommendations.push(`Create ${name}/ when that workflow is needed.`);
    }
  }
  if (providers.image.provider === "none" && providers.model3d.provider === "none") {
    recommendations.push("Generation providers are set to none; prompts will be saved as jobs instead of calling real services.");
  }
  if (providers.model3d.provider !== "none" && !providers.model3d.configured) {
    recommendations.push(`3D provider ${providers.model3d.provider} is missing: ${providers.model3d.missing.join(", ")}.`);
  }

  return {
    ok: projectFileExists,
    projectRoot,
    serverVersion: SERVER_VERSION,
    nodeVersion: process.version,
    projectGodot: { exists: projectFileExists, path: "res://project.godot" },
    godotCli: godot ? { found: true, command: godot } : { found: false },
    bridge: {
      reachable: Boolean(bridge.connected),
      host: BRIDGE_HOST,
      port: BRIDGE_PORT,
      status: bridge
    },
    env: { exists: envExists, path: "res://.env" },
    providers,
    folders,
    recommendations
  };
}

async function godotCodexConfig(args) {
  const serverName = args.server_name ?? "godotMCP";
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(serverName)) {
    throw new Error("server_name must be a TOML-safe identifier.");
  }
  const startupTimeout = clampInteger(args.startup_timeout_sec ?? 20, 1, 120);
  const serverPath = path.join(projectRoot, "tools", "mcp-godot", "src", "server.mjs");
  const toml = [
    `[mcp_servers.${serverName}]`,
    `command = ${tomlString(process.execPath)}`,
    `args = [ ${tomlString(serverPath)}, "--project-root", ${tomlString(projectRoot)} ]`,
    `startup_timeout_sec = ${startupTimeout}`,
    `env = { GODOT_PROJECT_ROOT = ${tomlString(projectRoot)} }`,
    ""
  ].join("\n");
  return { ok: true, projectRoot, serverName, toml };
}

async function godotBridgeStatus(args) {
  return callEditorBridge({ command: "status" }, clampInteger(args.timeout_ms ?? 1000, 200, 5000));
}

async function godotEditorSceneSnapshot(args) {
  return callEditorBridge({
    command: "scene_snapshot",
    max_depth: clampInteger(args.max_depth ?? 8, 1, 16)
  }, clampInteger(args.timeout_ms ?? 1000, 200, 5000));
}

async function godotProjectScan(args) {
  const maxFiles = clampInteger(args.max_files ?? 8000, 1, 30000);
  const maxDepth = clampInteger(args.max_depth ?? 6, 1, 12);
  const projectFile = path.join(projectRoot, "project.godot");
  const projectText = await readTextFile(projectFile, MAX_TEXT_BYTES);
  const files = await walk(projectRoot, { maxFiles });
  const directories = await walkDirectories(projectRoot, { maxFiles });
  const classified = await classifyFiles(files);

  return {
    ok: true,
    projectRoot,
    projectFile: "res://project.godot",
    mcp: {
      serverVersion: SERVER_VERSION,
      readOnlyMode: READ_ONLY_MODE,
      bridge: { host: BRIDGE_HOST, port: BRIDGE_PORT }
    },
    godot: parseProjectGodot(projectText),
    folders: await folderSummary(directories, files),
    suggestedStructure: suggestedStructure(),
    tree: buildTree([...directories.map((directory) => `${directory}/`), ...files], maxDepth),
    counts: Object.fromEntries(Object.entries(classified).map(([key, value]) => [key, value.length])),
    ...classified
  };
}

async function godotSearchProject(args) {
  requireString(args.query, "query");
  const query = args.case_sensitive ? args.query : args.query.toLowerCase();
  const folder = args.folder ? await resolveProjectPath(args.folder, { expectDirectory: true, mustExist: true }) : projectRoot;
  const maxResults = clampInteger(args.max_results ?? 50, 1, 500);
  const maxFileBytes = clampInteger(args.max_file_bytes ?? 262144, 1024, 1048576);
  const allowedExtensions = normalizeExtensionFilter(args.extensions);
  const files = await walk(folder, { maxFiles: 30000 });
  const matches = [];

  for (const rel of files) {
    if (matches.length >= maxResults) {
      break;
    }
    const ext = path.extname(rel).toLowerCase();
    if (allowedExtensions.size > 0 ? !allowedExtensions.has(ext) : !isDefaultSearchExtension(ext, rel)) {
      continue;
    }
    const abs = path.join(projectRoot, fromProjectSeparators(rel));
    let text;
    try {
      text = await readTextFile(abs, maxFileBytes);
    } catch {
      continue;
    }
    const lines = textToLines(text);
    for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
      const haystack = args.case_sensitive ? lines[index] : lines[index].toLowerCase();
      if (haystack.includes(query)) {
        matches.push({
          path: toResPath(abs),
          line: index + 1,
          preview: lines[index].trim().slice(0, 240)
        });
      }
    }
  }

  return { ok: true, query: args.query, count: matches.length, matches };
}

async function godotListScenes(args) {
  const folder = args.folder ? await resolveProjectPath(args.folder, { expectDirectory: true, mustExist: true }) : projectRoot;
  const files = await walk(folder, { maxFiles: 10000 });
  const scenes = [];
  for (const rel of files.filter((file) => SCENE_EXTENSIONS.has(path.extname(file).toLowerCase()))) {
    const abs = path.join(projectRoot, fromProjectSeparators(rel));
    const ext = path.extname(abs).toLowerCase();
    const entry = { path: toResPath(abs), format: ext === ".tscn" ? "text" : "binary" };
    if (ext === ".tscn") {
      const scene = parseSceneText(await readTextFile(abs, MAX_TEXT_BYTES));
      entry.rootName = scene.root?.name ?? null;
      entry.rootType = scene.root?.type ?? null;
      entry.nodeCount = scene.nodes.length;
    }
    scenes.push(entry);
  }
  return { ok: true, scenes };
}

async function godotListScripts(args) {
  const folder = args.folder ? await resolveProjectPath(args.folder, { expectDirectory: true, mustExist: true }) : projectRoot;
  const files = await walk(folder, { maxFiles: 10000 });
  const scripts = [];
  for (const rel of files.filter((file) => SCRIPT_EXTENSIONS.has(path.extname(file).toLowerCase()))) {
    const abs = path.join(projectRoot, fromProjectSeparators(rel));
    const text = await readTextFile(abs, MAX_TEXT_BYTES);
    const info = parseScriptInfo(text);
    scripts.push({
      path: toResPath(abs),
      extends: info.extends,
      className: info.className,
      lineCount: textToLines(text).length,
      ...(args.include_text ? { text } : {})
    });
  }
  return { ok: true, scripts };
}

async function godotReadScene(args) {
  requireString(args.path, "path");
  const abs = await resolveProjectPath(args.path, { mustExist: true });
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".scn") {
    throw new Error("Binary .scn scenes are not parsed by this file-based MCP tool. Use the Godot EditorPlugin bridge for Godot API access.");
  }
  assertExtension(abs, ".tscn");
  const text = await readTextFile(abs, MAX_TEXT_BYTES);
  const scene = parseSceneText(text);
  return {
    ok: true,
    path: toResPath(abs),
    scene: sceneSummary(scene),
    ...(args.include_text ? { text } : {})
  };
}

async function godotCreateScene(args) {
  requireString(args.path, "path");
  const abs = await resolveProjectPath(args.path, { forWrite: true });
  assertExtension(abs, ".tscn");
  const rootType = args.root_type ?? "Node2D";
  if (!ALLOWED_ROOT_NODES.has(rootType)) {
    throw new Error(`root_type must be one of: ${[...ALLOWED_ROOT_NODES].join(", ")}.`);
  }
  const rootName = args.root_name ?? path.basename(abs, ".tscn");
  validateGodotString(rootName, "root_name");

  const text = [
    "[gd_scene format=3]",
    "",
    `[node name=${godotString(rootName)} type="${rootType}"]`,
    ""
  ].join("\n");
  if (args.dry_run === true) {
    return plannedResult([
      {
        action: await pathExists(abs) ? "overwrite_file" : "create_file",
        path: toResPath(abs),
        allowedOnlyWithOverwrite: await pathExists(abs) && !args.overwrite,
        bytes: Buffer.byteLength(text, "utf8"),
        preview: text
      }
    ], { path: toResPath(abs), rootType, rootName });
  }
  await assertCanWrite(abs, Boolean(args.overwrite));
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, text, "utf8");
  return { ok: true, path: toResPath(abs), rootType, rootName, created: true, overwritten: Boolean(args.overwrite) };
}

async function godotAddNode(args) {
  const abs = await readWritableScenePath(args.scene_path);
  const text = await readTextFile(abs, MAX_TEXT_BYTES);
  const scene = parseSceneText(text);
  const nodeType = args.node_type;
  const nodeName = args.node_name;
  if (!isGodotIdentifier(nodeType)) {
    throw new Error("node_type must be a Godot class-style identifier.");
  }
  validateGodotString(nodeName, "node_name");
  const parentPath = normalizeParentPath(args.parent_path ?? ".", scene);
  const properties = await prepareProperties(args.properties ?? {}, scene);
  const nodePath = parentPath === "." ? nodeName : `${parentPath}/${nodeName}`;
  if (scene.nodes.some((node) => node.path === nodePath)) {
    throw new Error(`node already exists at ${nodePath}.`);
  }

  const lines = textToLines(text);
  const insert = [];
  insert.push("", `[node name=${godotString(nodeName)} type="${nodeType}" parent=${godotString(parentPath)}]`);
  for (const line of properties.lines) {
    insert.push(line);
  }
  insert.push("");
  if (args.dry_run === true) {
    return plannedResult([
      ...properties.newResources.map((resource) => ({ action: "add_ext_resource", scene: toResPath(abs), resource })),
      { action: "add_node", scene: toResPath(abs), nodePath, nodeType, parentPath, lines: insert }
    ], { scene: toResPath(abs), nodePath, nodeType, parentPath });
  }
  if (properties.newResources.length > 0) {
    insertResources(lines, scene, properties.newResources);
  }
  await fs.writeFile(abs, `${lines.join("\n")}${insert.join("\n")}`, "utf8");
  return { ok: true, scene: toResPath(abs), nodePath, nodeType, parentPath, added: true };
}

async function godotUpdateNode(args) {
  const abs = await readWritableScenePath(args.scene_path);
  const text = await readTextFile(abs, MAX_TEXT_BYTES);
  const scene = parseSceneText(text);
  const node = findSceneNode(scene, args.node_path);
  const properties = await prepareProperties(args.properties ?? {}, scene);
  const lines = textToLines(text);
  if (args.dry_run === true) {
    return plannedResult([
      ...properties.newResources.map((resource) => ({ action: "add_ext_resource", scene: toResPath(abs), resource })),
      { action: "update_node", scene: toResPath(abs), nodePath: node.path, properties: properties.propertyNames, lines: properties.lines }
    ], { scene: toResPath(abs), nodePath: node.path, updatedProperties: properties.propertyNames });
  }
  if (properties.newResources.length > 0) {
    insertResources(lines, scene, properties.newResources);
  }
  applyPropertiesToNodeBlock(lines, node, properties.lines);
  await fs.writeFile(abs, lines.join("\n"), "utf8");
  return { ok: true, scene: toResPath(abs), nodePath: node.path, updatedProperties: properties.propertyNames };
}

async function godotAttachScript(args) {
  requireString(args.script_path, "script_path");
  const scriptAbs = await resolveProjectPath(args.script_path, { forWrite: true });
  assertExtension(scriptAbs, ".gd");
  if (args.dry_run === true) {
    const sceneAbs = await readWritableScenePath(args.scene_path);
    const scene = parseSceneText(await readTextFile(sceneAbs, MAX_TEXT_BYTES));
    const node = findSceneNode(scene, args.node_path ?? ".");
    const scriptExists = await pathExists(scriptAbs);
    const plannedChanges = [];
    if (!scriptExists || (args.overwrite_script && args.content != null)) {
      const content = buildScriptContent({
        path: args.script_path,
        extends: args.extends ?? "Node",
        content: args.content,
        description: "Script attached through godot_attach_script."
      });
      plannedChanges.push({
        action: scriptExists ? "overwrite_file" : "create_file",
        path: toResPath(scriptAbs),
        bytes: Buffer.byteLength(content, "utf8"),
        preview: content
      });
    }
    plannedChanges.push({
      action: "attach_script",
      scene: toResPath(sceneAbs),
      nodePath: node.path,
      script: toResPath(scriptAbs)
    });
    return plannedResult(plannedChanges, { scene: toResPath(sceneAbs), nodePath: node.path, script: toResPath(scriptAbs) });
  }
  try {
    await fs.access(scriptAbs, fsConstants.R_OK);
  } catch {
    await godotCreateScript({
      path: args.script_path,
      extends: args.extends ?? "Node",
      content: args.content,
      description: "Script attached through godot_attach_script.",
      overwrite: false
    });
  }

  if (args.overwrite_script && args.content != null) {
    await godotCreateScript({
      path: args.script_path,
      extends: args.extends ?? "Node",
      content: args.content,
      overwrite: true
    });
  }

  return godotUpdateNode({
    scene_path: args.scene_path,
    node_path: args.node_path ?? ".",
    properties: { script: toResPath(scriptAbs) }
  });
}

async function godotCreateScript(args) {
  requireString(args.path, "path");
  const abs = await resolveProjectPath(args.path, { forWrite: true });
  assertExtension(abs, ".gd");
  const content = buildScriptContent(args);
  if (args.dry_run === true) {
    return plannedResult([
      {
        action: await pathExists(abs) ? "overwrite_file" : "create_file",
        path: toResPath(abs),
        allowedOnlyWithOverwrite: await pathExists(abs) && !args.overwrite,
        bytes: Buffer.byteLength(content, "utf8"),
        preview: content
      }
    ], { path: toResPath(abs) });
  }
  await assertCanWrite(abs, Boolean(args.overwrite));
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { ok: true, path: toResPath(abs), created: true, overwritten: Boolean(args.overwrite) };
}

async function godotCreateInputAction(args) {
  requireString(args.action, "action");
  if (!isGodotIdentifier(args.action)) {
    throw new Error("action must be a Godot-style identifier, for example jump or move_left.");
  }
  const deadzone = clampNumber(args.deadzone ?? 0.5, 0, 1);
  const events = Array.isArray(args.events) ? args.events.map(serializeInputEvent) : [];
  const projectFile = path.join(projectRoot, "project.godot");
  const text = await readTextFile(projectFile, MAX_TEXT_BYTES);
  const value = `{"deadzone":${formatNumber(deadzone)},"events":[${events.join(", ")}]}`;
  const updated = setProjectSetting(text, "input", args.action, value, Boolean(args.overwrite));
  await fs.writeFile(projectFile, updated.text, "utf8");
  return {
    ok: true,
    projectFile: "res://project.godot",
    action: args.action,
    operation: updated.operation,
    events: events.length
  };
}

async function godotCreateAutoload(args) {
  requireString(args.name, "name");
  requireString(args.script_path, "script_path");
  if (!isGodotIdentifier(args.name)) {
    throw new Error("name must be a valid Godot identifier.");
  }
  const scriptAbs = await resolveProjectPath(args.script_path, { mustExist: true });
  assertExtension(scriptAbs, ".gd");
  const projectFile = path.join(projectRoot, "project.godot");
  const text = await readTextFile(projectFile, MAX_TEXT_BYTES);
  const marker = args.singleton === false ? "" : "*";
  const value = godotString(`${marker}${toResPath(scriptAbs)}`);
  const updated = setProjectSetting(text, "autoload", args.name, value, Boolean(args.overwrite));
  await fs.writeFile(projectFile, updated.text, "utf8");
  return {
    ok: true,
    projectFile: "res://project.godot",
    name: args.name,
    script: toResPath(scriptAbs),
    singleton: args.singleton !== false,
    operation: updated.operation
  };
}

async function godotCreateMaterial(args) {
  requireString(args.path, "path");
  const abs = await resolveProjectPath(args.path, { forWrite: true });
  assertTextMaterialExtension(abs, "path");
  await assertCanWrite(abs, Boolean(args.overwrite));
  const materialType = args.material_type ?? "StandardMaterial3D";
  if (!["StandardMaterial3D", "CanvasItemMaterial"].includes(materialType)) {
    throw new Error("material_type must be StandardMaterial3D or CanvasItemMaterial.");
  }
  const color = formatColor(args.albedo_color ?? [1, 1, 1, 1]);
  const lines = [
    `[gd_resource type="${materialType}" format=3]`,
    "",
    "[resource]"
  ];
  if (materialType === "StandardMaterial3D") {
    lines.push(
      `albedo_color = ${color}`,
      `roughness = ${formatNumber(clampNumber(args.roughness ?? 0.5, 0, 1))}`,
      `metallic = ${formatNumber(clampNumber(args.metallic ?? 0, 0, 1))}`
    );
  } else {
    lines.push(`color = ${color}`);
  }
  lines.push("");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, lines.join("\n"), "utf8");
  return { ok: true, path: toResPath(abs), materialType, created: true, overwritten: Boolean(args.overwrite) };
}

async function godotInstallThirdPersonController(args) {
  const roots = thirdPersonInstallRoots(args);
  const ref = validateGitRef(args.ref ?? THIRD_PERSON_CONTROLLER_REF);
  const plannedChanges = roots.map((root) => ({
    action: "copy_directory",
    source: args.source_path ? `${args.source_path.replace(/\/$/, "")}/${root}` : `github:${THIRD_PERSON_CONTROLLER_REPO}/${root}@${ref}`,
    target: `res://${root}`
  }));

  if (args.dry_run === true) {
    return plannedResult(plannedChanges, {
      repository: THIRD_PERSON_CONTROLLER_REPO,
      ref,
      note: "Use this before third-person or character prototype scenes; do not create a simple capsule placeholder."
    });
  }

  await assertInstallTargetsWritable(roots, Boolean(args.overwrite));
  const files = args.source_path
    ? await collectThirdPersonFilesFromLocalSource(args.source_path, roots)
    : await collectThirdPersonFilesFromGitHub(roots, ref);
  await writeDownloadedProjectFiles(files, Boolean(args.overwrite));

  const installedScene = await findThirdPersonCharacterScene();
  return {
    ok: true,
    repository: THIRD_PERSON_CONTROLLER_REPO,
    ref,
    source: args.source_path ? "project-local source_path" : "github",
    installedRoots: roots.map((root) => `res://${root}`),
    filesWritten: files.length,
    characterScene: installedScene,
    note: "Installed Jeh3no PlayerCharacter with its controller assets. Use godot_create_third_person_prototype for a playable starter scene."
  };
}

async function godotCreateThirdPersonPrototype(args) {
  const scenePath = args.scene_path ?? "scenes/third_person_prototype.tscn";
  const rootName = args.root_name ?? "ThirdPersonPrototype";
  validateGodotString(rootName, "root_name");
  const sceneAbs = await resolveProjectPath(scenePath, { forWrite: true });
  assertExtension(sceneAbs, ".tscn");

  const existingScene = await findThirdPersonCharacterScene();
  const installNeeded = existingScene == null;
  const characterScene = existingScene ?? "res://addons/PlayerCharacter/player_character.tscn";
  const content = buildThirdPersonPrototypeScene(rootName, characterScene);
  const plannedChanges = [
    ...(installNeeded && args.install_controller !== false
      ? [{ action: "install_controller", tool: "godot_install_third_person_controller", target: "res://addons/PlayerCharacter" }]
      : []),
    { action: "ensure_input_actions", count: THIRD_PERSON_INPUT_ACTIONS.length, target: "res://project.godot" },
    {
      action: await pathExists(sceneAbs) ? "overwrite_file" : "create_file",
      path: toResPath(sceneAbs),
      uses: characterScene,
      note: "Instances PlayerCharacter instead of creating a capsule placeholder."
    }
  ];

  if (args.dry_run === true) {
    return plannedResult(plannedChanges, { path: toResPath(sceneAbs), characterScene });
  }

  if (installNeeded) {
    if (args.install_controller === false) {
      throw new Error("PlayerCharacter is not installed. Run godot_install_third_person_controller first or keep install_controller true.");
    }
    await godotInstallThirdPersonController({
      source_path: args.source_path,
      include_dependencies: args.include_dependencies ?? true,
      overwrite: false
    });
  }

  const installedScene = await findThirdPersonCharacterScene();
  if (!installedScene) {
    throw new Error("Could not find a .tscn scene inside res://addons/PlayerCharacter after install.");
  }

  const finalContent = buildThirdPersonPrototypeScene(rootName, installedScene);
  await assertCanWrite(sceneAbs, Boolean(args.overwrite));
  await fs.mkdir(path.dirname(sceneAbs), { recursive: true });
  await fs.writeFile(sceneAbs, finalContent, "utf8");
  const inputActions = await ensureThirdPersonInputActions(Boolean(args.overwrite_input_actions));

  return {
    ok: true,
    path: toResPath(sceneAbs),
    characterScene: installedScene,
    inputActions,
    note: "Created a third-person prototype scene with the upstream PlayerCharacter controller, not a simple capsule."
  };
}

async function godotInstallFirstPersonController(args) {
  const roots = firstPersonInstallRoots(args);
  const ref = validateGitRef(args.ref ?? FIRST_PERSON_CONTROLLER_REF);
  const plannedChanges = [
    ...roots.map((root) => ({
      action: "copy_directory",
      source: args.source_path ? `${args.source_path.replace(/\/$/, "")}/${root}` : `github:${FIRST_PERSON_CONTROLLER_REPO}/${root}@${ref}`,
      target: `res://${root}`
    })),
    ...FIRST_PERSON_OPTIONAL_LICENSE_FILES.map((file) => ({
      action: "copy_optional_license",
      source: args.source_path ? `${args.source_path.replace(/\/$/, "")}/${file}` : `github:${FIRST_PERSON_CONTROLLER_REPO}/${file}@${ref}`,
      target: `res://${file}`
    })),
    { action: "normalize_res_paths", from: FIRST_PERSON_UPSTREAM_RES_PREFIX, to: FIRST_PERSON_LOCAL_RES_PREFIX }
  ];

  if (args.dry_run === true) {
    return plannedResult(plannedChanges, {
      repository: FIRST_PERSON_CONTROLLER_REPO,
      ref,
      credit: FIRST_PERSON_CREDIT,
      licenseNote: FIRST_PERSON_LICENSE_NOTE,
      note: "Use this before first-person or FPS prototype scenes; do not create a simple capsule placeholder."
    });
  }

  await assertInstallTargetsWritable(roots, Boolean(args.overwrite));
  const files = args.source_path
    ? await collectFirstPersonFilesFromLocalSource(args.source_path, roots)
    : await collectFirstPersonFilesFromGitHub(roots, ref);
  await writeDownloadedProjectFiles(normalizeFirstPersonFiles(files), Boolean(args.overwrite));

  const installedScene = await findFirstPersonCharacterScene();
  return {
    ok: true,
    repository: FIRST_PERSON_CONTROLLER_REPO,
    ref,
    source: args.source_path ? "project-local source_path" : "github",
    installedRoots: roots.map((root) => `res://${root}`),
    filesWritten: files.length,
    characterScene: installedScene,
    credit: FIRST_PERSON_CREDIT,
    licenseNote: FIRST_PERSON_LICENSE_NOTE,
    note: "Installed Jeh3no's advanced first-person PlayerCharacter controller. Use godot_create_first_person_prototype for a playable starter scene."
  };
}

async function godotCreateFirstPersonPrototype(args) {
  const scenePath = args.scene_path ?? "scenes/first_person_prototype.tscn";
  const rootName = args.root_name ?? "FirstPersonPrototype";
  validateGodotString(rootName, "root_name");
  const sceneAbs = await resolveProjectPath(scenePath, { forWrite: true });
  assertExtension(sceneAbs, ".tscn");

  const existingScene = await findFirstPersonCharacterScene();
  const installNeeded = existingScene == null;
  const characterScene = existingScene ?? "res://addons/PlayerCharacter/player_character_scene.tscn";
  const plannedChanges = [
    ...(installNeeded && args.install_controller !== false
      ? [{ action: "install_controller", tool: "godot_install_first_person_controller", target: "res://addons/PlayerCharacter" }]
      : []),
    { action: "ensure_input_actions", count: FIRST_PERSON_INPUT_ACTIONS.length, target: "res://project.godot" },
    {
      action: await pathExists(sceneAbs) ? "overwrite_file" : "create_file",
      path: toResPath(sceneAbs),
      uses: characterScene,
      credit: FIRST_PERSON_CREDIT,
      note: "Instances Jeh3no's first-person PlayerCharacter instead of creating a capsule placeholder."
    }
  ];

  if (args.dry_run === true) {
    return plannedResult(plannedChanges, {
      path: toResPath(sceneAbs),
      characterScene,
      repository: FIRST_PERSON_CONTROLLER_REPO,
      credit: FIRST_PERSON_CREDIT,
      licenseNote: FIRST_PERSON_LICENSE_NOTE
    });
  }

  if (installNeeded) {
    if (args.install_controller === false) {
      throw new Error("Jeh3no first-person PlayerCharacter is not installed. Run godot_install_first_person_controller first or keep install_controller true.");
    }
    await godotInstallFirstPersonController({
      source_path: args.source_path,
      include_dependencies: args.include_dependencies ?? true,
      overwrite: Boolean(args.overwrite)
    });
  }

  const installedScene = await findFirstPersonCharacterScene();
  if (!installedScene) {
    throw new Error("Could not find player_character_scene.tscn inside res://addons/PlayerCharacter after install.");
  }

  const finalContent = buildFirstPersonPrototypeScene(rootName, installedScene);
  await assertCanWrite(sceneAbs, Boolean(args.overwrite));
  await fs.mkdir(path.dirname(sceneAbs), { recursive: true });
  await fs.writeFile(sceneAbs, finalContent, "utf8");
  const inputActions = await ensureFirstPersonInputActions(Boolean(args.overwrite_input_actions));

  return {
    ok: true,
    path: toResPath(sceneAbs),
    characterScene: installedScene,
    inputActions,
    repository: FIRST_PERSON_CONTROLLER_REPO,
    source: "Jeh3no first-person PlayerCharacter",
    credit: FIRST_PERSON_CREDIT,
    licenseNote: FIRST_PERSON_LICENSE_NOTE,
    note: "Created a first-person prototype scene with Jeh3no's upstream PlayerCharacter controller, not a simple capsule."
  };
}

async function godotImportImage(args) {
  requireString(args.source_path, "source_path");
  const sourceAbs = await resolveProjectPath(args.source_path, { mustExist: true });
  assertImageExtension(sourceAbs, "source_path");
  const targetPath = args.target_path ?? `assets/generated/${args.kind === "sprite" ? "sprites" : "textures"}/${path.basename(sourceAbs)}`;
  const targetAbs = await resolveProjectPath(targetPath, { forWrite: true });
  assertImageExtension(targetAbs, "target_path");
  await copyFileWithLimit(sourceAbs, targetAbs, MAX_IMAGE_BYTES, Boolean(args.overwrite));
  const importResult = args.run_import ? await runGodotImport(20000) : { status: "not_requested" };
  return {
    ok: true,
    source: toResPath(sourceAbs),
    target: toResPath(targetAbs),
    kind: args.kind ?? "texture",
    import: importResult,
    note: "Godot creates .import metadata during editor/import pass; this tool safely copies the source file."
  };
}

async function godotGenerateSprite(args) {
  return generateImageAsset(args, "sprites", "sprite");
}

async function godotGenerateTexture(args) {
  const prompt = args.seamless ? `${args.prompt}\nRequirement: seamless/tileable texture.` : args.prompt;
  return generateImageAsset({ ...args, prompt }, "textures", "texture");
}

async function generateImageAsset(args, folder, kind) {
  requireString(args.prompt, "prompt");
  const provider = args.provider ?? env.IMAGE_PROVIDER ?? "none";
  if (!IMAGE_PROVIDERS.includes(provider)) {
    throw new Error(`provider must be one of: ${IMAGE_PROVIDERS.join(", ")}.`);
  }
  const name = safeFilenamePart(args.name ?? kind);
  const targetPath = args.target_path ?? `assets/generated/${folder}/${name}.png`;
  const targetAbs = await resolveProjectPath(targetPath, { forWrite: true });
  assertImageExtension(targetAbs, "target_path");
  await assertCanWrite(targetAbs, false);
  return generateImageWithProvider({
    projectRoot,
    provider,
    prompt: args.prompt,
    targetAbs,
    targetResPath: toResPath(targetAbs),
    options: { name, size: args.size ?? "1024x1024", kind },
    env
  });
}

async function godotImport3dModel(args) {
  requireString(args.source_path, "source_path");
  const sourceAbs = await resolveProjectPath(args.source_path, { mustExist: true });
  assertModelExtension(sourceAbs, "source_path");
  const targetPath = args.target_path ?? `assets/models/${path.basename(sourceAbs)}`;
  const targetAbs = await resolveProjectPath(targetPath, { forWrite: true });
  assertModelExtension(targetAbs, "target_path");
  await copyFileWithLimit(sourceAbs, targetAbs, MAX_MODEL_BYTES, Boolean(args.overwrite));
  return {
    ok: true,
    source: toResPath(sourceAbs),
    target: toResPath(targetAbs),
    textures: await findLikelyModelTextures(sourceAbs),
    report: "Model copied into the project. Godot will import it when the editor/import pass runs."
  };
}

async function godotGenerate3dModel(args) {
  requireString(args.prompt, "prompt");
  const provider = args.provider ?? env.MODEL_3D_PROVIDER ?? "none";
  if (!MODEL_3D_PROVIDERS.includes(provider)) {
    throw new Error(`provider must be one of: ${MODEL_3D_PROVIDERS.join(", ")}.`);
  }
  const name = safeFilenamePart(args.name ?? "model");
  const targetPath = args.target_path ?? `assets/generated/models/${name}.glb`;
  const targetAbs = await resolveProjectPath(targetPath, { forWrite: true });
  assertModelExtension(targetAbs, "target_path");
  return generateModelWithProvider({
    projectRoot,
    provider,
    prompt: args.prompt,
    targetAbs,
    targetResPath: toResPath(targetAbs),
    options: { name, quality: args.quality ?? env.MESHY_QUALITY ?? "preview" },
    env
  });
}

async function godotListGenerationJobs(args) {
  const root = path.join(projectRoot, "generation_jobs");
  if (!(await pathExists(root))) {
    return { ok: true, jobs: [], count: 0 };
  }
  const kind = args.kind ?? "all";
  const status = args.status ? String(args.status) : "";
  const maxJobs = clampInteger(args.max_jobs ?? 100, 1, 1000);
  const files = await walk(root, { maxFiles: 30000 });
  const jobs = [];

  for (const rel of files.filter((file) => file.endsWith(".json"))) {
    if (jobs.length >= maxJobs) {
      break;
    }
    const parts = rel.split("/");
    const jobKind = parts[0] === "generation_jobs" ? parts[1] : "";
    if (kind !== "all" && jobKind !== kind) {
      continue;
    }
    const abs = path.join(projectRoot, fromProjectSeparators(rel));
    try {
      const job = JSON.parse(await readTextFile(abs, MAX_TEXT_BYTES));
      if (status && job.status !== status) {
        continue;
      }
      jobs.push({
        path: toResPath(abs),
        id: job.id ?? null,
        kind: job.kind ?? jobKind,
        provider: job.provider ?? null,
        status: job.status ?? null,
        targetPath: job.targetPath ?? null,
        createdAt: job.createdAt ?? null,
        updatedAt: job.updatedAt ?? null,
        promptPreview: typeof job.prompt === "string" ? job.prompt.slice(0, 160) : ""
      });
    } catch (error) {
      jobs.push({ path: toResPath(abs), error: sanitizeForLog(error.message ?? error, env) });
    }
  }

  jobs.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return { ok: true, count: jobs.length, jobs };
}

async function godotUpdateGenerationJobStatus(args) {
  requireString(args.status, "status");
  const abs = args.job_path
    ? await resolveGenerationJobPath(args.job_path)
    : await findGenerationJobById(args.id);
  const job = JSON.parse(await readTextFile(abs, MAX_TEXT_BYTES));
  job.status = args.status;
  job.updatedAt = new Date().toISOString();
  if (args.note != null) {
    job.note = String(args.note).slice(0, 1000);
  }
  await fs.writeFile(abs, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return { ok: true, path: toResPath(abs), id: job.id ?? null, status: job.status, updatedAt: job.updatedAt };
}

async function godotRunProject(args) {
  const scenePath = args.scene_path ? toProjectPath(await resolveProjectPath(args.scene_path, { mustExist: true })) : null;
  const mode = args.mode ?? "cli";
  if (mode === "editor") {
    if (args.dry_run !== false) {
      return { ok: true, dryRun: true, mode, bridge: { host: BRIDGE_HOST, port: BRIDGE_PORT }, command: "play_project", scenePath: scenePath ? toResPath(path.join(projectRoot, fromProjectSeparators(scenePath))) : "main" };
    }
    return callEditorBridge({
      command: "play_project",
      scene_path: scenePath ? toResPath(path.join(projectRoot, fromProjectSeparators(scenePath))) : "main"
    }, 3000);
  }
  const godot = await findGodotCommand();
  const runArgs = ["--path", projectRoot, ...(scenePath ? ["--scene", scenePath] : [])];
  if (!godot) {
    return { ok: false, status: "not_found", command: "godot", args: runArgs };
  }
  if (!isAllowedGodotCli(godot, runArgs)) {
    throw new Error("Godot CLI command was rejected by the whitelist.");
  }
  if (args.dry_run !== false) {
    return { ok: true, dryRun: true, command: godot, args: runArgs };
  }
  if (clampInteger(args.wait_ms ?? 0, 0, 15000) === 0) {
    return launchTrackedGame(godot, runArgs, scenePath);
  }
  return runCommand(godot, runArgs, clampInteger(args.wait_ms ?? 0, 0, 15000), { detachWhenNoWait: true });
}

async function godotRuntimeStatus(args) {
  const includeBridge = args.include_bridge !== false;
  return {
    ok: true,
    cli: trackedGameStatus(),
    bridge: includeBridge ? await callEditorBridge({ command: "status" }, clampInteger(args.timeout_ms ?? 1000, 200, 5000)) : null
  };
}

async function godotStopProject(args) {
  const mode = args.mode ?? "auto";
  const timeoutMs = clampInteger(args.timeout_ms ?? 3000, 200, 10000);
  const result = { ok: true, mode, cli: null, bridge: null, stopped: false };

  if (mode === "auto" || mode === "cli") {
    result.cli = await stopTrackedGame(timeoutMs);
    result.stopped ||= Boolean(result.cli.stopped);
  }

  if (mode === "auto" || mode === "editor") {
    result.bridge = await callEditorBridge({ command: "stop_project" }, timeoutMs);
    result.stopped ||= Boolean(result.bridge?.response?.stopped);
  }

  return result;
}

async function godotCaptureScreenshot(args) {
  const frames = clampInteger(args.frames ?? 3, 1, 120);
  const timeoutMs = clampInteger(args.timeout_ms ?? 30000, 1000, 120000);
  const scenePath = args.scene_path ? toProjectPath(await resolveProjectPath(args.scene_path, { mustExist: true })) : null;
  const outputPath = args.output_path ?? `docs/assets/screenshots/runtime/screenshot-${safeTimestamp()}.png`;
  const outputAbs = await resolveProjectPath(outputPath, { forWrite: true });
  assertScreenshotExtension(outputAbs, "output_path");
  await assertCanWrite(outputAbs, Boolean(args.overwrite));

  const godot = await findGodotCommand();
  const runArgs = ["--path", projectRoot, ...(scenePath ? ["--scene", scenePath] : []), "--write-movie", outputAbs, "--quit-after", String(frames)];
  if (!godot) {
    return { ok: false, status: "not_found", command: "godot", args: runArgs };
  }
  if (!isAllowedGodotCli(godot, runArgs)) {
    throw new Error("Godot CLI screenshot command was rejected by the whitelist.");
  }
  if (args.dry_run === true) {
    return { ok: true, dryRun: true, command: godot, args: runArgs, expectedOutput: toResPath(outputAbs) };
  }

  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  const before = await listPngNames(path.dirname(outputAbs));
  const commandResult = await runCommand(godot, runArgs, timeoutMs);
  const captures = await collectScreenshotOutputs(outputAbs, before);
  const ok = commandResult.status === "completed" && commandResult.exitCode === 0 && captures.length > 0;
  return {
    ok,
    command: commandResult,
    requestedOutput: toResPath(outputAbs),
    screenshots: captures.map((item) => toResPath(item)),
    report: ok ? "Screenshot capture completed." : "Godot finished without a detected PNG screenshot. Check stdout/stderr for Movie Maker output."
  };
}

async function godotCaptureEditorViewport(args) {
  const outputPath = args.output_path ?? `docs/assets/screenshots/editor/editor-${safeTimestamp()}.png`;
  const outputAbs = await resolveProjectPath(outputPath, { forWrite: true });
  assertScreenshotExtension(outputAbs, "output_path");
  await assertCanWrite(outputAbs, Boolean(args.overwrite));
  await fs.mkdir(path.dirname(outputAbs), { recursive: true });

  return callEditorBridge({
    command: "capture_editor_viewport",
    viewport: args.viewport ?? "3d",
    viewport_index: clampInteger(args.viewport_index ?? 0, 0, 3),
    output_path: toResPath(outputAbs)
  }, clampInteger(args.timeout_ms ?? 1000, 200, 5000));
}

async function godotCheckErrors(args) {
  const runGodot = args.run_godot !== false;
  const timeoutMs = clampInteger(args.timeout_ms ?? 20000, 1000, 60000);
  const warnings = [];
  const errors = [];
  const details = {};

  try {
    await fs.access(path.join(projectRoot, "project.godot"), fsConstants.R_OK);
  } catch {
    errors.push("project.godot is missing or unreadable.");
  }

  const files = await walk(projectRoot, { maxFiles: 30000 });
  for (const scenePath of files.filter((file) => file.endsWith(".tscn"))) {
    try {
      const scene = parseSceneText(await readTextFile(path.join(projectRoot, fromProjectSeparators(scenePath)), MAX_TEXT_BYTES));
      if (!scene.root) {
        errors.push(`${scenePath}: missing root node.`);
      }
    } catch (error) {
      errors.push(`${scenePath}: ${sanitizeForLog(error.message ?? error, env)}`);
    }
  }
  for (const scriptPath of files.filter((file) => file.endsWith(".gd"))) {
    const text = await readTextFile(path.join(projectRoot, fromProjectSeparators(scriptPath)), MAX_TEXT_BYTES);
    if (!/^\s*extends\s+\w+/m.test(text)) {
      warnings.push(`${scriptPath}: no top-level extends line found.`);
    }
  }

  if (runGodot) {
    const godotResult = await runGodotCheck(timeoutMs);
    details.godot = godotResult;
    if (godotResult.status === "not_found") {
      warnings.push("Godot executable was not found on PATH; only static validation ran.");
    } else if (godotResult.exitCode !== 0) {
      errors.push(`Godot headless check exited with code ${godotResult.exitCode}.`);
    }
  }

  return { ok: errors.length === 0, warnings, errors, details };
}

function groupToolsByCategory() {
  const grouped = {};
  for (const item of tools) {
    const category = toolCategory(item.name);
    grouped[category] ??= [];
    grouped[category].push(item.name);
  }
  return grouped;
}

function toolCategory(name) {
  if (name === "godot_help" || name === "godot_agent_instructions" || name === "godot_doctor" || name === "godot_codex_config") return "discovery";
  if (name.includes("bridge")) return "bridge";
  if (name.includes("runtime") || name.includes("run") || name.includes("stop") || name.includes("screenshot") || name.includes("viewport")) return "runtime";
  if (name.includes("scan") || name.includes("list") || name.includes("read") || name.includes("check") || name.includes("search")) return "inspect";
  if (name.includes("scene") || name.includes("node") || name.includes("script") || name.includes("input") || name.includes("autoload") || name.includes("prototype")) return "edit";
  if (name.includes("image") || name.includes("texture") || name.includes("model") || name.includes("sprite") || name.includes("material") || name.includes("generation_job") || name.includes("third_person_controller") || name.includes("first_person_controller")) return "assets";
  return "misc";
}

function workflowHelp() {
  return {
    inspectProject: ["godot_doctor", "godot_project_scan", "godot_list_scenes", "godot_list_scripts", "godot_check_errors"],
    createSimpleScene: ["godot_create_script/dry_run:true", "godot_create_scene/dry_run:true", "godot_create_script", "godot_create_scene", "godot_attach_script", "godot_add_node", "godot_read_scene", "godot_check_errors"],
    createThirdPersonPrototype: ["godot_install_third_person_controller", "godot_create_third_person_prototype", "godot_read_scene", "godot_check_errors"],
    createFirstPersonPrototype: ["godot_install_first_person_controller", "godot_create_first_person_prototype", "godot_read_scene", "godot_check_errors"],
    importSprite: ["godot_import_image", "godot_add_node", "godot_update_node", "godot_check_errors"],
    generationSafeMode: ["godot_generate_sprite/provider:none", "godot_generate_texture/provider:none", "godot_generate_3d_model/provider:none"],
    reviewGenerationJobs: ["godot_list_generation_jobs", "godot_update_generation_job_status"],
    runtimeDebugAfterScripts: ["godot_check_errors/run_godot:true", "godot_run_project/dry_run:false", "inspect Godot console stdout/stderr", "fix errors", "rerun until console has no errors", "godot_stop_project"],
    visualCheckAfterSceneObjects: ["godot_run_project/dry_run:false", "godot_capture_screenshot", "inspect placement/visibility/scale/framing", "fix scene", "repeat screenshot if needed", "godot_stop_project"],
    runtimeLoop: ["godot_run_project/dry_run:false", "godot_runtime_status", "godot_capture_screenshot", "godot_stop_project"],
    editorBridgeLoop: ["enable addons/ai_mcp_bridge", "godot_bridge_status", "godot_editor_scene_snapshot", "godot_run_project/mode:editor", "godot_stop_project/mode:editor"]
  };
}

function agentHelp() {
  return {
    mode: "instruction_first",
    principle: "The user's AI client plans the Godot work, writes domain-specific code/content, and decides the next step. MCP JS tools provide sandboxed project primitives for reading, writing, importing, running, and validating.",
    startWith: ["godot_agent_instructions", "godot_doctor", "godot_project_scan", "godot_check_errors"],
    aiClientOwns: [
      "understanding the user's intent",
      "choosing Godot 4 nodes, scripts, resources, and scene structure",
      "writing GDScript and scene content that matches the project",
      "deciding whether to use research-first mechanics, third-person, first-person, asset, debug, or validation workflow",
      "reading tool results and correcting the next action"
    ],
    researchFirstForMechanics: {
      requiredWhen: "The user asks for a complex mechanic, advanced system, or any gameplay behavior the AI client is not already confident implementing well.",
      sources: ["GitHub repositories", "YouTube implementation/tutorial videos", "official Godot documentation", "articles or demos from credible Godot developers"],
      rules: [
        "Search the web before implementing when the mechanic is unfamiliar or complex.",
        "Prefer Godot 4.x implementations; translate Godot 3.x APIs carefully only when needed.",
        "Record useful source links and license notes in the plan or final summary.",
        "Do not copy incompatible or unclear-license code verbatim.",
        "Extract the design pattern, adapt it to the current project, then validate in Godot."
      ]
    },
    jsToolsOwn: [
      "path sandboxing inside the project root",
      "small reversible file writes with dry_run and overwrite controls",
      "project scanning, safe text search, and text .tscn parsing",
      "provider queue files and configured provider adapters",
      "Godot CLI/editor bridge validation when available"
    ],
    keepInJsBecause: [
      "security boundaries and path normalization",
      "repeatable fixture tests",
      "provider credential handling through .env",
      "local Godot process and editor bridge control"
    ],
    docs: ["docs/MCP_AGENT_INSTRUCTIONS.md", "docs/MCP_CAPABILITIES.md"]
  };
}

function coverageHelp() {
  return {
    strong: ["project doctor", "Codex config generation", "project scan/search", "scene/script list/read for .tscn/.gd", "safe .tscn create/add/update with dry_run", "GDScript creation", "input action/autoload/material creation", "project-local image/model import", "third-person character prototype using Jeh3no PlayerCharacter instead of a capsule", "first-person/FPS prototype using Jeh3no Advanced State Machine First Person Controller instead of a capsule", "provider job queue and status updates", "static validation", "tracked CLI run/stop", "PNG game screenshots through Godot Movie Maker"],
    partial: ["Godot CLI run/check/screenshot, depends on Godot executable availability", "Editor bridge play/stop/snapshot, depends on plugin enabled in the editor", "OpenAI/custom_http image generation, depends on .env credentials and network approval", "third-person controller download, depends on GitHub network availability unless source_path is provided", "first-person controller download, depends on GitHub network availability unless source_path is provided"],
    intentionallyLimited: ["binary .scn editing", "arbitrary shell commands", "delete node/file operations", "full UndoRedo integration from MCP"],
    futureCandidates: ["runtime autoload for input simulation and live runtime tree inspection", "LSP/DAP integration", "ClassDB introspection", "paged tool profiles for small-context clients"]
  };
}

function safetyHelp() {
  return {
    readOnlyMode: "Set GODOT_MCP_READ_ONLY=true or READ_ONLY_MODE=true to block write/run/generation tools.",
    pathSandbox: "Every tool resolves project-local or res:// paths and rejects paths outside the Godot project root.",
    shellPolicy: "No arbitrary shell command tool exists. External execution is limited to whitelisted Godot CLI shapes.",
    secrets: ".env is read for provider keys. Logs are sanitized for common key/token/secret values.",
    destructiveOps: "No delete tools are exposed."
  };
}

function generationHelp() {
  return {
    imageProviders: IMAGE_PROVIDERS,
    modelProviders: MODEL_3D_PROVIDERS,
    defaultBehavior: "provider=none writes a job file under generation_jobs/ instead of calling a service.",
    realAdapters: ["openai image generation", "custom_http image generation", "meshy text-to-3d", "tripo text-to-model", "custom_http model generation"],
    declaredInterfaces: ["polza_ai", "local_comfyui"],
    modelProviderKeys: {
      meshy: ["MODEL_3D_PROVIDER=meshy", "MESHY_API_KEY", "MESHY_QUALITY=preview|refine"],
      tripo: ["MODEL_3D_PROVIDER=tripo", "TRIPO_API_KEY"],
      custom_http: ["MODEL_3D_PROVIDER=custom_http", "CUSTOM_MODEL_HTTP_URL", "CUSTOM_MODEL_HTTP_TOKEN optional"]
    },
    notes: [
      "Generated 3D models are saved as GLB by default under assets/generated/models/.",
      "A .glb.meta.json sidecar records prompt, provider, source, and license notes.",
      "Provider keys must be in .env or environment variables; tool results never echo secret values."
    ]
  };
}

function debugHelp() {
  return {
    afterGameplayScriptChanges: {
      required: true,
      appliesTo: ["scene-attached .gd", "scripts/", "autoload gameplay code", "controller/input/physics/UI runtime logic"],
      steps: [
        "Run godot_check_errors with run_godot:true when Godot CLI is available.",
        "Run the game or target scene with godot_run_project dry_run:false, or use the editor bridge.",
        "Inspect the Godot console output from stdout/stderr/runtime status.",
        "If project errors appear, fix them and run again.",
        "Repeat until the latest Godot console output has no errors, then stop the game with godot_stop_project."
      ],
      completionRule: "Do not claim gameplay script changes are complete until the latest Godot console run has no errors. If Godot cannot run, report that blocker explicitly."
    },
    afterSceneObjectPlacement: {
      requiredScreenshot: true,
      appliesTo: ["adding visible objects", "moving objects", "scaling objects", "rotating objects", "placing imported or generated assets"],
      steps: [
        "Launch the game or target scene.",
        "Capture a screenshot with godot_capture_screenshot or godot_capture_editor_viewport.",
        "Inspect placement, visibility, scale, clipping, overlaps, material/import issues, and camera framing.",
        "Fix problems and repeat the screenshot check until the placement looks correct."
      ],
      completionRule: "Do not claim placed scene objects are correct without a screenshot check, unless screenshot capture is unavailable and that limitation is reported."
    }
  };
}

function bridgeHelp() {
  return {
    host: BRIDGE_HOST,
    port: BRIDGE_PORT,
    plugin: "Enable addons/ai_mcp_bridge in Godot Project Settings > Plugins.",
    why: "Use the bridge for live editor/API-backed operations where direct .tscn text editing is too limited.",
    currentCommands: ["status", "scene_snapshot", "play_project", "stop_project", "capture_editor_viewport", "create_script", "create_scene", "add_node", "update_node", "attach_script"]
  };
}

function normalizeAgentClient(client) {
  const value = String(client ?? "generic").toLowerCase();
  if (value === "codex" || value === "claude") return value;
  return "generic";
}

function selectAgentWorkflow(workflow, task) {
  const explicit = String(workflow ?? "auto").toLowerCase();
  if (explicit && explicit !== "auto") return explicit;
  const text = String(task ?? "").toLowerCase();
  if (isComplexMechanicTask(text)) return "research_mechanic";
  if (text.includes("first person") || text.includes("first-person") || text.includes("1st person") || text.includes("fps") || text.includes("\u043e\u0442 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043b\u0438\u0446\u0430") || text.includes("\u0444\u043f\u0441")) {
    return "first_person";
  }
  if (text.includes("third person") || text.includes("third-person") || text.includes("3rd person") || text.includes("player character") || (text.includes("prototype") && text.includes("character")) || (text.includes("\u043f\u0440\u043e\u0442\u043e\u0442\u0438\u043f") && text.includes("\u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436"))) {
    return "third_person";
  }
  if (text.includes("debug") || text.includes("error") || text.includes("run") || text.includes("play") || text.includes("console")) return "debug";
  if (text.includes("screenshot") || text.includes("placement") || text.includes("visible") || text.includes("viewport")) return "visual_check";
  if (text.includes("provider") || text.includes("api key") || text.includes("mesh") || text.includes("3d model") || text.includes("sprite") || text.includes("texture") || text.includes("asset")) return "assets";
  if (text.includes("bridge") || text.includes("editor")) return "bridge";
  if (text.includes("scene") || text.includes("node") || text.includes("script")) return "create_scene";
  return "inspect";
}

function isComplexMechanicTask(text) {
  const complexityWords = [
    "complex",
    "advanced",
    "unknown",
    "unfamiliar",
    "not familiar",
    "сложн",
    "незнаком",
    "не знаком",
    "не знаю",
    "не уме",
    "механик",
    "михан",
    "mechanic",
    "system",
    "система"
  ];
  const mechanicWords = [
    "grappling",
    "hook",
    "parkour",
    "wall run",
    "wallrun",
    "ledge",
    "mantle",
    "climb",
    "swimming",
    "flight",
    "vehicle",
    "inventory",
    "crafting",
    "combat",
    "combo",
    "dialogue",
    "dialog",
    "quest",
    "save system",
    "procedural",
    "парк",
    "крюк",
    "кошка",
    "лазани",
    "карабкан",
    "инвентар",
    "крафт",
    "боев",
    "комбо",
    "диалог",
    "квест",
    "сохран",
    "процедур"
  ];
  return complexityWords.some((word) => text.includes(word)) && mechanicWords.some((word) => text.includes(word));
}

function buildAgentInstructions({ client, workflow, task, detail }) {
  const selected = agentWorkflowInstructions(workflow);
  const toolChain = toolChainForAgentWorkflow(workflow);
  const base = {
    principle: "Instruction-first: the AI client owns planning, code/content decisions, and review. MCP JS tools are safe primitives, not the main source of project intelligence.",
    clientGuidance: clientGuidance(client),
    agentResponsibilities: [
      "Restate the user's goal in concrete Godot 4 terms before writing.",
      "Inspect the project first and follow existing folders, naming, and scripts.",
      "Use dry_run for scene/script writes when the change is more than a tiny one-liner.",
      "Write Godot-facing paths as res:// or project-local paths.",
      "Use MCP tools for sandboxed reads/writes/imports/validation, then interpret the results yourself.",
      "Report every file created or changed."
    ],
    mcpPrimitiveUse: [
      "Scan/search/read project context.",
      "Apply small safe writes after the AI client has decided what to write.",
      "Queue provider jobs or call configured providers without exposing secrets.",
      "Run Godot CLI/editor bridge checks when available.",
      "Reject unsafe paths, overwrites, and read-only blocked writes."
    ],
    notForJsScripts: [
      "Do not expect MCP JS to design gameplay, UI, architecture, or story content.",
      "Do not ask MCP JS to invent large GDScript systems without the AI client reviewing code.",
      "Do not bypass dry_run, screenshot checks, console checks, or .env secret rules."
    ],
    workflowInstructions: selected,
    toolChain,
    readyPrompt: readyAgentPrompt(client, workflow, task)
  };
  if (detail === "short") {
    return {
      principle: base.principle,
      workflow: selected.name,
      steps: selected.steps,
      toolChain,
      readyPrompt: base.readyPrompt
    };
  }
  return base;
}

function clientGuidance(client) {
  if (client === "codex") {
    return "Codex should call godot_agent_instructions for the user task, then use MCP tools as project-safe primitives while keeping reasoning and implementation choices in the agent.";
  }
  if (client === "claude") {
    return "Claude should read this result as the operating prompt for the Godot MCP server: plan in Claude, call tools only for project IO, imports, generation jobs, and validation.";
  }
  return "Any MCP-capable AI client should plan and write the solution itself, using MCP tools as safe project operations.";
}

function agentWorkflowInstructions(workflow) {
  const workflows = {
    inspect: {
      name: "inspect",
      intent: "Understand the project before editing.",
      steps: ["Run doctor and scan.", "List scenes and scripts.", "Read only the files needed for the task.", "Summarize safe next steps before writing."]
    },
    create_scene: {
      name: "create_scene",
      intent: "Create or modify a scene/script with AI-authored Godot 4 content.",
      steps: ["Inspect existing scene/script patterns.", "Draft the node tree and script behavior in the AI client.", "Use dry_run for script and scene writes.", "Apply the smallest useful writes.", "Read back the scene and run validation."]
    },
    research_mechanic: {
      name: "research_mechanic",
      intent: "Implement a complex or unfamiliar gameplay mechanic only after researching proven implementations.",
      steps: [
        "Pause implementation and describe what is unknown about the mechanic.",
        "Search GitHub, YouTube, official Godot docs, and credible web tutorials for Godot 4.x examples or close equivalents.",
        "Compare at least two sources when possible, noting Godot version, license, quality, and whether code can be reused or only studied.",
        "Extract the design pattern and adapt it to this project's existing scenes, scripts, inputs, and assets.",
        "Implement with small dry-run guarded MCP writes where possible.",
        "Run Godot checks, run the game or target scene for gameplay script changes, inspect console output, and screenshot visible results when relevant.",
        "Credit source links and license notes in the final summary."
      ]
    },
    third_person: {
      name: "third_person",
      intent: "Create a character prototype using Jeh3no third-person data, not a capsule placeholder.",
      steps: ["Install the Jeh3no third-person controller.", "Create the prototype scene.", "Read back the scene.", "Credit Jeh3no in the final summary.", "Validate with Godot checks when available."]
    },
    first_person: {
      name: "first_person",
      intent: "Create a first-person/FPS prototype using Jeh3no data, not a capsule placeholder.",
      steps: ["Install the Jeh3no first-person controller.", "Create the prototype scene.", "Read back the scene.", "Credit Jeh3no in the final summary.", "Validate with Godot checks when available."]
    },
    assets: {
      name: "assets",
      intent: "Import or generate assets while keeping provider decisions and prompts reviewable.",
      steps: ["Keep provider none unless .env config and user intent allow a real provider.", "Write or refine prompts in the AI client.", "Queue generation jobs or call configured provider tools.", "Import assets into project folders.", "Validate references and screenshots when assets are visible."]
    },
    debug: {
      name: "debug",
      intent: "Debug gameplay or runtime changes.",
      steps: ["Run static/Godot checks.", "Run the game or target scene when Godot is available.", "Inspect console output.", "Fix errors in the AI client using project context.", "Rerun until the latest console output is clean or report the blocker."]
    },
    visual_check: {
      name: "visual_check",
      intent: "Verify visible scene placement.",
      steps: ["Run the scene or use the editor bridge.", "Capture a screenshot.", "Inspect placement, visibility, scale, material, clipping, and camera framing.", "Fix and repeat if needed.", "Report screenshot path or validation limitation."]
    },
    provider_setup: {
      name: "provider_setup",
      intent: "Configure image or 3D model generation providers safely.",
      steps: ["Keep real keys only in .env.", "Use provider none by default.", "Use the bridge UI or .env for Meshy/Tripo/custom HTTP settings.", "Restart the MCP client after .env changes.", "Never echo secrets in logs or docs."]
    },
    bridge: {
      name: "bridge",
      intent: "Use the optional Godot editor bridge for live editor context.",
      steps: ["Enable AI MCP Bridge in Godot.", "Start the localhost bridge.", "Check status.", "Use scene snapshot or viewport screenshot.", "Fall back to file-based tools when the bridge is unavailable."]
    }
  };
  return workflows[workflow] ?? workflows.inspect;
}

function toolChainForAgentWorkflow(workflow) {
  const chains = {
    inspect: ["godot_doctor", "godot_project_scan", "godot_list_scenes", "godot_list_scripts", "godot_check_errors"],
    create_scene: ["godot_project_scan", "godot_create_script/dry_run:true", "godot_create_scene/dry_run:true", "godot_create_script", "godot_create_scene", "godot_read_scene", "godot_check_errors"],
    research_mechanic: ["godot_agent_instructions/workflow:research_mechanic", "external research: GitHub + YouTube + docs/web", "compare sources and licenses", "godot_project_scan", "dry_run planned writes", "implement adapted Godot 4 pattern", "godot_check_errors", "godot_run_project/dry_run:false if gameplay scripts changed", "godot_capture_screenshot if visible objects changed"],
    third_person: ["godot_install_third_person_controller", "godot_create_third_person_prototype", "godot_read_scene", "godot_check_errors"],
    first_person: ["godot_install_first_person_controller", "godot_create_first_person_prototype", "godot_read_scene", "godot_check_errors"],
    assets: ["godot_generate_sprite/provider:none", "godot_generate_texture/provider:none", "godot_generate_3d_model/provider:none", "godot_list_generation_jobs", "godot_check_errors"],
    debug: ["godot_check_errors", "godot_run_project/dry_run:false", "godot_runtime_status", "godot_stop_project"],
    visual_check: ["godot_run_project/dry_run:false", "godot_capture_screenshot", "godot_stop_project"],
    provider_setup: ["godot_help/category:generation", "godot_doctor", "godot_list_generation_jobs"],
    bridge: ["godot_bridge_status", "godot_editor_scene_snapshot", "godot_capture_editor_viewport"]
  };
  return chains[workflow] ?? chains.inspect;
}

function readyAgentPrompt(client, workflow, task) {
  const taskLine = task ? ` User task: ${task}.` : "";
  const researchLine = workflow === "research_mechanic" ? " Because this is a complex or unfamiliar mechanic, search GitHub, YouTube, official Godot docs, and credible web tutorials before implementing; keep source links and license notes." : "";
  return `Use instruction-first Godot MCP mode for ${client}.${taskLine} Plan and write the solution in the AI client. Use MCP tools only as safe primitives for project scan/read/write/import/generation jobs/runtime validation. Start with godot_doctor, godot_project_scan, and godot_check_errors, then follow the ${workflow} workflow.${researchLine}`;
}

function toolAgentUse(name) {
  if (name === "godot_agent_instructions" || name === "godot_help") return "Instruction provider for the AI client; it should guide planning rather than perform project edits.";
  if (WRITE_TOOLS.has(name)) return "Project primitive. The AI client should decide the intended change first, use dry_run/overwrite guards when available, then read back and validate.";
  return "Read-only context or validation primitive. The AI client should interpret the result and decide the next step.";
}

function usageTemplate(name) {
  const templates = {
    godot_agent_instructions: { client: "codex", workflow: "auto", task: "create a first person prototype", detail: "full" },
    godot_doctor: { timeout_ms: 1000 },
    godot_codex_config: { server_name: "godotMCP", startup_timeout_sec: 20 },
    godot_project_scan: { max_files: 8000, max_depth: 6 },
    godot_search_project: { query: "Player", folder: "", extensions: [".gd", ".tscn"], max_results: 20 },
    godot_list_scenes: { folder: "" },
    godot_list_scripts: { folder: "scripts", include_text: false },
    godot_read_scene: { path: "scenes/example.tscn", include_text: false },
    godot_create_scene: { path: "scenes/example.tscn", root_type: "Node2D", root_name: "Example", overwrite: false, dry_run: true },
    godot_add_node: { scene_path: "scenes/example.tscn", parent_path: ".", node_type: "Sprite2D", node_name: "Sprite", properties: { position: [0, 0] }, dry_run: true },
    godot_update_node: { scene_path: "scenes/example.tscn", node_path: "Sprite", properties: { visible: true }, dry_run: true },
    godot_attach_script: { scene_path: "scenes/example.tscn", node_path: ".", script_path: "scripts/example.gd", extends: "Node2D", dry_run: true },
    godot_create_script: { path: "scripts/example.gd", extends: "Node2D", description: "Example script", dry_run: true },
    godot_create_input_action: { action: "jump", events: [{ type: "key", keycode: 32 }] },
    godot_create_autoload: { name: "GameState", script_path: "scripts/game_state.gd", singleton: true },
    godot_create_material: { path: "assets/materials/example.tres", material_type: "StandardMaterial3D", albedo_color: [1, 1, 1, 1] },
    godot_install_third_person_controller: { include_dependencies: true, overwrite: false, dry_run: true },
    godot_create_third_person_prototype: { scene_path: "scenes/third_person_prototype.tscn", install_controller: true, dry_run: true },
    godot_install_first_person_controller: { include_dependencies: true, overwrite: false, dry_run: true },
    godot_create_first_person_prototype: { scene_path: "scenes/first_person_prototype.tscn", install_controller: true, dry_run: true },
    godot_import_image: { source_path: "icon.svg", target_path: "assets/generated/sprites/icon.svg", kind: "sprite" },
    godot_generate_sprite: { provider: "none", prompt: "small friendly slime sprite", target_path: "assets/generated/sprites/slime.png" },
    godot_generate_texture: { provider: "none", prompt: "tileable stone floor", seamless: true, target_path: "assets/generated/textures/stone.png" },
    godot_import_3d_model: { source_path: "assets/source/models/prop.glb", target_path: "assets/models/prop.glb" },
    godot_generate_3d_model: { provider: "none", prompt: "low poly treasure chest", target_path: "assets/generated/models/chest.glb", quality: "preview" },
    godot_list_generation_jobs: { kind: "all", max_jobs: 50 },
    godot_update_generation_job_status: { job_path: "generation_jobs/images/example.json", status: "done", note: "Imported manually." },
    godot_run_project: { mode: "cli", dry_run: true },
    godot_runtime_status: { include_bridge: true, timeout_ms: 1000 },
    godot_stop_project: { mode: "auto", timeout_ms: 3000 },
    godot_capture_screenshot: { scene_path: "scenes/example.tscn", output_path: "docs/assets/screenshots/runtime/example.png", frames: 3 },
    godot_capture_editor_viewport: { viewport: "3d", viewport_index: 0, output_path: "docs/assets/screenshots/editor/current-3d.png" },
    godot_editor_scene_snapshot: { max_depth: 8, timeout_ms: 1000 },
    godot_check_errors: { run_godot: true, timeout_ms: 20000 },
    godot_bridge_status: { timeout_ms: 1000 },
    godot_help: { category: "overview" }
  };
  return templates[name] ?? {};
}

function suggestToolChain(task) {
  const text = String(task).toLowerCase();
  if (isComplexMechanicTask(text)) {
    return ["godot_agent_instructions/workflow:research_mechanic", "external research: GitHub + YouTube + docs/web", "godot_doctor", "godot_project_scan", "dry_run planned writes", "godot_check_errors", "runtime console/screenshot validation when applicable"];
  }
  if (
    text.includes("first person") ||
    text.includes("first-person") ||
    text.includes("1st person") ||
    text.includes("fps") ||
    text.includes("\u043e\u0442 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043b\u0438\u0446\u0430") ||
    text.includes("\u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043b\u0438\u0446\u0430") ||
    text.includes("\u0444\u043f\u0441")
  ) {
    return ["godot_doctor", "godot_project_scan", "godot_install_first_person_controller", "godot_create_first_person_prototype", "godot_check_errors"];
  }
  if (
    text.includes("third person") ||
    text.includes("third-person") ||
    text.includes("3rd person") ||
    text.includes("player character") ||
    (text.includes("prototype") && text.includes("character")) ||
    (text.includes("прототип") && text.includes("персонаж")) ||
    (text.includes("от третьего лица") && text.includes("сцен"))
  ) {
    return ["godot_doctor", "godot_project_scan", "godot_install_third_person_controller", "godot_create_third_person_prototype", "godot_check_errors"];
  }
  if (text.includes("sprite") || text.includes("texture") || text.includes("image")) {
    return ["godot_doctor", "godot_help/tool:godot_generate_sprite", "godot_generate_sprite", "godot_list_generation_jobs", "godot_import_image", "godot_check_errors"];
  }
  if (text.includes("3d") || text.includes("model") || text.includes("mesh")) {
    return ["godot_doctor", "godot_help/tool:godot_import_3d_model", "godot_generate_3d_model", "godot_list_generation_jobs", "godot_import_3d_model", "godot_check_errors"];
  }
  if (text.includes("scene") || text.includes("node")) {
    return ["godot_project_scan", "godot_create_script/dry_run:true", "godot_create_scene/dry_run:true", "godot_create_script", "godot_create_scene", "godot_add_node", "godot_read_scene", "godot_check_errors"];
  }
  if (text.includes("input") || text.includes("autoload") || text.includes("material")) {
    return ["godot_doctor", "godot_project_scan", "godot_create_input_action or godot_create_autoload or godot_create_material", "godot_check_errors"];
  }
  if (text.includes("screenshot") || text.includes("capture")) {
    return ["godot_check_errors", "godot_run_project/dry_run:true", "godot_capture_screenshot", "godot_runtime_status"];
  }
  if (text.includes("debug") || text.includes("run") || text.includes("play") || text.includes("stop")) {
    return ["godot_check_errors", "godot_run_project/dry_run:true", "godot_runtime_status", "godot_stop_project"];
  }
  return ["godot_doctor", "godot_project_scan", "godot_help/category:workflows", "godot_check_errors"];
}

function callEditorBridge(request, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: BRIDGE_HOST, port: BRIDGE_PORT });
    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => settle({ ok: false, connected: false, status: "timeout", host: BRIDGE_HOST, port: BRIDGE_PORT }), timeoutMs);

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) {
        return;
      }
      const line = buffer.slice(0, buffer.indexOf("\n")).trim();
      try {
        settle({ ok: true, connected: true, host: BRIDGE_HOST, port: BRIDGE_PORT, response: JSON.parse(line) });
      } catch (error) {
        settle({ ok: false, connected: true, host: BRIDGE_HOST, port: BRIDGE_PORT, error: sanitizeForLog(error.message ?? error, env), raw: sanitizeForLog(line, env) });
      }
    });
    socket.on("error", (error) => {
      settle({ ok: false, connected: false, host: BRIDGE_HOST, port: BRIDGE_PORT, error: sanitizeForLog(error.message ?? error, env), hint: "Open Godot, enable AI MCP Bridge, and press Start in the dock." });
    });

    function settle(value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    }
  });
}

function thirdPersonInstallRoots(args) {
  const roots = [THIRD_PERSON_CONTROLLER_ROOTS.player];
  if (args.include_dependencies !== false) {
    roots.push(...THIRD_PERSON_CONTROLLER_ROOTS.dependencies);
  }
  if (args.include_test_map === true) {
    roots.push(...THIRD_PERSON_CONTROLLER_ROOTS.testMap);
  }
  return roots;
}

function firstPersonInstallRoots(args) {
  const roots = [FIRST_PERSON_CONTROLLER_ROOTS.player];
  if (args.include_dependencies !== false) {
    roots.push(...FIRST_PERSON_CONTROLLER_ROOTS.dependencies);
  }
  if (args.include_test_map === true) {
    roots.push(...FIRST_PERSON_CONTROLLER_ROOTS.testMap);
  }
  return roots;
}

function validateGitRef(value) {
  const ref = String(value ?? THIRD_PERSON_CONTROLLER_REF);
  if (!/^[A-Za-z0-9._/-]+$/.test(ref) || ref.includes("..") || ref.startsWith("/") || ref.endsWith("/")) {
    throw new Error("ref must be a simple Git branch, tag, or commit name.");
  }
  return ref;
}

async function assertInstallTargetsWritable(roots, overwrite) {
  for (const root of roots) {
    const abs = await resolveProjectPath(root, { forWrite: true });
    try {
      const stat = await fs.stat(abs);
      if (!stat.isDirectory()) {
        throw new Error(`${root} already exists and is not a directory.`);
      }
      if (!overwrite) {
        throw new Error(`${root} already exists; pass overwrite: true to replace files.`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function collectThirdPersonFilesFromLocalSource(sourcePath, roots) {
  requireString(sourcePath, "source_path");
  const sourceRoot = await resolveProjectPath(sourcePath, { mustExist: true, expectDirectory: true });
  const files = [];
  for (const root of roots) {
    const sourceDir = path.join(sourceRoot, fromProjectSeparators(root));
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) {
      throw new Error(`source_path must contain ${root}.`);
    }
    for (const fileAbs of await collectAbsoluteFiles(sourceDir, 5000)) {
      const relative = path.relative(sourceDir, fileAbs).split(path.sep).join("/");
      files.push({
        path: `${root}/${relative}`,
        bytes: await fs.readFile(fileAbs)
      });
    }
  }
  return files;
}

async function collectFirstPersonFilesFromLocalSource(sourcePath, roots) {
  requireString(sourcePath, "source_path");
  const sourceRoot = await resolveProjectPath(sourcePath, { mustExist: true, expectDirectory: true });
  const files = [];
  for (const root of roots) {
    const sourceDir = path.join(sourceRoot, fromProjectSeparators(root));
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) {
      throw new Error(`source_path must contain ${root}.`);
    }
    for (const fileAbs of await collectAbsoluteFiles(sourceDir, 8000)) {
      const relative = path.relative(sourceDir, fileAbs).split(path.sep).join("/");
      files.push({
        path: `${root}/${relative}`,
        bytes: await fs.readFile(fileAbs)
      });
    }
  }
  for (const file of FIRST_PERSON_OPTIONAL_LICENSE_FILES) {
    const sourceFile = path.join(sourceRoot, fromProjectSeparators(file));
    if (await pathExists(sourceFile)) {
      files.push({ path: file, bytes: await fs.readFile(sourceFile) });
    }
  }
  return files;
}

async function collectThirdPersonFilesFromGitHub(roots, ref) {
  if (typeof fetch !== "function") {
    throw new Error("This Node.js runtime does not provide fetch; use source_path with a local checkout.");
  }

  const treeUrl = `https://api.github.com/repos/${THIRD_PERSON_CONTROLLER_REPO}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const tree = await fetchJson(treeUrl);
  const files = (tree.tree ?? [])
    .filter((item) => item?.type === "blob" && roots.some((root) => item.path === root || item.path.startsWith(`${root}/`)))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (files.length === 0) {
    throw new Error(`No PlayerCharacter files found in ${THIRD_PERSON_CONTROLLER_REPO}@${ref}.`);
  }

  const downloaded = [];
  let totalBytes = 0;
  for (const file of files) {
    if (Number(file.size ?? 0) > MAX_MODEL_BYTES) {
      throw new Error(`Refusing to download large file: ${file.path}.`);
    }
    const bytes = await fetchBytes(rawGitHubUrl(THIRD_PERSON_CONTROLLER_REPO, ref, file.path));
    totalBytes += bytes.byteLength;
    if (totalBytes > 512 * 1024 * 1024) {
      throw new Error("Refusing to download more than 512 MiB for third-person controller assets.");
    }
    downloaded.push({ path: file.path, bytes });
  }
  return downloaded;
}

async function collectFirstPersonFilesFromGitHub(roots, ref) {
  if (typeof fetch !== "function") {
    throw new Error("This Node.js runtime does not provide fetch; use source_path with a local checkout.");
  }

  const treeUrl = `https://api.github.com/repos/${FIRST_PERSON_CONTROLLER_REPO}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const tree = await fetchJson(treeUrl);
  const files = (tree.tree ?? [])
    .filter((item) =>
      item?.type === "blob" &&
      (roots.some((root) => item.path === root || item.path.startsWith(`${root}/`)) ||
        FIRST_PERSON_OPTIONAL_LICENSE_FILES.includes(item.path))
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  if (files.length === 0) {
    throw new Error(`No first-person PlayerCharacter files found in ${FIRST_PERSON_CONTROLLER_REPO}@${ref}.`);
  }

  const downloaded = [];
  let totalBytes = 0;
  for (const file of files) {
    if (Number(file.size ?? 0) > MAX_MODEL_BYTES) {
      throw new Error(`Refusing to download large file: ${file.path}.`);
    }
    const bytes = await fetchBytes(rawGitHubUrl(FIRST_PERSON_CONTROLLER_REPO, ref, file.path));
    totalBytes += bytes.byteLength;
    if (totalBytes > 512 * 1024 * 1024) {
      throw new Error("Refusing to download more than 512 MiB for first-person controller assets.");
    }
    downloaded.push({ path: file.path, bytes });
  }
  return downloaded;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "mcp-godot-local"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "mcp-godot-local" }
  });
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function rawGitHubUrl(repo, ref, filePath) {
  const [owner, name] = repo.split("/");
  const encodedPath = filePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodeURIComponent(ref)}/${encodedPath}`;
}

async function writeDownloadedProjectFiles(files, overwrite) {
  for (const file of files) {
    const abs = await resolveProjectPath(file.path, { forWrite: true });
    await assertCanWrite(abs, overwrite);
  }
  for (const file of files) {
    const abs = await resolveProjectPath(file.path, { forWrite: true });
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.bytes);
  }
}

function normalizeFirstPersonFiles(files) {
  return files.map((file) => {
    if (!isTextAssetPath(file.path)) {
      return file;
    }
    const text = file.bytes.toString("utf8");
    if (!text.includes(FIRST_PERSON_UPSTREAM_RES_PREFIX)) {
      return file;
    }
    return {
      ...file,
      bytes: Buffer.from(text.replaceAll(FIRST_PERSON_UPSTREAM_RES_PREFIX, FIRST_PERSON_LOCAL_RES_PREFIX), "utf8")
    };
  });
}

function isTextAssetPath(filePath) {
  return [".tscn", ".gd", ".tres", ".material", ".gdshader", ".import", ".cfg", ".md", ".txt"].includes(path.posix.extname(filePath).toLowerCase());
}

async function collectAbsoluteFiles(root, maxFiles) {
  const result = [];
  await visit(root);
  return result;

  async function visit(dir) {
    if (result.length >= maxFiles) {
      throw new Error(`Too many files under ${toResPath(dir)}.`);
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === ".godot" || entry.name === "node_modules") {
        continue;
      }
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs);
      } else if (entry.isFile()) {
        result.push(abs);
      }
    }
  }
}

async function findThirdPersonCharacterScene() {
  const root = path.join(projectRoot, "addons", "PlayerCharacter");
  if (!(await pathExists(root))) {
    return null;
  }
  const files = (await walk(root, { maxFiles: 5000 })).filter((file) => file.toLowerCase().endsWith(".tscn"));
  if (files.length === 0) {
    return null;
  }
  const preferredNames = ["player_character.tscn", "playercharacter.tscn", "player.tscn", "character.tscn"];
  files.sort((a, b) => a.localeCompare(b));
  const preferred = files.find((file) => preferredNames.includes(path.posix.basename(file).toLowerCase()));
  return `res://${preferred ?? files[0]}`;
}

async function findFirstPersonCharacterScene() {
  const root = path.join(projectRoot, "addons", "PlayerCharacter");
  if (!(await pathExists(root))) {
    return null;
  }
  const files = (await walk(root, { maxFiles: 8000 })).filter((file) => file.toLowerCase().endsWith(".tscn"));
  if (files.length === 0) {
    return null;
  }
  files.sort((a, b) => a.localeCompare(b));
  const preferred = files.find((file) => path.posix.basename(file).toLowerCase() === "player_character_scene.tscn");
  return `res://${preferred ?? files[0]}`;
}

function buildThirdPersonPrototypeScene(rootName, characterScene) {
  return [
    "[gd_scene load_steps=4 format=3]",
    "",
    `[ext_resource type="PackedScene" path="${characterScene}" id="1_player_character"]`,
    "",
    '[sub_resource type="BoxMesh" id="BoxMesh_floor"]',
    "size = Vector3(20, 0.2, 20)",
    "",
    '[sub_resource type="BoxShape3D" id="BoxShape3D_floor"]',
    "size = Vector3(20, 0.2, 20)",
    "",
    `[node name="${rootName}" type="Node3D"]`,
    "",
    '[node name="PlayerCharacter" parent="." instance=ExtResource("1_player_character")]',
    "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)",
    "",
    '[node name="Ground" type="StaticBody3D" parent="."]',
    "",
    '[node name="Mesh" type="MeshInstance3D" parent="Ground"]',
    'mesh = SubResource("BoxMesh_floor")',
    "",
    '[node name="CollisionShape3D" type="CollisionShape3D" parent="Ground"]',
    'shape = SubResource("BoxShape3D_floor")',
    "",
    '[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]',
    "transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 8, 0)",
    "",
    '[node name="PrototypeNotes" type="Node" parent="."]',
    'metadata/uses = "Jeh3no/Godot-Third-Person-Controller addons/PlayerCharacter"',
    ""
  ].join("\n");
}

function buildFirstPersonPrototypeScene(rootName, characterScene) {
  return [
    "[gd_scene load_steps=4 format=3]",
    "",
    `[ext_resource type="PackedScene" path="${characterScene}" id="1_player_character"]`,
    "",
    '[sub_resource type="BoxMesh" id="BoxMesh_floor"]',
    "size = Vector3(20, 0.2, 20)",
    "",
    '[sub_resource type="BoxShape3D" id="BoxShape3D_floor"]',
    "size = Vector3(20, 0.2, 20)",
    "",
    `[node name="${rootName}" type="Node3D"]`,
    "",
    '[node name="PlayerCharacter" parent="." instance=ExtResource("1_player_character")]',
    "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.1, 0)",
    "",
    '[node name="Ground" type="StaticBody3D" parent="."]',
    "",
    '[node name="Mesh" type="MeshInstance3D" parent="Ground"]',
    'mesh = SubResource("BoxMesh_floor")',
    "",
    '[node name="CollisionShape3D" type="CollisionShape3D" parent="Ground"]',
    'shape = SubResource("BoxShape3D_floor")',
    "",
    '[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]',
    "transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 8, 0)",
    "",
    '[node name="PrototypeNotes" type="Node" parent="."]',
    'metadata/uses = "Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller addons/PlayerCharacter"',
    `metadata/credit = "${FIRST_PERSON_CREDIT}"`,
    `metadata/license_note = "${FIRST_PERSON_LICENSE_NOTE}"`,
    ""
  ].join("\n");
}

async function ensureThirdPersonInputActions(overwrite) {
  const projectFile = path.join(projectRoot, "project.godot");
  let text = await readTextFile(projectFile, MAX_TEXT_BYTES);
  const created = [];
  const updated = [];
  const skipped = [];

  for (const item of THIRD_PERSON_INPUT_ACTIONS) {
    const value = `{"deadzone":0.5,"events":[${item.events.map(serializeInputEvent).join(", ")}]}`;
    if (projectSettingExists(text, "input", item.action)) {
      if (!overwrite) {
        skipped.push(item.action);
        continue;
      }
      const result = setProjectSetting(text, "input", item.action, value, true);
      text = result.text;
      updated.push(item.action);
    } else {
      const result = setProjectSetting(text, "input", item.action, value, false);
      text = result.text;
      created.push(item.action);
    }
  }

  await fs.writeFile(projectFile, text, "utf8");
  return { created, updated, skipped, total: THIRD_PERSON_INPUT_ACTIONS.length };
}

async function ensureFirstPersonInputActions(overwrite) {
  const projectFile = path.join(projectRoot, "project.godot");
  let text = await readTextFile(projectFile, MAX_TEXT_BYTES);
  const created = [];
  const updated = [];
  const skipped = [];

  for (const item of FIRST_PERSON_INPUT_ACTIONS) {
    const value = `{"deadzone":0.5,"events":[${item.events.map(serializeInputEvent).join(", ")}]}`;
    if (projectSettingExists(text, "input", item.action)) {
      if (!overwrite) {
        skipped.push(item.action);
        continue;
      }
      const result = setProjectSetting(text, "input", item.action, value, true);
      text = result.text;
      updated.push(item.action);
    } else {
      const result = setProjectSetting(text, "input", item.action, value, false);
      text = result.text;
      created.push(item.action);
    }
  }

  await fs.writeFile(projectFile, text, "utf8");
  return { created, updated, skipped, total: FIRST_PERSON_INPUT_ACTIONS.length };
}

function projectSettingExists(text, section, key) {
  const lines = textToLines(text);
  const bounds = findSectionBounds(lines, section);
  if (!bounds) {
    return false;
  }
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    if (lines[index].startsWith(`${key}=`)) {
      return true;
    }
  }
  return false;
}

function buildScriptContent(args) {
  if (args.content != null) {
    if (typeof args.content !== "string" || args.content.length > MAX_TEXT_BYTES || args.content.includes("\0")) {
      throw new Error("content must be a safe string under 1 MiB.");
    }
    return args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  }
  const base = args.extends ?? "Node";
  if (!isGodotIdentifier(base)) {
    throw new Error("extends must be a Godot class-style identifier, for example Node or CharacterBody3D.");
  }
  const lines = [
    `extends ${base}`,
    "",
    "# Created by the local Godot MCP server.",
    "# Keep this script small and readable while learning the project."
  ];
  if (args.description) {
    lines.push(`# Purpose: ${String(args.description).replace(/\r?\n/g, " ")}`);
  }
  if (args.class_name) {
    if (!isGodotIdentifier(args.class_name)) {
      throw new Error("class_name must be a valid Godot identifier.");
    }
    lines.push("", `class_name ${args.class_name}`);
  }
  lines.push("", "func _ready() -> void:", "    # This runs once when the node enters the scene tree.", "    pass", "");
  return lines.join("\n");
}

function plannedResult(plannedChanges, extra = {}) {
  return { ok: true, dryRun: true, ...extra, plannedChanges };
}

function parseScriptInfo(text) {
  return {
    extends: matchValue(text, /^\s*extends\s+([A-Za-z_][A-Za-z0-9_]*)/m),
    className: matchValue(text, /^\s*class_name\s+([A-Za-z_][A-Za-z0-9_]*)/m)
  };
}

function normalizeExtensionFilter(values) {
  const result = new Set();
  if (!Array.isArray(values)) {
    return result;
  }
  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }
    const ext = value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`;
    if (/^\.[a-z0-9_+-]+$/.test(ext)) {
      result.add(ext);
    }
  }
  return result;
}

function isDefaultSearchExtension(ext, rel) {
  return new Set([".gd", ".tscn", ".tres", ".material", ".md", ".json", ".cfg", ".godot", ".toml", ".mjs", ".js"]).has(ext)
    || rel.endsWith(".env.example");
}

function serializeInputEvent(event) {
  if (event == null || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("Each input event must be an object.");
  }
  const type = event.type ?? "key";
  if (type === "key") {
    const keycode = clampInteger(event.keycode ?? event.physical_keycode ?? 0, 0, 8388607);
    const physical = clampInteger(event.physical_keycode ?? 0, 0, 8388607);
    return [
      'Object(InputEventKey',
      '"resource_local_to_scene":false',
      '"resource_name":""',
      '"device":-1',
      '"window_id":0',
      `"alt_pressed":${Boolean(event.alt_pressed)}`,
      `"shift_pressed":${Boolean(event.shift_pressed)}`,
      `"ctrl_pressed":${Boolean(event.ctrl_pressed)}`,
      `"meta_pressed":${Boolean(event.meta_pressed)}`,
      '"pressed":false',
      `"keycode":${keycode}`,
      `"physical_keycode":${physical}`,
      '"key_label":0',
      '"unicode":0',
      '"location":0',
      '"echo":false',
      '"script":null)'
    ].join(",");
  }
  if (type === "mouse_button" || type === "joy_button") {
    const className = type === "mouse_button" ? "InputEventMouseButton" : "InputEventJoypadButton";
    const buttonIndex = clampInteger(event.button_index ?? 0, 0, 255);
    return `Object(${className},"resource_local_to_scene":false,"resource_name":"","device":-1,"button_index":${buttonIndex},"pressed":false,"script":null)`;
  }
  throw new Error("input event type must be key, mouse_button, or joy_button.");
}

function setProjectSetting(text, section, key, value, overwrite) {
  const lines = textToLines(text);
  const bounds = findSectionBounds(lines, section);
  const entry = `${key}=${value}`;
  if (!bounds) {
    if (lines.at(-1) !== "") {
      lines.push("");
    }
    lines.push(`[${section}]`, "", entry, "");
    return { text: lines.join("\n"), operation: "created_section_and_entry" };
  }

  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    if (lines[index].startsWith(`${key}=`)) {
      if (!overwrite) {
        throw new Error(`${section}.${key} already exists; pass overwrite: true to replace it.`);
      }
      lines[index] = entry;
      return { text: lines.join("\n"), operation: "updated_entry" };
    }
  }

  lines.splice(bounds.end, 0, entry);
  return { text: lines.join("\n"), operation: "created_entry" };
}

function findSectionBounds(lines, section) {
  const start = lines.findIndex((line) => line.trim() === `[${section}]`);
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function formatColor(value) {
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)) {
    throw new Error("albedo_color must be [r, g, b] or [r, g, b, a].");
  }
  const parts = [...value, ...(value.length === 3 ? [1] : [])].map((part) => formatNumber(clampNumber(part, 0, 1)));
  return `Color(${parts.join(", ")})`;
}

function providerStatus(values) {
  const image = values.IMAGE_PROVIDER ?? "none";
  const model3d = values.MODEL_3D_PROVIDER ?? "none";
  const chat = values.AI_CHAT_PROVIDER ?? "none";
  return {
    image: providerDetails(image, {
      openai: ["OPENAI_API_KEY"],
      polza_ai: ["POLZA_AI_IMAGE_URL", "POLZA_AI_API_KEY"],
      local_comfyui: ["LOCAL_COMFYUI_URL"],
      custom_http: ["CUSTOM_IMAGE_HTTP_URL"]
    }, values),
    model3d: providerDetails(model3d, {
      tripo: ["TRIPO_API_KEY"],
      meshy: ["MESHY_API_KEY"],
      custom_http: ["CUSTOM_MODEL_HTTP_URL"]
    }, values),
    chat: providerDetails(chat, {
      openai_compatible: ["AI_CHAT_BASE_URL", "AI_CHAT_MODEL"]
    }, values)
  };
}

function providerDetails(provider, requirements, values) {
  const required = requirements[provider] ?? [];
  const missing = required.filter((name) => !values[name]);
  return {
    provider,
    configured: provider !== "none" && missing.length === 0,
    missing,
    safeDefault: provider === "none"
  };
}

async function prepareProperties(properties, scene) {
  if (properties == null || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error("properties must be an object.");
  }
  const lines = [];
  const newResources = [];
  const propertyNames = [];
  for (const [name, value] of Object.entries(properties)) {
    validatePropertyName(name);
    const serialized = await serializeProperty(name, value, newResources, scene);
    lines.push(`${name} = ${serialized}`);
    propertyNames.push(name);
  }
  return { lines, newResources, propertyNames };
}

async function serializeProperty(name, value, newResources, scene) {
  if (RESOURCE_PROPERTY_TYPES.has(name)) {
    if (typeof value !== "string") {
      throw new Error(`${name} must be a project-local resource path string.`);
    }
    const abs = await resolveProjectPath(value, { mustExist: true });
    const type = RESOURCE_PROPERTY_TYPES.get(name);
    const resourcePath = toResPath(abs);
    const existing = scene?.extResources.find((resource) => resource.type === type && resource.path === resourcePath);
    if (existing) {
      return `ExtResource("${existing.id}")`;
    }
    const id = `${(scene?.extResources.length ?? 0) + newResources.length + 1}_${safeFilenamePart(name)}`;
    newResources.push({ type, path: resourcePath, id });
    return `ExtResource("${id}")`;
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    validateGodotString(value, name);
    return godotString(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 2) {
      return `Vector2(${formatNumber(value[0])}, ${formatNumber(value[1])})`;
    }
    if (value.length === 3) {
      return `Vector3(${formatNumber(value[0])}, ${formatNumber(value[1])}, ${formatNumber(value[2])})`;
    }
  }
  if (value && typeof value === "object") {
    const type = value.type;
    const data = value.value;
    if (type === "Color" && Array.isArray(data) && (data.length === 3 || data.length === 4)) {
      const parts = [...data, ...(data.length === 3 ? [1] : [])].map(formatNumber);
      return `Color(${parts.join(", ")})`;
    }
    if (type === "Vector2" && Array.isArray(data) && data.length === 2) {
      return `Vector2(${formatNumber(data[0])}, ${formatNumber(data[1])})`;
    }
    if (type === "Vector3" && Array.isArray(data) && data.length === 3) {
      return `Vector3(${formatNumber(data[0])}, ${formatNumber(data[1])}, ${formatNumber(data[2])})`;
    }
  }
  throw new Error(`Unsupported property value for ${name}. Use number, boolean, string, Vector2/3 array, or typed Color/Vector object.`);
}

function parseSceneText(text) {
  const lines = textToLines(text);
  const headerIndex = lines.findIndex((line) => line.startsWith("[gd_scene"));
  const extResources = [];
  const nodes = [];

  for (let index = 0; index < lines.length; index += 1) {
    const ext = lines[index].match(/^\[ext_resource\s+([^\]]*)\]/);
    if (ext) {
      const attrs = parseAttributes(ext[1]);
      extResources.push({ lineIndex: index, ...attrs });
    }
    const node = lines[index].match(/^\[node\s+([^\]]*)\]/);
    if (node) {
      const attrs = parseAttributes(node[1]);
      const endLine = findBlockEnd(lines, index);
      nodes.push({ lineIndex: index, endLine, attrs, properties: parseNodeProperties(lines, index + 1, endLine) });
    }
  }

  for (const [index, node] of nodes.entries()) {
    const name = node.attrs.name ?? `Node${index}`;
    const parent = node.attrs.parent;
    node.path = index === 0 && !parent ? "." : parent === "." || !parent ? name : `${parent}/${name}`;
    node.name = name;
    node.type = node.attrs.type ?? null;
    node.parent = parent ?? null;
  }

  return {
    headerIndex,
    format: parseHeaderFormat(lines[headerIndex] ?? ""),
    extResources,
    nodes,
    root: nodes[0] ?? null
  };
}

function sceneSummary(scene) {
  return {
    format: scene.format,
    extResources: scene.extResources.map((resource) => ({ id: resource.id, type: resource.type, path: resource.path })),
    root: scene.root ? nodeSummary(scene.root) : null,
    nodes: scene.nodes.map(nodeSummary)
  };
}

function nodeSummary(node) {
  return {
    path: node.path,
    name: node.name,
    type: node.type,
    parent: node.parent,
    properties: node.properties
  };
}

function insertResources(lines, scene, resources) {
  const insertAt = scene.extResources.length > 0
    ? Math.max(...scene.extResources.map((resource) => resource.lineIndex)) + 1
    : (scene.headerIndex >= 0 ? scene.headerIndex + 1 : 0);
  const existing = new Set(scene.extResources.map((resource) => `${resource.type}:${resource.path}`));
  const toInsert = [];
  for (const resource of resources) {
    const key = `${resource.type}:${resource.path}`;
    if (existing.has(key)) {
      continue;
    }
    toInsert.push(`[ext_resource type="${resource.type}" path="${resource.path}" id="${resource.id}"]`);
  }
  if (toInsert.length === 0) {
    return;
  }
  updateHeaderLoadSteps(lines, scene.extResources.length + toInsert.length + 1);
  lines.splice(insertAt, 0, ...toInsert);
}

function applyPropertiesToNodeBlock(lines, node, propertyLines) {
  const propertyMap = new Map(propertyLines.map((line) => [line.split("=")[0].trim(), line]));
  const seen = new Set();
  for (let index = node.lineIndex + 1; index < node.endLine; index += 1) {
    const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_/:]*)\s*=/);
    if (!match) {
      continue;
    }
    const replacement = propertyMap.get(match[1]);
    if (replacement) {
      lines[index] = replacement;
      seen.add(match[1]);
    }
  }
  const missing = propertyLines.filter((line) => !seen.has(line.split("=")[0].trim()));
  if (missing.length > 0) {
    lines.splice(node.endLine, 0, ...missing);
  }
}

function normalizeParentPath(input, scene) {
  const value = String(input ?? ".").trim();
  if (value === "." || value === "/" || value === "" || value === scene.root?.name) {
    return ".";
  }
  if (!scene.nodes.some((node) => node.path === value)) {
    throw new Error(`parent_path not found in scene: ${value}`);
  }
  return value;
}

function findSceneNode(scene, input) {
  const value = String(input ?? ".").trim();
  if (value === "." || value === "/" || value === scene.root?.name) {
    return scene.root;
  }
  const node = scene.nodes.find((item) => item.path === value);
  if (!node) {
    throw new Error(`node_path not found in scene: ${value}`);
  }
  return node;
}

async function readWritableScenePath(input) {
  requireString(input, "scene_path");
  const abs = await resolveProjectPath(input, { mustExist: true });
  if (path.extname(abs).toLowerCase() === ".scn") {
    throw new Error("Binary .scn scenes cannot be safely edited as text. Use the Godot EditorPlugin bridge.");
  }
  assertExtension(abs, ".tscn");
  return abs;
}

function parseAttributes(text) {
  const attrs = {};
  for (const match of text.matchAll(/([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|[^\s]+)/g)) {
    attrs[match[1]] = unquote(match[2]);
  }
  return attrs;
}

function parseNodeProperties(lines, start, end) {
  const properties = {};
  for (let index = start; index < end; index += 1) {
    const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_/:]*)\s*=\s*(.+)$/);
    if (match) {
      properties[match[1]] = match[2];
    }
  }
  return properties;
}

function findBlockEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("[")) {
      return index;
    }
  }
  return lines.length;
}

function updateHeaderLoadSteps(lines, loadSteps) {
  const index = lines.findIndex((line) => line.startsWith("[gd_scene"));
  if (index === -1) {
    lines.unshift(`[gd_scene load_steps=${loadSteps} format=3]`);
    return;
  }
  let line = lines[index];
  if (/load_steps=\d+/.test(line)) {
    line = line.replace(/load_steps=\d+/, `load_steps=${loadSteps}`);
  } else {
    line = line.replace("[gd_scene", `[gd_scene load_steps=${loadSteps}`);
  }
  if (!/format=\d+/.test(line)) {
    line = line.replace("]", " format=3]");
  }
  lines[index] = line;
}

async function classifyFiles(files) {
  const scenes = [];
  const scripts = [];
  const resources = [];
  const textures = [];
  const materials = [];
  const models = [];
  const assets = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (SCENE_EXTENSIONS.has(ext)) scenes.push(file);
    if (SCRIPT_EXTENSIONS.has(ext)) scripts.push(file);
    if (RESOURCE_EXTENSIONS.has(ext)) resources.push(file);
    if (IMAGE_EXTENSIONS.has(ext)) textures.push(file);
    if (MODEL_EXTENSIONS.has(ext)) models.push(file);
    if (file.toLowerCase().startsWith("assets/")) assets.push(file);
    if (MATERIAL_EXTENSIONS.has(ext) && (await looksLikeMaterial(file))) materials.push(file);
  }

  return { scenes, scripts, resources, assets, textures, materials, models };
}

async function looksLikeMaterial(file) {
  if (file.toLowerCase().includes("material")) {
    return true;
  }
  if (!file.endsWith(".tres") && !file.endsWith(".res")) {
    return true;
  }
  try {
    const abs = path.join(projectRoot, fromProjectSeparators(file));
    const text = await readTextFile(abs, 64 * 1024);
    return /type="[^"]*Material"/.test(text);
  } catch {
    return false;
  }
}

async function folderSummary(directories, files) {
  const topLevel = new Set([
    ...directories.filter((directory) => !directory.includes("/")),
    ...files.map((file) => file.split("/")[0])
  ]);
  const expected = ["scenes", "scripts", "assets", "addons", "tools", "generation_jobs", "docs"];
  return {
    topLevel: [...topLevel].sort(),
    expected: Object.fromEntries(expected.map((folder) => [folder, findFolderCasing(topLevel, folder)]))
  };
}

function findFolderCasing(topLevel, expected) {
  for (const folder of topLevel) {
    if (folder.toLowerCase() === expected.toLowerCase()) {
      return { exists: true, actual: folder };
    }
  }
  return { exists: false, actual: null };
}

function suggestedStructure() {
  return [
    "scenes/",
    "scripts/",
    "assets/generated/sprites/",
    "assets/generated/textures/",
    "assets/generated/models/",
    "assets/models/",
    "assets/source/prompts/",
    "addons/",
    "tools/mcp-godot/",
    "generation_jobs/",
    "docs/"
  ];
}

function buildTree(files, maxDepth) {
  const root = {};
  for (const file of files) {
    const parts = file.split("/").slice(0, maxDepth);
    let node = root;
    for (const part of parts) {
      node[part] ??= {};
      node = node[part];
    }
  }
  return root;
}

async function copyFileWithLimit(sourceAbs, targetAbs, maxBytes, overwrite) {
  await assertCanWrite(targetAbs, overwrite);
  const stat = await fs.stat(sourceAbs);
  if (!stat.isFile()) {
    throw new Error("source_path must be a file.");
  }
  if (stat.size > maxBytes) {
    throw new Error(`file is larger than ${maxBytes} bytes.`);
  }
  await fs.mkdir(path.dirname(targetAbs), { recursive: true });
  await fs.copyFile(sourceAbs, targetAbs);
}

async function findLikelyModelTextures(modelAbs) {
  const folder = path.dirname(modelAbs);
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => toResPath(path.join(folder, entry.name)));
}

async function runGodotCheck(timeoutMs) {
  const godot = await findGodotCommand();
  if (!godot) {
    return { status: "not_found" };
  }
  const args = ["--headless", "--editor", "--path", projectRoot, "--quit"];
  if (!isAllowedGodotCli(godot, args)) {
    return { status: "blocked_by_whitelist" };
  }
  return runCommand(godot, args, timeoutMs);
}

async function runGodotImport(timeoutMs) {
  const godot = await findGodotCommand();
  if (!godot) {
    return { status: "not_found" };
  }
  const args = ["--headless", "--path", projectRoot, "--import"];
  if (!isAllowedGodotCli(godot, args)) {
    return { status: "blocked_by_whitelist" };
  }
  return runCommand(godot, args, timeoutMs);
}

async function findGodotCommand() {
  for (const command of [env.GODOT_CLI, "godot", "godot4"].filter(Boolean)) {
    const result = await runCommand(command, ["--version"], 3000, { allowVersionProbe: true });
    if (result.status === "completed" && result.exitCode === 0) {
      return command;
    }
  }
  return null;
}

function runCommand(command, args, timeoutMs, options = {}) {
  if (!options.allowVersionProbe && !isAllowedGodotCli(command, args)) {
    return Promise.resolve({ status: "blocked_by_whitelist", command, args });
  }
  if (timeoutMs === 0 && options.detachWhenNoWait) {
    const child = spawn(command, args, { cwd: projectRoot, detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return Promise.resolve({ ok: true, status: "launched", command, args, pid: child.pid });
  }

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
        settled = true;
        resolve({ status: "timeout", command, args, exitCode: null, stdout: sanitizeForLog(stdout, env), stderr: sanitizeForLog(stderr, env) });
      }
    }, timeoutMs || 3000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ status: error.code === "ENOENT" ? "not_found" : "error", command, args, error: sanitizeForLog(error.message ?? error, env) });
      }
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ status: "completed", command, args, exitCode, stdout: sanitizeForLog(stdout.slice(-8000), env), stderr: sanitizeForLog(stderr.slice(-8000), env) });
      }
    });
  });
}

function launchTrackedGame(command, args, scenePath) {
  const current = trackedGameStatus();
  if (current.status === "running") {
    throw new Error(`A Godot game is already running with pid ${current.pid}. Stop it with godot_stop_project first.`);
  }

  const child = spawn(command, args, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const state = {
    child,
    pid: child.pid,
    command,
    args,
    scenePath,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    stdout: "",
    stderr: ""
  };
  runningGame = state;

  child.stdout.on("data", (chunk) => {
    state.stdout = `${state.stdout}${chunk.toString("utf8")}`.slice(-8000);
  });
  child.stderr.on("data", (chunk) => {
    state.stderr = `${state.stderr}${chunk.toString("utf8")}`.slice(-8000);
  });
  child.on("error", (error) => {
    state.status = "error";
    state.finishedAt = new Date().toISOString();
    state.error = sanitizeForLog(error.message ?? error, env);
  });
  child.on("close", (exitCode) => {
    state.status = "exited";
    state.finishedAt = new Date().toISOString();
    state.exitCode = exitCode;
    state.stdout = sanitizeForLog(state.stdout, env);
    state.stderr = sanitizeForLog(state.stderr, env);
  });

  return {
    ok: true,
    status: "launched",
    mode: "cli",
    pid: child.pid,
    command,
    args,
    scene: scenePath ? `res://${scenePath}` : null
  };
}

function trackedGameStatus() {
  if (!runningGame) {
    return { status: "not_running" };
  }
  return {
    status: runningGame.status,
    pid: runningGame.pid,
    command: runningGame.command,
    args: runningGame.args,
    scene: runningGame.scenePath ? `res://${runningGame.scenePath}` : null,
    startedAt: runningGame.startedAt,
    finishedAt: runningGame.finishedAt,
    exitCode: runningGame.exitCode,
    stdoutTail: sanitizeForLog(runningGame.stdout ?? "", env),
    stderrTail: sanitizeForLog(runningGame.stderr ?? "", env)
  };
}

function stopTrackedGame(timeoutMs) {
  if (!runningGame || runningGame.status !== "running") {
    return Promise.resolve({ ok: true, status: "not_running", stopped: false });
  }

  const child = runningGame.child;
  const pid = runningGame.pid;
  const killed = child.kill();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, status: "timeout", stopped: false, pid, killSignalSent: killed });
    }, timeoutMs);
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: true, status: "stopped", stopped: true, pid, exitCode, killSignalSent: killed });
    });
  });
}

async function listPngNames(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png")).map((entry) => entry.name));
  } catch {
    return new Set();
  }
}

async function collectScreenshotOutputs(targetAbs, beforeNames) {
  const directory = path.dirname(targetAbs);
  const targetName = path.basename(targetAbs);
  const targetStem = path.basename(targetAbs, path.extname(targetAbs));
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const captures = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) {
      continue;
    }
    const isExpectedName = entry.name === targetName || entry.name.startsWith(targetStem);
    if (isExpectedName && (!beforeNames.has(entry.name) || entry.name === targetName)) {
      captures.push(path.join(directory, entry.name));
    }
  }
  captures.sort();
  return captures;
}

async function resolveProjectRoot() {
  const candidate = readArgValue("--project-root") ?? process.env.GODOT_PROJECT_ROOT ?? process.cwd();
  const real = await fs.realpath(path.resolve(candidate));
  await fs.access(path.join(real, "project.godot"), fsConstants.R_OK);
  return real;
}

async function loadDotEnv(root) {
  try {
    const text = await fs.readFile(path.join(root, ".env"), "utf8");
    const parsed = {};
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const index = line.indexOf("=");
      if (index === -1) {
        continue;
      }
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
      parsed[key] = value;
    }
    return parsed;
  } catch {
    return {};
  }
}

async function resolveProjectPath(input, options = {}) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("path must be a non-empty string.");
  }
  if (input.includes("\0")) {
    throw new Error("path must not contain NUL bytes.");
  }
  const local = input.startsWith("res://") ? input.slice("res://".length) : input;
  if (path.isAbsolute(local)) {
    throw new Error("absolute paths are not accepted; use project-local or res:// paths.");
  }
  const abs = path.resolve(projectRoot, fromProjectSeparators(local));
  assertInsideProject(abs);
  if (options.mustExist) {
    const real = await fs.realpath(abs);
    assertInsideProject(real);
    const stat = await fs.stat(real);
    if (options.expectDirectory && !stat.isDirectory()) {
      throw new Error("path must be an existing directory.");
    }
    if (!options.expectDirectory && stat.isDirectory()) {
      throw new Error("path must be a file.");
    }
    return real;
  }
  if (options.forWrite) {
    const parent = await nearestExistingAncestor(path.dirname(abs));
    const parentReal = await fs.realpath(parent);
    assertInsideProject(parentReal);
  }
  return abs;
}

async function nearestExistingAncestor(start) {
  let current = path.resolve(start);
  while (true) {
    try {
      if ((await fs.stat(current)).isDirectory()) {
        return current;
      }
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error("no existing parent directory found.");
      }
      current = parent;
    }
  }
}

function assertInsideProject(abs) {
  const relative = path.relative(projectRoot, path.resolve(abs));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error("path escapes the Godot project root.");
}

async function assertCanWrite(abs, overwrite) {
  try {
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      throw new Error("destination is a directory.");
    }
    if (!overwrite) {
      throw new Error("destination already exists; pass overwrite: true to replace it.");
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function pathExists(abs) {
  try {
    await fs.access(abs, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function folderStatus(abs) {
  try {
    const stat = await fs.stat(abs);
    return { exists: true, isDirectory: stat.isDirectory(), path: toResPath(abs) };
  } catch {
    return { exists: false, isDirectory: false, path: toResPath(abs) };
  }
}

async function readTextFile(abs, maxBytes) {
  const stat = await fs.stat(abs);
  if (stat.size > maxBytes) {
    throw new Error(`file is larger than ${maxBytes} bytes.`);
  }
  return fs.readFile(abs, "utf8");
}

async function walk(root, options = {}) {
  const maxFiles = options.maxFiles ?? 10000;
  const result = [];
  await visit(root);
  return result;

  async function visit(dir) {
    if (result.length >= maxFiles) {
      return;
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (result.length >= maxFiles || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs);
      } else if (entry.isFile()) {
        result.push(toProjectPath(abs));
      }
    }
  }
}

async function walkDirectories(root, options = {}) {
  const maxFiles = options.maxFiles ?? 10000;
  const result = [];
  await visit(root);
  return result;

  async function visit(dir) {
    if (result.length >= maxFiles) {
      return;
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (result.length >= maxFiles || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        result.push(toProjectPath(abs));
        await visit(abs);
      }
    }
  }
}

function parseProjectGodot(text) {
  const features = text.match(/^config\/features=PackedStringArray\((.*)\)$/m);
  const featureList = features ? [...features[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]) : [];
  return {
    configVersion: matchValue(text, /^config_version=(.+)$/m),
    applicationName: matchValue(text, /^config\/name=(.+)$/m),
    godotVersionFromFeatures: featureList.find((item) => /^\d+\.\d+/.test(item)) ?? null,
    features: featureList,
    icon: matchValue(text, /^config\/icon=(.+)$/m),
    mainScene: matchValue(text, /^run\/main_scene=(.+)$/m),
    physicsEngine3d: matchValue(text, /^3d\/physics_engine=(.+)$/m),
    renderingDriverWindows: matchValue(text, /^rendering_device\/driver\.windows=(.+)$/m)
  };
}

function tool(name, description, properties = {}, required = []) {
  return {
    name,
    title: name.replace(/^godot_/, "").replaceAll("_", " "),
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false }
  };
}

function textToLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function parseHeaderFormat(header) {
  const match = header.match(/format=(\d+)/);
  return match ? Number(match[1]) : null;
}

function matchValue(text, regex) {
  const match = text.match(regex);
  return match ? unquote(match[1].trim()) : null;
}

function unquote(value) {
  if (value == null) return null;
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function assertExtension(abs, extension) {
  if (path.extname(abs).toLowerCase() !== extension) {
    throw new Error(`expected a ${extension} file.`);
  }
}

function assertImageExtension(abs, name) {
  if (!IMAGE_EXTENSIONS.has(path.extname(abs).toLowerCase())) {
    throw new Error(`${name} must use one of: ${[...IMAGE_EXTENSIONS].join(", ")}.`);
  }
}

function assertModelExtension(abs, name) {
  if (!MODEL_EXTENSIONS.has(path.extname(abs).toLowerCase())) {
    throw new Error(`${name} must use one of: ${[...MODEL_EXTENSIONS].join(", ")}.`);
  }
}

function assertTextMaterialExtension(abs, name) {
  const ext = path.extname(abs).toLowerCase();
  if (ext !== ".tres" && ext !== ".material") {
    throw new Error(`${name} must use .tres or .material for text material resources.`);
  }
}

function assertScreenshotExtension(abs, name) {
  if (!SCREENSHOT_EXTENSIONS.has(path.extname(abs).toLowerCase())) {
    throw new Error(`${name} must use one of: ${[...SCREENSHOT_EXTENSIONS].join(", ")}.`);
  }
}

function isGodotIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function validateGodotString(value, name) {
  if (typeof value !== "string" || value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    throw new Error(`${name} must be a single-line string.`);
  }
}

function validatePropertyName(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_/:]*$/.test(value)) {
    throw new Error(`invalid property name: ${value}`);
  }
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("numeric values must be finite.");
  }
  return String(number);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`expected a number between ${min} and ${max}.`);
  }
  return Math.max(min, Math.min(max, number));
}

function godotString(value) {
  return JSON.stringify(value);
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

async function resolveGenerationJobPath(input) {
  requireString(input, "job_path");
  const abs = await resolveProjectPath(input, { mustExist: true });
  assertGenerationJobInside(abs);
  assertExtension(abs, ".json");
  return abs;
}

function assertGenerationJobInside(abs) {
  const relative = path.relative(path.join(projectRoot, "generation_jobs"), path.resolve(abs));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error("job_path must be inside generation_jobs/.");
}

async function findGenerationJobById(id) {
  requireString(id, "id");
  const root = path.join(projectRoot, "generation_jobs");
  const files = await walk(root, { maxFiles: 30000 });
  for (const rel of files.filter((file) => file.endsWith(".json"))) {
    const abs = path.join(projectRoot, fromProjectSeparators(rel));
    try {
      const job = JSON.parse(await readTextFile(abs, MAX_TEXT_BYTES));
      if (job.id === id) {
        return abs;
      }
    } catch {
      continue;
    }
  }
  throw new Error(`generation job not found for id: ${id}`);
}

function toProjectPath(abs) {
  return path.relative(projectRoot, abs).split(path.sep).join("/");
}

function toResPath(abs) {
  return `res://${toProjectPath(abs)}`;
}

function fromProjectSeparators(value) {
  return value.replaceAll("/", path.sep).replaceAll("\\", path.sep);
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 || index + 1 >= process.argv.length ? null : process.argv[index + 1];
}

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`expected an integer between ${min} and ${max}.`);
  }
  return Math.max(min, Math.min(max, number));
}

function toolResult(structuredContent, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError
  };
}

function sendResult(id, result) {
  write({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  write({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

class JsonRpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
