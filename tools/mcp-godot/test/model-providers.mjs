import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCustomHttpModel } from "../src/provider_adapters/custom_http_model.mjs";
import { generateMeshyModel } from "../src/provider_adapters/meshy_model.mjs";
import { generateTripoModel } from "../src/provider_adapters/tripo_model.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempRoot = path.join(__dirname, ".tmp-model-providers");
const originalFetch = global.fetch;

await fs.rm(tempRoot, { recursive: true, force: true });
await fs.mkdir(tempRoot, { recursive: true });

try {
  await testMeshyRefine();
  await testTripo();
  await testCustomHttp();
  console.log("model provider tests passed");
} finally {
  global.fetch = originalFetch;
  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function testMeshyRefine() {
  const targetAbs = path.join(tempRoot, "meshy.glb");
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/openapi/v2/text-to-3d") && init.method === "POST") {
      const body = JSON.parse(init.body);
      if (body.mode === "preview") {
        return jsonResponse({ result: "preview-task" });
      }
      if (body.mode === "refine" && body.preview_task_id === "preview-task") {
        return jsonResponse({ result: "refine-task" });
      }
    }
    if (String(url).endsWith("/openapi/v2/text-to-3d/preview-task")) {
      return jsonResponse({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.test/preview.glb" } });
    }
    if (String(url).endsWith("/openapi/v2/text-to-3d/refine-task")) {
      return jsonResponse({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.test/refined.glb" } });
    }
    if (String(url) === "https://assets.meshy.test/refined.glb") {
      return binaryResponse("meshy-glb");
    }
    throw new Error(`unexpected Meshy fetch: ${url}`);
  };

  const result = await generateMeshyModel({
    prompt: "test model",
    targetAbs,
    targetResPath: "res://assets/generated/models/meshy.glb",
    options: { quality: "refine" },
    env: { MESHY_API_KEY: "secret", MESHY_POLL_INTERVAL_MS: "1000" }
  });

  assert(result.generated === true, "Meshy must report generated");
  assert(result.quality === "refine", "Meshy must preserve quality");
  assert((await fs.readFile(targetAbs, "utf8")) === "meshy-glb", "Meshy must write downloaded GLB");
  const metadata = JSON.parse(await fs.readFile(`${targetAbs}.meta.json`, "utf8"));
  assert(metadata.provider === "meshy", "Meshy metadata must include provider");
  assert(metadata.taskIds.refine === "refine-task", "Meshy metadata must include refine task id");
  assert(calls.some((call) => call.init.headers?.Authorization === "Bearer secret"), "Meshy must send Authorization header");
}

async function testTripo() {
  const targetAbs = path.join(tempRoot, "tripo.glb");
  global.fetch = async (url, init = {}) => {
    if (String(url).endsWith("/v2/openapi/task") && init.method === "POST") {
      const body = JSON.parse(init.body);
      assert(body.type === "text_to_model", "Tripo must request text_to_model");
      assert(body.texture === true && body.pbr === true, "Tripo must request textured PBR output by default");
      return jsonResponse({ data: { task_id: "tripo-task" } });
    }
    if (String(url).endsWith("/v2/openapi/task/tripo-task")) {
      return jsonResponse({ data: { status: "success", output: { pbr_model: "https://assets.tripo.test/model.glb" } } });
    }
    if (String(url) === "https://assets.tripo.test/model.glb") {
      return binaryResponse("tripo-glb");
    }
    throw new Error(`unexpected Tripo fetch: ${url}`);
  };

  const result = await generateTripoModel({
    prompt: "test model",
    targetAbs,
    targetResPath: "res://assets/generated/models/tripo.glb",
    options: {},
    env: { TRIPO_API_KEY: "secret", TRIPO_POLL_INTERVAL_MS: "1000" }
  });

  assert(result.generated === true, "Tripo must report generated");
  assert((await fs.readFile(targetAbs, "utf8")) === "tripo-glb", "Tripo must write downloaded GLB");
  const metadata = JSON.parse(await fs.readFile(`${targetAbs}.meta.json`, "utf8"));
  assert(metadata.provider === "tripo", "Tripo metadata must include provider");
  assert(metadata.taskId === "tripo-task", "Tripo metadata must include task id");
}

async function testCustomHttp() {
  const targetAbs = path.join(tempRoot, "custom.glb");
  global.fetch = async (url, init = {}) => {
    if (String(url) === "https://custom.test/generate") {
      const body = JSON.parse(init.body);
      assert(body.output_format === "glb", "custom_http must request GLB output");
      return jsonResponse({ url: "https://custom.test/model.glb" });
    }
    if (String(url) === "https://custom.test/model.glb") {
      return binaryResponse("custom-glb");
    }
    throw new Error(`unexpected custom fetch: ${url}`);
  };

  const result = await generateCustomHttpModel({
    provider: "custom_http",
    url: "https://custom.test/generate",
    token: "secret",
    prompt: "test model",
    targetAbs,
    targetResPath: "res://assets/generated/models/custom.glb",
    options: {},
    env: {}
  });

  assert(result.generated === true, "custom_http must report generated");
  assert((await fs.readFile(targetAbs, "utf8")) === "custom-glb", "custom_http must write downloaded GLB");
  const metadata = JSON.parse(await fs.readFile(`${targetAbs}.meta.json`, "utf8"));
  assert(metadata.provider === "custom_http", "custom_http metadata must include provider");
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function binaryResponse(value, status = 200) {
  return new Response(Buffer.from(value), {
    status,
    headers: { "content-type": "model/gltf-binary", "content-length": String(Buffer.byteLength(value)) }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
