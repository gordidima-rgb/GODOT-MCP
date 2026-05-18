import { sanitizeForLog } from "../security.mjs";
import { downloadModel, writeModelMetadata } from "./model_result.mjs";

const MESHY_TEXT_TO_3D_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const TERMINAL_FAILURES = new Set(["FAILED", "CANCELED", "CANCELLED", "EXPIRED"]);

export async function generateMeshyModel({ prompt, targetAbs, targetResPath, options = {}, env }) {
  const apiKey = env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("MESHY_API_KEY is required for provider meshy.");
  }

  const quality = String(options.quality ?? env.MESHY_QUALITY ?? "preview").toLowerCase();
  if (!["preview", "refine"].includes(quality)) {
    throw new Error("Meshy quality must be preview or refine.");
  }

  const previewId = await createMeshyTask({
    env,
    apiKey,
    body: {
      mode: "preview",
      prompt,
      should_remesh: parseBoolean(env.MESHY_SHOULD_REMESH, true)
    }
  });
  const previewTask = await waitForMeshyTask({ env, apiKey, taskId: previewId });

  let finalTask = previewTask;
  let refineId = "";
  if (quality === "refine") {
    refineId = await createMeshyTask({
      env,
      apiKey,
      body: {
        mode: "refine",
        preview_task_id: previewId,
        enable_pbr: parseBoolean(env.MESHY_ENABLE_PBR, true),
        target_formats: ["glb"],
        auto_size: parseBoolean(env.MESHY_AUTO_SIZE, true)
      }
    });
    finalTask = await waitForMeshyTask({ env, apiKey, taskId: refineId });
  }

  const glbUrl = finalTask.model_urls?.glb;
  if (!glbUrl) {
    throw new Error(`Meshy task did not include model_urls.glb: ${sanitizeForLog(JSON.stringify(finalTask), env)}`);
  }

  await downloadModel(glbUrl, targetAbs, env);
  const metadataAbs = await writeModelMetadata(targetAbs, {
    provider: "meshy",
    source: "Meshy Text to 3D API",
    sourceUrl: "https://docs.meshy.ai/en/api/text-to-3d",
    prompt,
    targetPath: targetResPath,
    quality,
    taskIds: {
      preview: previewId,
      refine: refineId || null
    },
    createdAt: new Date().toISOString(),
    licenseNote: "Generated model rights and usage depend on your Meshy account, prompt, and Meshy terms. Review provider terms before shipping assets."
  });

  return {
    ok: true,
    provider: "meshy",
    generated: true,
    target: targetResPath,
    metadataPath: toSiblingResPath(targetResPath, ".meta.json"),
    source: "Meshy Text to 3D API",
    repository: "https://docs.meshy.ai/en/api/text-to-3d",
    licenseNote: "Generated model rights and usage depend on your Meshy account and Meshy terms.",
    taskIds: { preview: previewId, refine: refineId || null },
    quality,
    note: "Meshy GLB downloaded into the Godot project."
  };
}

async function createMeshyTask({ env, apiKey, body }) {
  const response = await fetch(MESHY_TEXT_TO_3D_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Meshy task creation failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }
  const json = JSON.parse(text);
  if (typeof json.result !== "string" || json.result.trim() === "") {
    throw new Error(`Meshy task creation did not return result id: ${sanitizeForLog(text, env)}`);
  }
  return json.result;
}

async function waitForMeshyTask({ env, apiKey, taskId }) {
  const timeoutMs = clampInteger(env.MESHY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30000, 60 * 60 * 1000);
  const intervalMs = clampInteger(env.MESHY_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, 1000, 60000);
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const task = await getMeshyTask({ env, apiKey, taskId });
    const status = String(task.status ?? "").toUpperCase();
    if (status === "SUCCEEDED") {
      return task;
    }
    if (TERMINAL_FAILURES.has(status)) {
      throw new Error(`Meshy task ${taskId} failed: ${sanitizeForLog(JSON.stringify(task.task_error ?? task), env)}`);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Meshy task ${taskId} timed out after ${timeoutMs} ms.`);
}

async function getMeshyTask({ env, apiKey, taskId }) {
  const response = await fetch(`${MESHY_TEXT_TO_3D_URL}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Meshy task status failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }
  return JSON.parse(text);
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }
  return /^(1|true|yes|on)$/i.test(String(value));
}

function clampInteger(value, fallback, min, max) {
  if (value == null || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSiblingResPath(targetResPath, suffix) {
  return `${targetResPath}${suffix}`;
}
