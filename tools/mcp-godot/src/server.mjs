#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { createGenerationJob, generateImageWithProvider, generateModelWithProvider, IMAGE_PROVIDERS, MODEL_3D_PROVIDERS } from "./providers.mjs";
import { isAllowedGodotCli, safeFilenamePart, sanitizeForLog } from "./security.mjs";

const SERVER_VERSION = "0.2.0";
const SUPPORTED_PROTOCOLS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const DEFAULT_PROTOCOL = "2025-06-18";
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_MODEL_BYTES = 256 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const MODEL_EXTENSIONS = new Set([".glb", ".gltf", ".obj", ".fbx"]);
const SCENE_EXTENSIONS = new Set([".tscn", ".scn"]);
const SCRIPT_EXTENSIONS = new Set([".gd"]);
const MATERIAL_EXTENSIONS = new Set([".material", ".tres", ".res"]);
const RESOURCE_EXTENSIONS = new Set([".tres", ".res", ".import", ".gdshader"]);
const SKIP_DIRS = new Set([".git", ".godot", ".import", ".codex", ".agents", "node_modules"]);
const ALLOWED_ROOT_NODES = new Set(["Node2D", "Node3D", "Control", "CharacterBody2D", "CharacterBody3D"]);
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
  "godot_run_project"
]);

const tools = [
  tool("godot_help", "Discover available tool categories, workflows, safety modes, and usage templates.", {
    tool: { type: "string", description: "Optional exact tool name to describe." },
    category: { type: "string", description: "Optional category: overview, workflows, coverage, safety, bridge, generation." },
    task: { type: "string", description: "Optional task description for a suggested tool chain." }
  }),
  tool("godot_bridge_status", "Check whether the optional Godot EditorPlugin bridge is listening on localhost.", {
    timeout_ms: { type: "integer", minimum: 200, maximum: 5000, default: 1000 }
  }),
  tool("godot_project_scan", "Scan the Godot project and return folders, tree, scenes, scripts, resources, textures, materials, and models.", {
    max_files: { type: "integer", minimum: 1, maximum: 30000, default: 8000 },
    max_depth: { type: "integer", minimum: 1, maximum: 12, default: 6 }
  }),
  tool("godot_list_scenes", "List .tscn and .scn scenes.", {
    folder: { type: "string", description: "Optional project-local folder or res:// path.", default: "" }
  }),
  tool("godot_read_scene", "Read a text .tscn scene and return node structure. Binary .scn files are reported as unsupported for direct text parsing.", {
    path: { type: "string" },
    include_text: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_create_scene", "Create a Godot 4 text scene with an allowed root node type.", {
    path: { type: "string" },
    root_type: { type: "string", enum: [...ALLOWED_ROOT_NODES], default: "Node2D" },
    root_name: { type: "string" },
    overwrite: { type: "boolean", default: false }
  }, ["path"]),
  tool("godot_add_node", "Add a node to a .tscn scene with safe basic properties.", {
    scene_path: { type: "string" },
    parent_path: { type: "string", default: "." },
    node_type: { type: "string" },
    node_name: { type: "string" },
    properties: { type: "object", additionalProperties: true, default: {} }
  }, ["scene_path", "node_type", "node_name"]),
  tool("godot_update_node", "Update safe basic properties on a node in a .tscn scene.", {
    scene_path: { type: "string" },
    node_path: { type: "string", description: "Use . for the root node, or paths like Player/Camera." },
    properties: { type: "object", additionalProperties: true }
  }, ["scene_path", "node_path", "properties"]),
  tool("godot_attach_script", "Create or attach a GDScript to a node in a .tscn scene.", {
    scene_path: { type: "string" },
    node_path: { type: "string", default: "." },
    script_path: { type: "string" },
    extends: { type: "string", default: "Node" },
    content: { type: "string" },
    overwrite_script: { type: "boolean", default: false }
  }, ["scene_path", "script_path"]),
  tool("godot_create_script", "Create a beginner-readable Godot 4 GDScript file.", {
    path: { type: "string" },
    extends: { type: "string", default: "Node" },
    class_name: { type: "string" },
    description: { type: "string" },
    content: { type: "string" },
    overwrite: { type: "boolean", default: false }
  }, ["path"]),
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
    name: { type: "string" }
  }, ["prompt"]),
  tool("godot_run_project", "Run the current project with Godot CLI if available. Uses a strict Godot-only command whitelist.", {
    scene_path: { type: "string" },
    dry_run: { type: "boolean", default: true },
    wait_ms: { type: "integer", minimum: 0, maximum: 15000, default: 0 }
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
      godot_bridge_status: godotBridgeStatus,
      godot_project_scan: godotProjectScan,
      godot_list_scenes: godotListScenes,
      godot_read_scene: godotReadScene,
      godot_create_scene: godotCreateScene,
      godot_add_node: godotAddNode,
      godot_update_node: godotUpdateNode,
      godot_attach_script: godotAttachScript,
      godot_create_script: godotCreateScript,
      godot_import_image: godotImportImage,
      godot_generate_sprite: godotGenerateSprite,
      godot_generate_texture: godotGenerateTexture,
      godot_import_3d_model: godotImport3dModel,
      godot_generate_3d_model: godotGenerate3dModel,
      godot_run_project: godotRunProject,
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
      usage: usageTemplate(selected.name)
    };
  }

  if (args.task) {
    return {
      ok: true,
      task: args.task,
      suggestedChain: suggestToolChain(args.task)
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
    coverage: category === "overview" || category === "coverage" ? coverageHelp() : undefined,
    safety: category === "overview" || category === "safety" ? safetyHelp() : undefined,
    generation: category === "generation" ? generationHelp() : undefined,
    bridgeNotes: category === "overview" || category === "bridge" ? bridgeHelp() : undefined
  };
}

async function godotBridgeStatus(args) {
  return callEditorBridge({ command: "status" }, clampInteger(args.timeout_ms ?? 1000, 200, 5000));
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
  await assertCanWrite(abs, Boolean(args.overwrite));
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
  if (properties.newResources.length > 0) {
    insertResources(lines, scene, properties.newResources);
  }
  insert.push("", `[node name=${godotString(nodeName)} type="${nodeType}" parent=${godotString(parentPath)}]`);
  for (const line of properties.lines) {
    insert.push(line);
  }
  insert.push("");
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
  await assertCanWrite(abs, Boolean(args.overwrite));
  const content = buildScriptContent(args);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { ok: true, path: toResPath(abs), created: true, overwritten: Boolean(args.overwrite) };
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
    targetResPath: toResPath(targetAbs),
    options: { name },
    env
  });
}

async function godotRunProject(args) {
  const scenePath = args.scene_path ? toProjectPath(await resolveProjectPath(args.scene_path, { mustExist: true })) : null;
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
  return runCommand(godot, runArgs, clampInteger(args.wait_ms ?? 0, 0, 15000), { detachWhenNoWait: true });
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
  if (name === "godot_help") return "discovery";
  if (name.includes("bridge")) return "bridge";
  if (name.includes("scan") || name.includes("list") || name.includes("read") || name.includes("check")) return "inspect";
  if (name.includes("scene") || name.includes("node") || name.includes("script")) return "edit";
  if (name.includes("image") || name.includes("texture") || name.includes("model") || name.includes("sprite")) return "assets";
  if (name.includes("run")) return "runtime";
  return "misc";
}

function workflowHelp() {
  return {
    inspectProject: ["godot_project_scan", "godot_list_scenes", "godot_check_errors"],
    createSimpleScene: ["godot_create_script", "godot_create_scene", "godot_attach_script", "godot_add_node", "godot_read_scene", "godot_check_errors"],
    importSprite: ["godot_import_image", "godot_add_node", "godot_update_node", "godot_check_errors"],
    generationSafeMode: ["godot_generate_sprite/provider:none", "godot_generate_texture/provider:none", "godot_generate_3d_model/provider:none"],
    editorBridgeLoop: ["enable addons/ai_mcp_bridge", "godot_bridge_status", "send editor bridge commands from a local client when richer Godot API access is needed"]
  };
}

function coverageHelp() {
  return {
    strong: ["project scan", "scene list/read for .tscn", "safe .tscn create/add/update", "GDScript creation", "project-local image/model import", "provider job queue", "static validation"],
    partial: ["Godot CLI run/check, depends on Godot executable availability", "Editor bridge, depends on plugin enabled in the editor", "OpenAI/custom_http image generation, depends on .env credentials and network approval"],
    intentionallyLimited: ["binary .scn editing", "arbitrary shell commands", "delete node/file operations", "full UndoRedo integration from MCP"],
    futureCandidates: ["runtime autoload for screenshots/input/runtime tree", "LSP/DAP integration", "ClassDB introspection", "paged tool profiles for small-context clients"]
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
    realAdapters: ["openai image generation", "custom_http image generation"],
    declaredInterfaces: ["polza_ai", "local_comfyui", "tripo", "meshy"]
  };
}

function bridgeHelp() {
  return {
    host: BRIDGE_HOST,
    port: BRIDGE_PORT,
    plugin: "Enable addons/ai_mcp_bridge in Godot Project Settings > Plugins.",
    why: "Use the bridge for live editor/API-backed operations where direct .tscn text editing is too limited.",
    currentCommands: ["status", "create_script", "create_scene", "add_node", "update_node", "attach_script"]
  };
}

function usageTemplate(name) {
  const templates = {
    godot_project_scan: { max_files: 8000, max_depth: 6 },
    godot_list_scenes: { folder: "" },
    godot_read_scene: { path: "scenes/example.tscn", include_text: false },
    godot_create_scene: { path: "scenes/example.tscn", root_type: "Node2D", root_name: "Example", overwrite: false },
    godot_add_node: { scene_path: "scenes/example.tscn", parent_path: ".", node_type: "Sprite2D", node_name: "Sprite", properties: { position: [0, 0] } },
    godot_update_node: { scene_path: "scenes/example.tscn", node_path: "Sprite", properties: { visible: true } },
    godot_attach_script: { scene_path: "scenes/example.tscn", node_path: ".", script_path: "scripts/example.gd", extends: "Node2D" },
    godot_create_script: { path: "scripts/example.gd", extends: "Node2D", description: "Example script" },
    godot_import_image: { source_path: "icon.svg", target_path: "assets/generated/sprites/icon.svg", kind: "sprite" },
    godot_generate_sprite: { provider: "none", prompt: "small friendly slime sprite", target_path: "assets/generated/sprites/slime.png" },
    godot_generate_texture: { provider: "none", prompt: "tileable stone floor", seamless: true, target_path: "assets/generated/textures/stone.png" },
    godot_import_3d_model: { source_path: "assets/source/models/prop.glb", target_path: "assets/models/prop.glb" },
    godot_generate_3d_model: { provider: "none", prompt: "low poly treasure chest", target_path: "assets/generated/models/chest.glb" },
    godot_run_project: { dry_run: true },
    godot_check_errors: { run_godot: true, timeout_ms: 20000 },
    godot_bridge_status: { timeout_ms: 1000 },
    godot_help: { category: "overview" }
  };
  return templates[name] ?? {};
}

function suggestToolChain(task) {
  const text = String(task).toLowerCase();
  if (text.includes("sprite") || text.includes("texture") || text.includes("image")) {
    return ["godot_help/tool:godot_generate_sprite", "godot_generate_sprite", "godot_import_image", "godot_check_errors"];
  }
  if (text.includes("3d") || text.includes("model") || text.includes("mesh")) {
    return ["godot_help/tool:godot_import_3d_model", "godot_generate_3d_model", "godot_import_3d_model", "godot_check_errors"];
  }
  if (text.includes("scene") || text.includes("node")) {
    return ["godot_project_scan", "godot_create_script", "godot_create_scene", "godot_add_node", "godot_read_scene", "godot_check_errors"];
  }
  if (text.includes("debug") || text.includes("run")) {
    return ["godot_check_errors", "godot_run_project/dry_run:true", "godot_bridge_status"];
  }
  return ["godot_project_scan", "godot_help/category:workflows", "godot_check_errors"];
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
  const args = ["--headless", "--path", projectRoot, "--quit"];
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

function godotString(value) {
  return JSON.stringify(value);
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
