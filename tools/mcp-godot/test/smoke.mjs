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
    "godot_doctor",
    "godot_codex_config",
    "godot_bridge_status",
    "godot_editor_scene_snapshot",
    "godot_project_scan",
    "godot_search_project",
    "godot_list_scenes",
    "godot_list_scripts",
    "godot_read_scene",
    "godot_create_scene",
    "godot_add_node",
    "godot_update_node",
    "godot_attach_script",
    "godot_create_script",
    "godot_create_input_action",
    "godot_create_autoload",
    "godot_create_material",
    "godot_install_third_person_controller",
    "godot_create_third_person_prototype",
    "godot_install_first_person_controller",
    "godot_create_first_person_prototype",
    "godot_import_image",
    "godot_generate_sprite",
    "godot_generate_texture",
    "godot_import_3d_model",
    "godot_generate_3d_model",
    "godot_list_generation_jobs",
    "godot_update_generation_job_status",
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
  assert(help.coverage.strong.some((item) => item.includes("project scan")), "godot_help must expose coverage info");

  const generationHelp = await call("godot_help", { category: "generation" });
  assert(generationHelp.generation.realAdapters.includes("meshy text-to-3d"), "generation help must include Meshy model adapter");
  assert(generationHelp.generation.realAdapters.includes("tripo text-to-model"), "generation help must include Tripo model adapter");

  const generateModelTool = listed.tools.find((tool) => tool.name === "godot_generate_3d_model");
  assert(generateModelTool.inputSchema.properties.quality.enum.includes("refine"), "godot_generate_3d_model must expose Meshy quality");

  const debugHelp = await call("godot_help", { category: "debug" });
  assert(
    debugHelp.debug.afterGameplayScriptChanges.required === true,
    "godot_help debug must require a runtime console check after gameplay script changes"
  );
  assert(
    debugHelp.debug.afterGameplayScriptChanges.completionRule.includes("Godot console"),
    "godot_help debug must explain that the latest Godot console must be clean"
  );
  assert(
    debugHelp.debug.afterSceneObjectPlacement.requiredScreenshot === true,
    "godot_help debug must require a screenshot after placing visible scene objects"
  );

  const thirdPersonHelp = await call("godot_help", { task: "create a third person character prototype scene" });
  assert(
    thirdPersonHelp.suggestedChain.includes("godot_install_third_person_controller"),
    "third-person prototype tasks must recommend installing the real PlayerCharacter controller"
  );

  const firstPersonHelp = await call("godot_help", { task: "create an FPS first person prototype scene" });
  assert(
    firstPersonHelp.suggestedChain.includes("godot_install_first_person_controller"),
    "first-person prototype tasks must recommend installing Jeh3no's advanced first-person controller"
  );

  const bridge = await call("godot_bridge_status", { timeout_ms: 250 });
  assert(bridge.ok === false || bridge.connected === true, "godot_bridge_status must return a structured status");

  const editorSnapshot = await call("godot_editor_scene_snapshot", { timeout_ms: 250 });
  assert(editorSnapshot.ok === false || editorSnapshot.connected === true, "godot_editor_scene_snapshot must return bridge connection status");

  const doctor = await call("godot_doctor", { timeout_ms: 250 });
  assert(doctor.projectRoot === fixtureRoot, "godot_doctor must report the fixture project root");
  assert(doctor.serverVersion === "0.4.0", "godot_doctor must report server version");
  assert(doctor.projectGodot.exists === true, "godot_doctor must see project.godot");

  const codexConfig = await call("godot_codex_config", {});
  assert(codexConfig.toml.includes("[mcp_servers.godotMCP]"), "godot_codex_config must return TOML");
  assert(codexConfig.toml.includes(fixtureRoot.replaceAll("\\", "\\\\")) || codexConfig.toml.includes(fixtureRoot), "godot_codex_config must include project root");

  const dryScript = await call("godot_create_script", {
    path: "scripts/dry_only.gd",
    extends: "Node",
    dry_run: true
  });
  assert(dryScript.dryRun === true && dryScript.plannedChanges.length === 1, "godot_create_script dry_run must return plannedChanges");
  assert(!(await exists(path.join(fixtureRoot, "scripts", "dry_only.gd"))), "godot_create_script dry_run must not write a file");

  const dryScene = await call("godot_create_scene", {
    path: "scenes/dry_only.tscn",
    root_type: "Node2D",
    root_name: "DryOnly",
    dry_run: true
  });
  assert(dryScene.dryRun === true && dryScene.plannedChanges.length === 1, "godot_create_scene dry_run must return plannedChanges");
  assert(!(await exists(path.join(fixtureRoot, "scenes", "dry_only.tscn"))), "godot_create_scene dry_run must not write a file");

  await call("godot_create_script", {
    path: "scripts/smoke.gd",
    extends: "Node"
  });
  await call("godot_create_scene", {
    path: "scenes/smoke.tscn",
    root_type: "Node2D",
    root_name: "Smoke"
  });
  const attachDry = await call("godot_attach_script", {
    scene_path: "scenes/smoke.tscn",
    node_path: ".",
    script_path: "scripts/smoke.gd",
    dry_run: true
  });
  assert(attachDry.dryRun === true && attachDry.plannedChanges.some((change) => change.action === "attach_script"), "godot_attach_script dry_run must plan the scene update");
  await call("godot_attach_script", {
    scene_path: "scenes/smoke.tscn",
    node_path: ".",
    script_path: "scripts/smoke.gd"
  });
  const addDry = await call("godot_add_node", {
    scene_path: "scenes/smoke.tscn",
    parent_path: ".",
    node_type: "Sprite2D",
    node_name: "DrySprite",
    properties: {
      position: [1, 2]
    },
    dry_run: true
  });
  assert(addDry.dryRun === true && addDry.plannedChanges.some((change) => change.action === "add_node"), "godot_add_node dry_run must plan the new node");
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
  const updateDry = await call("godot_update_node", {
    scene_path: "scenes/smoke.tscn",
    node_path: "Sprite",
    properties: {
      visible: false
    },
    dry_run: true
  });
  assert(updateDry.dryRun === true && updateDry.updatedProperties.includes("visible"), "godot_update_node dry_run must plan property updates");
  await call("godot_update_node", {
    scene_path: "scenes/smoke.tscn",
    node_path: "Sprite",
    properties: {
      scale: [2, 2]
    }
  });
  const inputAction = await call("godot_create_input_action", {
    action: "jump",
    events: [{ type: "key", keycode: 32 }]
  });
  assert(inputAction.ok && inputAction.action === "jump", "godot_create_input_action must update project.godot");

  const autoload = await call("godot_create_autoload", {
    name: "SmokeState",
    script_path: "scripts/smoke.gd"
  });
  assert(autoload.ok && autoload.name === "SmokeState", "godot_create_autoload must update project.godot");

  const material = await call("godot_create_material", {
    path: "assets/materials/smoke.tres",
    material_type: "StandardMaterial3D",
    albedo_color: [0.2, 0.4, 0.8, 1]
  });
  assert(material.ok, "godot_create_material must write a material resource");

  const controller = await call("godot_install_third_person_controller", {
    source_path: "third_person_source",
    include_dependencies: true
  });
  assert(controller.ok, "godot_install_third_person_controller must install from a project-local source");
  assert(
    await exists(path.join(fixtureRoot, "addons", "PlayerCharacter", "player_character.tscn")),
    "third-person controller install must copy PlayerCharacter scene files"
  );
  assert(
    await exists(path.join(fixtureRoot, "addons", "Arts", "plush.txt")),
    "third-person controller install must copy sibling character asset dependencies by default"
  );

  const prototype = await call("godot_create_third_person_prototype", {
    scene_path: "scenes/third_person_controller_prototype.tscn",
    source_path: "third_person_source"
  });
  assert(prototype.ok, "godot_create_third_person_prototype must create a playable prototype scene");
  assert(
    prototype.characterScene === "res://addons/PlayerCharacter/player_character.tscn",
    "prototype scene must instance the upstream PlayerCharacter scene instead of a simple capsule"
  );
  const prototypeText = await fs.readFile(path.join(fixtureRoot, "scenes", "third_person_controller_prototype.tscn"), "utf8");
  assert(prototypeText.includes("instance=ExtResource"), "prototype scene must instance the PlayerCharacter PackedScene");
  assert(
    prototypeText.includes("res://addons/PlayerCharacter/player_character.tscn"),
    "prototype scene must reference the installed PlayerCharacter scene"
  );
  const projectTextAfterPrototype = await fs.readFile(path.join(fixtureRoot, "project.godot"), "utf8");
  assert(
    projectTextAfterPrototype.includes("play_char_move_forward_action"),
    "prototype creation must add the PlayerCharacter input actions"
  );

  const firstPersonController = await call("godot_install_first_person_controller", {
    source_path: "first_person_source",
    include_dependencies: true,
    overwrite: true
  });
  assert(firstPersonController.ok, "godot_install_first_person_controller must install from a project-local source");
  assert(
    firstPersonController.repository === "Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller",
    "first-person install result must name the Jeh3no source repository"
  );
  assert(
    firstPersonController.credit.includes("Jeh3no"),
    "first-person install result must credit Jeh3no"
  );
  assert(
    firstPersonController.licenseNote.includes("MIT"),
    "first-person install result must include the upstream license note"
  );
  assert(
    await exists(path.join(fixtureRoot, "addons", "PlayerCharacter", "player_character_scene.tscn")),
    "first-person controller install must copy PlayerCharacter scene files"
  );
  assert(
    await exists(path.join(fixtureRoot, "addons", "Arts", "crosshair.png")),
    "first-person controller install must copy sibling art dependencies by default"
  );
  assert(
    await exists(path.join(fixtureRoot, "addons", "LICENSE")),
    "first-person controller install must preserve upstream addon license files when present"
  );
  const installedFirstPersonScene = await fs.readFile(path.join(fixtureRoot, "addons", "PlayerCharacter", "player_character_scene.tscn"), "utf8");
  assert(
    installedFirstPersonScene.includes("res://addons/PlayerCharacter/StateMachine/player_character_script.gd"),
    "first-person install must normalize upstream res:// project prefix references"
  );
  assert(
    !installedFirstPersonScene.includes("res://Godot-Advanced-State-Machine-First-Person-Controller/addons/"),
    "first-person install must not leave upstream project-root references behind"
  );

  const firstPersonPrototype = await call("godot_create_first_person_prototype", {
    scene_path: "scenes/first_person_controller_prototype.tscn",
    source_path: "first_person_source"
  });
  assert(firstPersonPrototype.ok, "godot_create_first_person_prototype must create a playable prototype scene");
  assert(
    firstPersonPrototype.characterScene === "res://addons/PlayerCharacter/player_character_scene.tscn",
    "first-person prototype scene must instance Jeh3no's first-person PlayerCharacter scene"
  );
  assert(
    firstPersonPrototype.repository === "Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller",
    "first-person prototype result must name the Jeh3no source repository"
  );
  assert(
    firstPersonPrototype.credit.includes("Jeh3no"),
    "first-person prototype result must credit Jeh3no"
  );
  assert(
    firstPersonPrototype.licenseNote.includes("MIT"),
    "first-person prototype result must include the upstream license note"
  );
  const firstPersonPrototypeText = await fs.readFile(path.join(fixtureRoot, "scenes", "first_person_controller_prototype.tscn"), "utf8");
  assert(firstPersonPrototypeText.includes("instance=ExtResource"), "first-person prototype scene must instance the PlayerCharacter PackedScene");
  assert(
    firstPersonPrototypeText.includes("res://addons/PlayerCharacter/player_character_scene.tscn"),
    "first-person prototype scene must reference the installed first-person PlayerCharacter scene"
  );
  assert(
    firstPersonPrototypeText.includes("Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller addons/PlayerCharacter"),
    "first-person prototype scene metadata must attribute Jeh3no data"
  );
  const projectTextAfterFirstPerson = await fs.readFile(path.join(fixtureRoot, "project.godot"), "utf8");
  assert(
    projectTextAfterFirstPerson.includes("play_char_zoom_action"),
    "first-person prototype creation must add the first-person PlayerCharacter input actions"
  );

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

  const missingMeshyJob = await call("godot_generate_3d_model", {
    provider: "meshy",
    prompt: "A tiny smoke-test generated model",
    target_path: "assets/generated/models/missing-meshy.glb",
    name: "missing-meshy",
    quality: "preview"
  });
  assert(missingMeshyJob.queued && missingMeshyJob.job.options.reason === "missing MESHY_API_KEY", "meshy without a key must queue a safe job");

  const jobs = await call("godot_list_generation_jobs", { kind: "all" });
  assert(jobs.count >= 3, "godot_list_generation_jobs must see queued jobs");
  const updatedJob = await call("godot_update_generation_job_status", {
    job_path: imageJob.jobPath,
    status: "done",
    note: "Smoke test completed."
  });
  assert(updatedJob.status === "done", "godot_update_generation_job_status must update status");

  const scan = await call("godot_project_scan", {});
  assert(scan.counts.scenes >= 2, "project_scan must see created and installed scenes");
  assert(scan.counts.scripts >= 1, "project_scan must see the created script");
  assert(scan.counts.models === 2, "project_scan must see source and imported models");

  const scenes = await call("godot_list_scenes", {});
  assert(scenes.scenes.some((scene) => scene.path === "res://scenes/smoke.tscn"), "list_scenes must include smoke scene");

  const scripts = await call("godot_list_scripts", {});
  assert(scripts.scripts.some((script) => script.path === "res://scripts/smoke.gd"), "list_scripts must include smoke script");

  const search = await call("godot_search_project", { query: "Smoke", extensions: [".tscn", ".gd"] });
  assert(search.matches.length > 0, "search_project must find text in project files");

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

  if (editorSnapshot.connected !== true) {
    const editorViewport = await call("godot_capture_editor_viewport", {
      output_path: "docs/assets/screenshots/editor/smoke.png",
      timeout_ms: 250
    });
    assert(editorViewport.ok === false || editorViewport.connected === true, "capture_editor_viewport must return bridge connection status");
  }

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
  await fs.mkdir(path.join(resolved, "third_person_source", "addons", "PlayerCharacter"), { recursive: true });
  await fs.mkdir(path.join(resolved, "third_person_source", "addons", "Arts"), { recursive: true });
  await fs.writeFile(
    path.join(resolved, "third_person_source", "addons", "PlayerCharacter", "player_character.tscn"),
    [
      '[gd_scene format=3]',
      '',
      '[node name="PlayerCharacter" type="CharacterBody3D"]',
      ''
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(resolved, "third_person_source", "addons", "PlayerCharacter", "controller.gd"),
    'extends CharacterBody3D\n',
    "utf8"
  );
  await fs.writeFile(path.join(resolved, "third_person_source", "addons", "Arts", "plush.txt"), "fake character art dependency\n", "utf8");
  await fs.mkdir(path.join(resolved, "first_person_source", "addons", "PlayerCharacter", "StateMachine"), { recursive: true });
  await fs.mkdir(path.join(resolved, "first_person_source", "addons", "Arts"), { recursive: true });
  await fs.writeFile(
    path.join(resolved, "first_person_source", "addons", "PlayerCharacter", "player_character_scene.tscn"),
    [
      '[gd_scene load_steps=2 format=3]',
      '',
      '[ext_resource type="Script" path="res://Godot-Advanced-State-Machine-First-Person-Controller/addons/PlayerCharacter/StateMachine/player_character_script.gd" id="1_first"]',
      '',
      '[node name="PlayerCharacter" type="CharacterBody3D"]',
      'script = ExtResource("1_first")',
      ''
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(resolved, "first_person_source", "addons", "PlayerCharacter", "StateMachine", "player_character_script.gd"),
    "extends CharacterBody3D\n",
    "utf8"
  );
  await fs.writeFile(path.join(resolved, "first_person_source", "addons", "Arts", "crosshair.png"), "fake png bytes\n", "utf8");
  await fs.writeFile(path.join(resolved, "first_person_source", "addons", "LICENSE"), "MIT License fixture\n", "utf8");
}

async function exists(abs) {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
