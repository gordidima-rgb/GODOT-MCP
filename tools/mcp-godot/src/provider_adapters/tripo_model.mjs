import { sanitizeForLog } from "../security.mjs";
import { findModelUrl, downloadModel, writeModelMetadata } from "./model_result.mjs";

const TRIPO_BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const SUCCESS_STATUSES = new Set(["success", "succeeded", "finished", "done"]);
const RUNNING_STATUSES = new Set(["queued", "running", "pending", "processing", "in_progress"]);
const FAILURE_STATUSES = new Set(["failed", "cancelled", "canceled", "banned", "expired"]);

export async function generateTripoModel({ prompt, targetAbs, targetResPath, options = {}, env }) {
  const apiKey = env.TRIPO_API_KEY;
  if (!apiKey) {
    throw new Error("TRIPO_API_KEY is required for provider tripo.");
  }

  const baseUrl = String(env.TRIPO_BASE_URL || TRIPO_BASE_URL).replace(/\/+$/, "");
  const taskId = await createTripoTask({ env, apiKey, baseUrl, prompt, options });
  const task = await waitForTripoTask({ env, apiKey, baseUrl, taskId });
  const modelUrl = findModelUrl(task.data ?? task);
  if (!modelUrl) {
    throw new Error(`Tripo task did not include a downloadable model URL: ${sanitizeForLog(JSON.stringify(task), env)}`);
  }

  await downloadModel(modelUrl, targetAbs, env);
  await writeModelMetadata(targetAbs, {
    provider: "tripo",
    source: "Tripo 3D Generation API",
    sourceUrl: "https://github.com/VAST-AI-Research/tripo-python-sdk",
    prompt,
    targetPath: targetResPath,
    taskId,
    modelVersion: env.TRIPO_MODEL_VERSION || "v2.5-20250123",
    createdAt: new Date().toISOString(),
    licenseNote: "Generated model rights and usage depend on your Tripo account, prompt, and Tripo terms. Review provider terms before shipping assets."
  });

  return {
    ok: true,
    provider: "tripo",
    generated: true,
    target: targetResPath,
    metadataPath: `${targetResPath}.meta.json`,
    source: "Tripo 3D Generation API",
    repository: "https://github.com/VAST-AI-Research/tripo-python-sdk",
    licenseNote: "Generated model rights and usage depend on your Tripo account and Tripo terms.",
    taskId,
    note: "Tripo GLB downloaded into the Godot project."
  };
}

async function createTripoTask({ env, apiKey, baseUrl, prompt, options }) {
  const body = {
    type: "text_to_model",
    prompt,
    model_version: env.TRIPO_MODEL_VERSION || "v2.5-20250123",
    texture: parseBoolean(env.TRIPO_TEXTURE, true),
    pbr: parseBoolean(env.TRIPO_PBR, true),
    texture_quality: env.TRIPO_TEXTURE_QUALITY || "standard"
  };

  const faceLimit = Number(env.TRIPO_FACE_LIMIT || options.faceLimit || 0);
  if (Number.isInteger(faceLimit) && faceLimit > 0) {
    body.face_limit = faceLimit;
  }

  for (const [name, value] of [
    ["auto_size", env.TRIPO_AUTO_SIZE],
    ["quad", env.TRIPO_QUAD],
    ["compress", env.TRIPO_COMPRESS],
    ["smart_low_poly", env.TRIPO_SMART_LOW_POLY]
  ]) {
    if (value != null && value !== "") {
      body[name] = parseBoolean(value, false);
    }
  }

  const response = await fetch(`${baseUrl}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Tripo task creation failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }
  const json = JSON.parse(text);
  const taskId = json.data?.task_id ?? json.data?.id ?? json.task_id ?? json.id;
  if (typeof taskId !== "string" || taskId.trim() === "") {
    throw new Error(`Tripo task creation did not return a task id: ${sanitizeForLog(text, env)}`);
  }
  return taskId;
}

async function waitForTripoTask({ env, apiKey, baseUrl, taskId }) {
  const timeoutMs = clampInteger(env.TRIPO_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30000, 60 * 60 * 1000);
  const intervalMs = clampInteger(env.TRIPO_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, 1000, 60000);
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const task = await getTripoTask({ env, apiKey, baseUrl, taskId });
    const status = normalizeStatus(task.data?.status ?? task.status);
    if (SUCCESS_STATUSES.has(status)) {
      return task;
    }
    if (FAILURE_STATUSES.has(status)) {
      throw new Error(`Tripo task ${taskId} failed: ${sanitizeForLog(JSON.stringify(task.data ?? task), env)}`);
    }
    if (!RUNNING_STATUSES.has(status) && status !== "") {
      throw new Error(`Tripo task ${taskId} returned unknown status ${status}.`);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Tripo task ${taskId} timed out after ${timeoutMs} ms.`);
}

async function getTripoTask({ env, apiKey, baseUrl, taskId }) {
  const response = await fetch(`${baseUrl}/task/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Tripo task status failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }
  return JSON.parse(text);
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase();
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
