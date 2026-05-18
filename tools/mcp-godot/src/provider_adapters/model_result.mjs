import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeForLog } from "../security.mjs";

export const MAX_MODEL_DOWNLOAD_BYTES = 256 * 1024 * 1024;

export async function writeModelResult(result, targetAbs, env, options = {}) {
  if (Buffer.isBuffer(result)) {
    await writeModelBytes(result, targetAbs);
    return;
  }

  if (result instanceof ArrayBuffer) {
    await writeModelBytes(Buffer.from(result), targetAbs);
    return;
  }

  if (typeof result === "string") {
    if (isHttpUrl(result)) {
      await downloadModel(result, targetAbs, env, options);
      return;
    }
    await writeModelBytes(Buffer.from(result, "base64"), targetAbs);
    return;
  }

  const url = findModelUrl(result);
  if (url) {
    await downloadModel(url, targetAbs, env, options);
    return;
  }

  const base64 = findBase64Model(result);
  if (base64) {
    await writeModelBytes(Buffer.from(base64, "base64"), targetAbs);
    return;
  }

  throw new Error(`provider response did not include a model URL or base64 model: ${sanitizeForLog(JSON.stringify(result), env)}`);
}

export function findModelUrl(result) {
  if (result == null || typeof result !== "object") {
    return "";
  }

  const candidates = [
    result.glb_url,
    result.model_url,
    result.url,
    result.asset,
    result.model,
    result.pbr_model,
    result.base_model,
    result.data?.glb_url,
    result.data?.model_url,
    result.data?.url,
    result.data?.asset,
    result.data?.model,
    result.data?.pbr_model,
    result.output?.model,
    result.output?.pbr_model,
    result.output?.base_model,
    result.model_urls?.glb,
    result.data?.model_urls?.glb
  ];

  for (const candidate of candidates) {
    const url = unwrapUrl(candidate);
    if (url) {
      return url;
    }
  }

  if (Array.isArray(result.results)) {
    for (const item of result.results) {
      const url = findModelUrl(item);
      if (url) {
        return url;
      }
    }
  }

  if (Array.isArray(result.data?.results)) {
    for (const item of result.data.results) {
      const url = findModelUrl(item);
      if (url) {
        return url;
      }
    }
  }

  return "";
}

export async function downloadModel(url, targetAbs, env, options = {}) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`model URL fetch failed: ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  const maxBytes = options.maxBytes ?? MAX_MODEL_DOWNLOAD_BYTES;
  if (contentLength > maxBytes) {
    throw new Error(`model download is larger than ${maxBytes} bytes.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error(`model download is larger than ${maxBytes} bytes.`);
  }

  if (bytes.length === 0) {
    throw new Error(`model URL returned an empty response: ${sanitizeForLog(url, env)}`);
  }

  await writeModelBytes(bytes, targetAbs);
}

export async function writeModelMetadata(targetAbs, metadata) {
  const metaAbs = `${targetAbs}.meta.json`;
  await fs.mkdir(path.dirname(metaAbs), { recursive: true });
  await fs.writeFile(metaAbs, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metaAbs;
}

async function writeModelBytes(bytes, targetAbs) {
  await fs.mkdir(path.dirname(targetAbs), { recursive: true });
  await fs.writeFile(targetAbs, bytes);
}

function findBase64Model(result) {
  if (result == null || typeof result !== "object") {
    return "";
  }
  for (const candidate of [result.b64_json, result.base64, result.data?.b64_json, result.data?.base64]) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return stripDataPrefix(candidate.trim());
    }
  }
  return "";
}

function unwrapUrl(value) {
  if (typeof value === "string" && isHttpUrl(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of ["url", "href", "download_url", "asset"]) {
      if (typeof value[key] === "string" && isHttpUrl(value[key])) {
        return value[key];
      }
    }
  }
  return "";
}

function stripDataPrefix(value) {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}
