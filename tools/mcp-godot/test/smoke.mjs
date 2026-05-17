import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(toolRoot, "..", "..");
const fixtureRoot = path.join(toolRoot, ".tmp-smoke-project");
const serverPath = path.join(toolRoot, "src", "server.mjs");

await resetFixture();

const child = spawn(process.execPath, [serverPath, "--project-root", fixtureRoot], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true
});

let nextId = 1;
let buffer = "";
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) {
      continue;
    }
    const message = JSON.parse(line);
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      if (message.error) {
        entry.reject(new Error(message.error.message));
      } else {
        entry.resolve(message.result);
      }
    }
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mcp-godot-smoke", version: "0.1.0" }
  });
  assert(init.capabilities?.tools, "initialize must return tools capability");
  notify("notifications/initialized", {});

  const listed = await request("tools/list", {});
  const names = listed.tools.map((tool) => tool.name);
  for (const name of [
    "godot_help",
    "godot_bridge_status",
    "godot_editor_scene_snapshot",
    "godot_project_scan",
    "godot_list_scenes",
    "godot_read_scene",
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
    "godot_run_project",
    "godot_runtime_status",
    "godot_stop_project",
    "godot_capture_screenshot",
    "godot_capture_editor_viewport",
    "godot_check_errors"
  ]) {
    assert(names.includes(name), `missing tool: ${name}`);
  }

  const help = await call("godot_help", { category: "coverage" });
  assert(help.coverage.strong.includes("project scan"), "godot_help must expose coverage info");

  const bridge = await call("godot_bridge_status", { timeout_ms: 250 });
  assert(bridge.ok === false || bridge.connected === true, "godot_bridge_status must return a structured status");

  const editorSnapshot = await call("godot_editor_scene_snapshot", { timeout_ms: 250 });
  assert(editorSnapshot.ok === false || editorSnapshot.connected === true, "godot_editor_scene_snapshot must return bridge connection status");

  await call("godot_create_script", {
    path: "scripts/smoke.gd",
    extends: "Node"
  });
  await call("godot_create_scene", {
    path: "scenes/smoke.tscn",
    root_type: "Node2D",
    root_name: "Smoke"
  });
  await call("godot_attach_script", {
    scene_path: "scenes/smoke.tscn",
    node_path: ".",
    script_path: "scripts/smoke.gd"
  });
  await call("godot_add_node", {
    scene_path: "scenes/smoke.tscn",
    parent_path: ".",
    node_type: "Sprite2D",
    node_name: "Sprite",
    properties: {
      position: [12, 24],
      visible: true
    }
  });
  await call("godot_update_node", {
    scene_path: "scenes/smoke.tscn",
    node_path: "Sprite",
    properties: {
      scale: [2, 2]
    }
  });
  const image = await call("godot_import_image", {
    source_path: "icon.svg",
    target_path: "assets/imported/icon.svg",
    kind: "sprite"
  });
  assert(image.ok, "godot_import_image must copy bytes");

  const model = await call("godot_import_3d_model", {
    source_path: "source_models/cube.glb",
    target_path: "assets/models/cube.glb"
  });
  assert(model.ok, "godot_import_3d_model must copy bytes");

  const imageJob = await call("godot_generate_sprite", {
    provider: "none",
    prompt: "A tiny smoke-test sprite",
    target_path: "assets/generated/sprites/smoke.png",
    name: "smoke-sprite"
  });
  assert(imageJob.queued && imageJob.jobPath.startsWith("res://generation_jobs/images/"), "godot_generate_sprite must create a job");

  const textureJob = await call("godot_generate_texture", {
    provider: "none",
    prompt: "A tiny smoke-test tile",
    target_path: "assets/generated/textures/smoke.png",
    name: "smoke-texture",
    seamless: true
  });
  assert(textureJob.queued && textureJob.jobPath.startsWith("res://generation_jobs/images/"), "godot_generate_texture must create a job");

  const modelJob = await call("godot_generate_3d_model", {
    provider: "none",
    prompt: "A tiny smoke-test cube",
    target_path: "assets/generated/models/smoke.glb",
    name: "smoke-model"
  });
  assert(modelJob.queued && modelJob.jobPath.startsWith("res://generation_jobs/models/"), "godot_generate_3d_model must create a job");

  const scan = await call("godot_project_scan", {});
  assert(scan.counts.scenes === 1, "project_scan must see the created scene");
  assert(scan.counts.scripts === 1, "project_scan must see the created script");
  assert(scan.counts.models === 2, "project_scan must see source and imported models");

  const scenes = await call("godot_list_scenes", {});
  assert(scenes.scenes.some((scene) => scene.path === "res://scenes/smoke.tscn"), "list_scenes must include smoke scene");

  const scene = await call("godot_read_scene", { path: "scenes/smoke.tscn" });
  assert(scene.scene.root.type === "Node2D", "read_scene must parse the root node type");
  assert(scene.scene.nodes.some((node) => node.path === "Sprite"), "read_scene must include added node");

  const unsafe = await callRaw("godot_read_scene", { path: "../outside.tscn" });
  assert(unsafe.isError === true, "unsafe path must be rejected as a tool error");

  const runDry = await call("godot_run_project", { dry_run: true });
  assert(runDry.dryRun === true || runDry.status === "not_found", "godot_run_project dry run must not launch Godot");

  const status = await call("godot_runtime_status", { include_bridge: false });
  assert(status.cli.status === "not_running", "runtime_status must report no tracked game before launch");

  const stop = await call("godot_stop_project", { mode: "cli" });
  assert(stop.cli.status === "not_running", "stop_project cli mode must be safe when no game is running");

  const screenshotDry = await call("godot_capture_screenshot", {
    scene_path: "scenes/smoke.tscn",
    output_path: "docs/assets/screenshots/runtime/smoke.png",
    dry_run: true
  });
  assert(screenshotDry.dryRun === true || screenshotDry.status === "not_found", "capture_screenshot dry run must not launch Godot");

  const editorViewport = await call("godot_capture_editor_viewport", {
    output_path: "docs/assets/screenshots/editor/smoke.png",
    timeout_ms: 250
  });
  assert(editorViewport.ok === false || editorViewport.connected === true, "capture_editor_viewport must return bridge connection status");

  const checked = await call("godot_check_errors", { run_godot: false });
  assert(checked.ok === true, "static check_errors must pass for fixture");

  console.log("mcp-godot smoke test passed");
} finally {
  child.stdin.end();
  child.kill();
}

function request(method, params) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for ${method}`));
    }, 5000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      }
    });
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

async function call(name, args) {
  const result = await callRaw(name, args);
  if (result.isError) {
    throw new Error(result.content?.[0]?.text ?? `${name} failed`);
  }
  return result.structuredContent;
}

async function callRaw(name, args) {
  return request("tools/call", {
    name,
    arguments: args
  });
}

async function resetFixture() {
  const resolved = path.resolve(fixtureRoot);
  if (!resolved.startsWith(toolRoot + path.sep)) {
    throw new Error("refusing to reset fixture outside tool root");
  }
  await fs.rm(resolved, { recursive: true, force: true });
  await fs.mkdir(resolved, { recursive: true });
  await fs.writeFile(
    path.join(resolved, "project.godot"),
    [
      "config_version=5",
      "",
      "[application]",
      "",
      'config/name="Smoke Fixture"',
      'config/features=PackedStringArray("4.6", "Forward Plus")',
      'config/icon="res://icon.svg"',
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(path.join(resolved, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>\n', "utf8");
  await fs.mkdir(path.join(resolved, "source_models"), { recursive: true });
  await fs.writeFile(path.join(resolved, "source_models", "cube.glb"), "glb-fixture\n", "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
