import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { safeFilenamePart, safeTimestamp } from "./security.mjs";
import { generateCustomHttpImage } from "./provider_adapters/custom_http_image.mjs";
import { generateOpenAIImage } from "./provider_adapters/openai_image.mjs";

export const IMAGE_PROVIDERS = ["none", "openai", "polza_ai", "local_comfyui", "custom_http"];
export const MODEL_3D_PROVIDERS = ["none", "tripo", "meshy", "custom_http"];

export async function createGenerationJob({ projectRoot, kind, provider, prompt, targetPath = null, options = {} }) {
  const allowedProviders = kind === "images" ? IMAGE_PROVIDERS : MODEL_3D_PROVIDERS;
  if (!allowedProviders.includes(provider)) {
    throw new Error(`Unsupported ${kind} provider: ${provider}`);
  }
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new Error("prompt must be a non-empty string.");
  }

  const id = `${safeTimestamp()}-${crypto.randomUUID().slice(0, 8)}`;
  const filename = `${safeFilenamePart(options.name ?? "prompt")}-${id}.json`;
  const folder = path.join(projectRoot, "generation_jobs", kind);
  const abs = path.join(folder, filename);
  const job = {
    id,
    kind,
    provider,
    prompt,
    targetPath,
    options: redactOptions(options),
    status: "queued",
    createdAt: new Date().toISOString(),
    note: provider === "none"
      ? "Provider is none, so this job records the prompt without generating an asset."
      : "Provider adapter is not available or not configured; this job keeps the request safe for later processing."
  };

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(abs, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return {
    ok: true,
    provider,
    queued: true,
    jobPath: `res://${path.relative(projectRoot, abs).split(path.sep).join("/")}`,
    job
  };
}

export async function generateImageWithProvider({ projectRoot, provider, prompt, targetAbs, targetResPath, options = {}, env }) {
  if (provider === "none") {
    return createGenerationJob({
      projectRoot,
      kind: "images",
      provider,
      prompt,
      targetPath: targetResPath,
      options
    });
  }

  if (provider === "openai") {
    return generateOpenAIImage({ provider, prompt, targetAbs, targetResPath, options, env });
  }

  if (provider === "custom_http" || provider === "polza_ai") {
    const url = provider === "polza_ai" ? env.POLZA_AI_IMAGE_URL : env.CUSTOM_IMAGE_HTTP_URL;
    const token = provider === "polza_ai" ? env.POLZA_AI_API_KEY : env.CUSTOM_IMAGE_HTTP_TOKEN;
    if (!url) {
      return createGenerationJob({
        projectRoot,
        kind: "images",
        provider,
        prompt,
        targetPath: targetResPath,
        options: { ...options, reason: "missing provider URL" }
      });
    }
    return generateCustomHttpImage({ provider, url, token, prompt, targetAbs, targetResPath, options, env });
  }

  return createGenerationJob({
    projectRoot,
    kind: "images",
    provider,
    prompt,
    targetPath: targetResPath,
    options: { ...options, reason: "adapter not implemented" }
  });
}

export async function generateModelWithProvider({ projectRoot, provider, prompt, targetResPath, options = {}, env }) {
  if (provider === "none") {
    return createGenerationJob({
      projectRoot,
      kind: "models",
      provider,
      prompt,
      targetPath: targetResPath,
      options
    });
  }

  // Tripo and Meshy have different API contracts and account-specific settings.
  // Keep them behind jobs until a concrete adapter configuration is supplied.
  const keyName = provider === "tripo" ? "TRIPO_API_KEY" : provider === "meshy" ? "MESHY_API_KEY" : "CUSTOM_MODEL_HTTP_TOKEN";
  const url = provider === "custom_http" ? env.CUSTOM_MODEL_HTTP_URL : "";
  if (provider === "custom_http" && url) {
    return {
      ok: false,
      provider,
      queued: false,
      message: "custom_http model generation adapter is declared but not implemented yet. Save a job with provider none or add a concrete adapter contract."
    };
  }

  return createGenerationJob({
    projectRoot,
    kind: "models",
    provider,
    prompt,
    targetPath: targetResPath,
    options: {
      ...options,
      reason: env[keyName] ? "credentials found, adapter still requires service-specific contract" : `missing ${keyName}`
    }
  });
}

function redactOptions(options) {
  const copy = { ...options };
  for (const key of Object.keys(copy)) {
    if (/(key|token|secret|password|credential)/i.test(key)) {
      copy[key] = "[redacted]";
    }
  }
  return copy;
}
